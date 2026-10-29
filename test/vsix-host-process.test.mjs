import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ProcessTimeoutError,
  readExtensionRegistry,
  runProcess,
  uninstallExtension,
} from "../scripts/check-vsix-host.mjs";

const processStartupSafeTimeout = 2_000;
const processKillGrace = 250;

test("process timeout waits for closure and retains captured output", async () => {
  await assert.rejects(
    runProcess(
      process.execPath,
      [
        "-e",
        'process.stdout.write("started\\n"); process.stderr.write("waiting\\n"); setInterval(() => {}, 1_000);',
      ],
      { timeout: processStartupSafeTimeout, killGrace: processKillGrace },
    ),
    (error) => {
      assert.equal(error instanceof ProcessTimeoutError, true);
      assert.equal(error.timeout, processStartupSafeTimeout);
      assert.match(error.stdout, /started/u);
      assert.match(error.stderr, /waiting/u);
      assert.match(error.message, /timed out after 2000 ms/u);
      return true;
    },
  );
});

test("process timeout closes a spawned descendant through the process group", async () => {
  const script = [
    'const { spawn } = require("node:child_process");',
    'spawn(process.execPath, ["-e", "setInterval(() => {}, 1_000)"], { stdio: "inherit" });',
    'process.stdout.write("descendant started\\n");',
    "setInterval(() => {}, 1_000);",
  ].join("\n");
  const startedAt = Date.now();
  await assert.rejects(
    runProcess(process.execPath, ["-e", script], {
      timeout: processStartupSafeTimeout,
      killGrace: processKillGrace,
    }),
    ProcessTimeoutError,
  );
  assert.equal(Date.now() - startedAt < 5_000, true);
});

test("extension inventory reads the file-backed VS Code registry directly", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "perttool-vsix-registry-"));
  try {
    const harnessSource = await readFile(
      new URL("../scripts/check-vsix-host.mjs", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(harnessSource, /--list-extensions/u);
    const registry = [{
      identifier: { id: "perttool-private.perttool-vscode-private" },
      version: "0.0.0",
      relativeLocation: "perttool-private.perttool-vscode-private-0.0.0",
    }];
    await writeFile(
      path.join(directory, "extensions.json"),
      JSON.stringify(registry),
      "utf8",
    );
    assert.deepEqual(await readExtensionRegistry(directory), registry);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("extension inventory rejects a non-array registry", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "perttool-vsix-registry-"));
  try {
    await writeFile(
      path.join(directory, "extensions.json"),
      JSON.stringify({ extensions: [] }),
      "utf8",
    );
    await assert.rejects(
      readExtensionRegistry(directory),
      /extensions\.json must contain an array/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

for (const mode of ["success", "exit-error", "timeout", "retained", "missing", "malformed"]) {
  test(`uninstall acceptance uses inventory readback: ${mode}`, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "perttool-vsix-uninstall-"));
    const registryPath = path.join(directory, "extensions.json");
    const warnings = [];
    try {
      await writeFile(registryPath, JSON.stringify([{ identifier: { id: "perttool-private.perttool-vscode-private" } }]));
      const script = [
        'const fs = require("node:fs");',
        `const registryPath = ${JSON.stringify(registryPath)};`,
        mode === "missing" ? "fs.unlinkSync(registryPath);"
          : mode === "retained" ? ""
            : `fs.writeFileSync(registryPath, ${JSON.stringify(mode === "malformed" ? "invalid" : "[]")});`,
        // No English success message is required, even on a clean exit.
        'process.stdout.write("inventory operation completed\\n");',
        mode === "timeout" ? "setInterval(() => {}, 1_000);"
          : `process.exit(${mode === "exit-error" ? 134 : 0});`,
      ].join("\n");
      const operation = uninstallExtension(process.execPath, ["-e", script, "--"], directory, {
        timeout: processStartupSafeTimeout,
        killGrace: processKillGrace,
        warn: (message) => warnings.push(message),
      });
      if (["retained", "missing", "malformed"].includes(mode)) {
        await assert.rejects(operation);
        assert.deepEqual(warnings, []);
      } else {
        await operation;
        assert.equal(warnings.length, mode === "success" ? 0 : 1);
        if (warnings.length) {
          assert.match(warnings[0], /inventory is empty/u);
          assert.match(warnings[0], mode === "timeout" ? /timed out/u : /exited with 134/u);
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
