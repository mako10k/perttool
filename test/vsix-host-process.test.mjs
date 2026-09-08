import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ProcessTimeoutError,
  runExtensionInventory,
  runProcess,
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

test("extension inventory retries one typed timeout after process closure", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "perttool-vsix-retry-"));
  const marker = path.join(directory, "attempted");
  const retries = [];
  try {
    const script = [
      'const fs = require("node:fs");',
      "const marker = process.argv[1];",
      "if (!fs.existsSync(marker)) {",
      '  fs.writeFileSync(marker, "first\\n");',
      '  process.stderr.write("first attempt waiting\\n");',
      "  setInterval(() => {}, 1_000);",
      "} else {",
      '  process.stdout.write("perttool-private.perttool-vscode-private@0.0.0\\n");',
      "}",
    ].join("\n");
    const result = await runExtensionInventory(
      process.execPath,
      ["-e", script, marker],
      {
        timeout: processStartupSafeTimeout,
        killGrace: processKillGrace,
        onRetry(message, error) {
          retries.push({ message, error });
        },
      },
    );
    assert.equal(
      result.stdout.trim(),
      "perttool-private.perttool-vscode-private@0.0.0",
    );
    assert.equal(retries.length, 1);
    assert.equal(retries[0].error instanceof ProcessTimeoutError, true);
    assert.match(retries[0].message, /retrying once after process closure/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("extension inventory does not retry an ordinary process failure", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "perttool-vsix-failure-"));
  const marker = path.join(directory, "attempts");
  try {
    const script = [
      'const fs = require("node:fs");',
      "const marker = process.argv[1];",
      'fs.appendFileSync(marker, "attempt\\n");',
      'process.stderr.write("ordinary failure\\n");',
      "process.exit(17);",
    ].join("\n");
    await assert.rejects(
      runExtensionInventory(process.execPath, ["-e", script, marker], {
        timeout: 5_000,
        killGrace: processKillGrace,
      }),
      /exited with 17/u,
    );
    assert.equal((await readFile(marker, "utf8")).trim(), "attempt");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
