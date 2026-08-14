import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
} from "@vscode/test-electron";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vscodeVersion = "1.101.0";
const extensionId = "perttool-private.perttool-vscode-private";
const expectedDirectoryPrefix = `${extensionId}-`;

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repositoryRoot,
      env: {
        ...process.env,
        DONT_PROMPT_WSL_INSTALL: "1",
        ...options.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Timed out: ${command} ${args.join(" ")}`));
    }, options.timeout ?? 120_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (!(options.acceptedExitCodes ?? [0]).includes(code)) {
        reject(
          new Error(
            `${command} exited with ${code ?? signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        );
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

async function writeProfile(profile, trustEnabled) {
  const user = path.join(profile, "User");
  await mkdir(user, { recursive: true });
  const settings = `${JSON.stringify({
    "security.workspace.trust.enabled": trustEnabled,
    "security.workspace.trust.startupPrompt": "never",
    "telemetry.telemetryLevel": "off",
    "[pert]": {
      "editor.defaultFormatter": extensionId,
      "editor.formatOnSave": true,
    },
  }, null, 2)}\n`;
  const settingsPath = path.join(user, "settings.json");
  await writeFile(settingsPath, settings, "utf8");
  return { settingsPath, digest: digest(Buffer.from(settings, "utf8")) };
}

async function installedExtensionPath(extensionsDirectory) {
  const entries = (await readdir(extensionsDirectory)).filter((entry) =>
    entry.startsWith(expectedDirectoryPrefix),
  );
  assert.deepEqual(entries, [`${extensionId}-0.0.0`]);
  return path.join(extensionsDirectory, entries[0]);
}

async function runHost(host, fixture, trust) {
  const testsPath = path.join(repositoryRoot, "scripts", "vsix-host-tests.cjs");
  const args = [
    fixture.workspace,
    "--no-sandbox",
    "--disable-gpu-sandbox",
    "--disable-updates",
    "--skip-welcome",
    "--skip-release-notes",
    "--no-cached-data",
    "--disable-extensions",
    `--extensionTestsPath=${testsPath}`,
    `--extensionDevelopmentPath=${host.extensionPath}`,
    `--user-data-dir=${host.profile}`,
    `--extensions-dir=${host.extensionsDirectory}`,
  ];
  if (trust === "trusted") args.push("--disable-workspace-trust");
  const result = await runProcess(host.executable, args, {
    env: {
      PERTTOOL_HOST_EXPECTED_TRUST: trust,
      PERTTOOL_HOST_FORMAT_ON_SAVE_FILE: fixture.formatOnSaveFile,
      PERTTOOL_HOST_WORKSPACE_FILE: fixture.workspaceFile,
      PERTTOOL_HOST_REPAIR_FILE: fixture.repairFile,
    },
  });
  assert.match(
    result.stdout,
    new RegExp(`perttool VSIX host acceptance passed \\(${trust}\\)`),
  );
}

async function prepareWorkspace(temporaryRoot) {
  const workspace = path.join(temporaryRoot, "workspace");
  const workspaceFile = path.join(workspace, "plan.pert");
  const trustedFormatFile = path.join(workspace, "format-trusted.pert");
  const untrustedFormatFile = path.join(workspace, "format-untrusted.pert");
  const repairFile = path.join(workspace, "repair.pert");
  await mkdir(workspace, { recursive: true });
  await cp(path.join(repositoryRoot, "docs", "examples", "minimal.pert"), workspaceFile);
  const canonical = await readFile(workspaceFile, "utf8");
  const formatSource = `\uFEFF# Café Ω\r\n${canonical.replaceAll("\n", "\r\n")}`
    .replace("duration 1d", "duration 1.0d");
  const expectedFormatted = formatSource.replace("duration 1.0d", "duration 1d");
  await writeFile(trustedFormatFile, formatSource, "utf8");
  await writeFile(untrustedFormatFile, formatSource, "utf8");
  const repairSource = [
    "project HOST_REPAIR:",
    "  version 6",
    '  title "Supported-host E1 repair"',
    "  duration_unit day",
    "  velocity 2p/1d",
    "  finish DONE",
    "  plan_assurance_model 1",
    "  plan_assurance_hash_model 1",
    "",
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone DONE:",
    '  title "Done"',
    "",
    "task WORK START -> DONE:",
    '  title "Work"',
    "  duration 1d",
    "",
  ].join("\n");
  await writeFile(repairFile, repairSource, "utf8");
  await runProcess("git", ["init", "--quiet"], { cwd: workspace });
  await runProcess("git", ["add", "--", "plan.pert"], { cwd: workspace });
  await runProcess("git", [
    "-c",
    "user.name=perttool acceptance",
    "-c",
    "user.email=acceptance@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "historical VSIX fixture",
  ], { cwd: workspace });
  return {
    workspace,
    workspaceFile,
    trustedFormatFile,
    untrustedFormatFile,
    repairFile,
    formatSource,
    expectedFormatted,
    sourceBefore: await readFile(workspaceFile),
    repairBefore: await readFile(repairFile),
    entriesBefore: await readdir(workspace),
  };
}

async function installExtension(
  cli,
  extensionArgs,
  vsixPath,
  extensionsDirectory,
) {
  await runProcess(cli, [
    ...extensionArgs,
    "--install-extension",
    path.resolve(vsixPath),
    "--force",
  ]);
  return installedExtensionPath(extensionsDirectory);
}

async function assertInstalledExtension(cli, extensionArgs) {
  const listed = await runProcess(cli, [
    ...extensionArgs,
    "--list-extensions",
    "--show-versions",
  ]);
  assert.deepEqual(
    listed.stdout.trim().split(/\r?\n/u).filter(Boolean),
    [`${extensionId}@0.0.0`],
  );
}

async function acceptHostProfile(
  temporaryRoot,
  executable,
  extensionsDirectory,
  extensionPath,
  fixture,
  trust,
) {
  const profile = path.join(temporaryRoot, `${trust}-profile`);
  const settings = await writeProfile(profile, trust === "untrusted");
  const formatOnSaveFile = trust === "trusted"
    ? fixture.trustedFormatFile
    : fixture.untrustedFormatFile;
  await runHost(
    { executable, extensionPath, extensionsDirectory, profile },
    { ...fixture, formatOnSaveFile },
    trust,
  );
  assert.equal(digest(await readFile(settings.settingsPath)), settings.digest);
}

async function uninstallExtension(cli, extensionArgs, isWsl) {
  const uninstall = await runProcess(cli, [
    ...extensionArgs,
    "--uninstall-extension",
    extensionId,
  ], {
    // The unsupported standalone Linux desktop build can abort after its
    // CLI has completed uninstall under WSL. Accept that post-success signal
    // only on WSL and require an independent clean registry readback below.
    acceptedExitCodes: isWsl ? [0, 134] : [0],
  });
  if (uninstall.code === 134) {
    assert.match(uninstall.stdout, /was successfully uninstalled/iu);
  }
  const afterUninstall = await runProcess(cli, [
    ...extensionArgs,
    "--list-extensions",
    "--show-versions",
  ]);
  assert.equal(afterUninstall.stdout.trim(), "");
}

async function main() {
  const [vsixPath] = process.argv.slice(2);
  if (!vsixPath) throw new Error("usage: check-vsix-host.mjs <vsix-path>");

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "perttool-vsix-host-"));
  try {
    const cachePath =
      process.env.PERTTOOL_VSCODE_CACHE ??
      path.join(tmpdir(), "perttool-vscode-test-cache");
    const executable = await downloadAndUnzipVSCode({
      version: vscodeVersion,
      cachePath,
    });
    const [cli, ...cliPrefix] = resolveCliArgsFromVSCodeExecutablePath(executable, {
      reuseMachineInstall: true,
    });
    const extensionsDirectory = path.join(temporaryRoot, "extensions");
    const managementProfile = path.join(temporaryRoot, "management-profile");
    await mkdir(extensionsDirectory, { recursive: true });
    const fixture = await prepareWorkspace(temporaryRoot);
    const isWsl = /microsoft/iu.test(
      await readFile("/proc/version", "utf8").catch(() => ""),
    );

    const extensionArgs = [
      ...cliPrefix,
      `--user-data-dir=${managementProfile}`,
      `--extensions-dir=${extensionsDirectory}`,
    ];
    let installedPath = await installExtension(
      cli,
      extensionArgs,
      vsixPath,
      extensionsDirectory,
    );
    await assertInstalledExtension(cli, extensionArgs);
    await acceptHostProfile(
      temporaryRoot,
      executable,
      extensionsDirectory,
      installedPath,
      fixture,
      "trusted",
    );
    assert.equal(
      await readFile(fixture.trustedFormatFile, "utf8"),
      fixture.expectedFormatted,
    );
    assert.equal(
      await readFile(fixture.untrustedFormatFile, "utf8"),
      fixture.formatSource,
    );

    installedPath = await installExtension(
      cli,
      extensionArgs,
      vsixPath,
      extensionsDirectory,
    );
    await acceptHostProfile(
      temporaryRoot,
      executable,
      extensionsDirectory,
      installedPath,
      fixture,
      "untrusted",
    );
    assert.deepEqual(await readdir(fixture.workspace), fixture.entriesBefore);
    assert.equal(
      digest(await readFile(fixture.workspaceFile)),
      digest(fixture.sourceBefore),
    );
    assert.equal(
      digest(await readFile(fixture.repairFile)),
      digest(fixture.repairBefore),
    );
    assert.equal(
      await readFile(fixture.trustedFormatFile, "utf8"),
      fixture.expectedFormatted,
    );
    assert.equal(
      await readFile(fixture.untrustedFormatFile, "utf8"),
      fixture.expectedFormatted,
    );
    await uninstallExtension(cli, extensionArgs, isWsl);

    process.stdout.write(
      `supported VS Code ${vscodeVersion} trusted/untrusted install, host, replacement, and uninstall acceptance passed\n`,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

await main();
