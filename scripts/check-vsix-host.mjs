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

async function runHost({
  executable,
  extensionPath,
  extensionsDirectory,
  profile,
  workspace,
  workspaceFile,
  trust,
}) {
  const testsPath = path.join(repositoryRoot, "scripts", "vsix-host-tests.cjs");
  const args = [
    workspace,
    "--no-sandbox",
    "--disable-gpu-sandbox",
    "--disable-updates",
    "--skip-welcome",
    "--skip-release-notes",
    "--no-cached-data",
    "--disable-extensions",
    `--extensionTestsPath=${testsPath}`,
    `--extensionDevelopmentPath=${extensionPath}`,
    `--user-data-dir=${profile}`,
    `--extensions-dir=${extensionsDirectory}`,
  ];
  if (trust === "trusted") args.push("--disable-workspace-trust");
  const result = await runProcess(executable, args, {
    env: {
      PERTTOOL_HOST_EXPECTED_TRUST: trust,
      PERTTOOL_HOST_WORKSPACE_FILE: workspaceFile,
    },
  });
  assert.match(
    result.stdout,
    new RegExp(`perttool VSIX host acceptance passed \\(${trust}\\)`),
  );
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
    const workspace = path.join(temporaryRoot, "workspace");
    const workspaceFile = path.join(workspace, "plan.pert");
    await mkdir(extensionsDirectory, { recursive: true });
    await mkdir(workspace, { recursive: true });
    await cp(path.join(repositoryRoot, "docs", "examples", "minimal.pert"), workspaceFile);
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
    const sourceBefore = await readFile(workspaceFile);
    const entriesBefore = await readdir(workspace);
    const isWsl = /microsoft/iu.test(
      await readFile("/proc/version", "utf8").catch(() => ""),
    );

    const extensionArgs = [
      ...cliPrefix,
      `--user-data-dir=${managementProfile}`,
      `--extensions-dir=${extensionsDirectory}`,
    ];
    await runProcess(cli, [
      ...extensionArgs,
      "--install-extension",
      path.resolve(vsixPath),
      "--force",
    ]);
    let installedPath = await installedExtensionPath(extensionsDirectory);

    const listed = await runProcess(cli, [
      ...extensionArgs,
      "--list-extensions",
      "--show-versions",
    ]);
    assert.deepEqual(
      listed.stdout.trim().split(/\r?\n/u).filter(Boolean),
      [`${extensionId}@0.0.0`],
    );

    const trustedProfile = path.join(temporaryRoot, "trusted-profile");
    const trustedSettings = await writeProfile(trustedProfile, false);
    await runHost({
      executable,
      extensionPath: installedPath,
      extensionsDirectory,
      profile: trustedProfile,
      workspace,
      workspaceFile,
      trust: "trusted",
    });
    assert.equal(digest(await readFile(trustedSettings.settingsPath)), trustedSettings.digest);

    await runProcess(cli, [
      ...extensionArgs,
      "--install-extension",
      path.resolve(vsixPath),
      "--force",
    ]);
    installedPath = await installedExtensionPath(extensionsDirectory);

    const untrustedProfile = path.join(temporaryRoot, "untrusted-profile");
    const untrustedSettings = await writeProfile(untrustedProfile, true);
    await runHost({
      executable,
      extensionPath: installedPath,
      extensionsDirectory,
      profile: untrustedProfile,
      workspace,
      workspaceFile,
      trust: "untrusted",
    });
    assert.equal(digest(await readFile(untrustedSettings.settingsPath)), untrustedSettings.digest);

    assert.deepEqual(await readdir(workspace), entriesBefore);
    assert.equal(digest(await readFile(workspaceFile)), digest(sourceBefore));

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

    process.stdout.write(
      `supported VS Code ${vscodeVersion} trusted/untrusted install, host, replacement, and uninstall acceptance passed\n`,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

await main();
