import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("VSIX acceptance cases are complete and dependency ordered", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/vsix-acceptance-cases-v1.json"),
  );
  assert.equal(fixture.schema_version, "Perttool.VsixAcceptanceCases.v1");
  assert.equal(fixture.editor_protocol_model_version, 1);
  assert.equal(fixture.vscode_version, "1.101.0");
  const accepted = new Set();
  for (const acceptanceCase of fixture.cases) {
    assert.equal(
      acceptanceCase.depends_on.every((id) => accepted.has(id)),
      true,
      acceptanceCase.id,
    );
    accepted.add(acceptanceCase.id);
  }
  assert.deepEqual(
    [...accepted],
    Array.from(
      { length: 12 },
      (_, index) => `VSXA-${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("repository gate runs the exact supported VS Code host workflow", async () => {
  const [rootManifestText, extensionManifestText, shell, host] = await Promise.all([
    repositoryText("package.json"),
    repositoryText("adapters/vscode/package.json"),
    repositoryText("scripts/check-vsix-shell.sh"),
    repositoryText("scripts/check-vsix-host.mjs"),
  ]);
  const rootManifest = JSON.parse(rootManifestText);
  const extensionManifest = JSON.parse(extensionManifestText);
  assert.equal(extensionManifest.devDependencies["@vscode/test-electron"], "3.1.0");
  assert.match(rootManifest.scripts.check, /check:vsix-shell/u);
  assert.match(shell, /check-vsix-host\.mjs/u);
  assert.match(shell, /xvfb-run/u);
  assert.match(host, /const vscodeVersion = "1\.101\.0"/u);
  assert.match(host, /--install-extension/u);
  assert.match(host, /--uninstall-extension/u);
  assert.match(host, /--disable-workspace-trust/u);
  assert.match(host, /PERTTOOL_HOST_EXPECTED_TRUST/u);
  const mode = (await stat(path.join(root, "scripts/check-vsix-shell.sh"))).mode;
  assert.notEqual(mode & 0o111, 0);
});

test("host probe covers activation, server, virtual documents, DAG load, and Help", async () => {
  const probe = await repositoryText("scripts/vsix-host-tests.cjs");
  assert.match(probe, /vscode\.version, "1\.101\.0"/u);
  assert.match(probe, /process\.versions\.node/u);
  assert.match(probe, /workspace\.isTrusted/u);
  assert.match(probe, /extension\.activate\(\)/u);
  assert.match(probe, /vscode\.executeDocumentSymbolProvider/u);
  assert.match(probe, /vscode\.executeDefinitionProvider/u);
  assert.match(probe, /vscode\.executeCodeActionProvider/u);
  assert.match(probe, /uri\.scheme === "perttool-help"/u);
  assert.match(probe, /largePlan\(128\)/u);
  assert.match(probe, /const firstRefresh/u);
  assert.match(probe, /perttool\.showDag/u);
  assert.match(probe, /extension\.exports\?\.deactivate/u);
});

test("installed host gate preserves workspace bytes and uses disposable profiles", async () => {
  const host = await repositoryText("scripts/check-vsix-host.mjs");
  assert.match(host, /mkdtemp\(path\.join\(tmpdir\(\), "perttool-vsix-host-"\)\)/u);
  assert.match(host, /telemetry\.telemetryLevel/u);
  assert.match(host, /digest\(await readFile\(workspaceFile\)\), digest\(sourceBefore\)/u);
  assert.match(host, /await readdir\(workspace\), entriesBefore/u);
  assert.match(host, /await rm\(temporaryRoot, \{ recursive: true, force: true \}\)/u);
  assert.equal(/git |git\.|npm publish|vsce publish/iu.test(host), false);
});

test("VSIX acceptance record and completed lifecycle remain aligned", async () => {
  const [record, plan] = await Promise.all([
    repositoryText("docs/process/adapter-vsix-acceptance.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  assert.match(record, /Document status: Accepted 1\.0/u);
  assert.match(record, /Task: `VSIX_ACCEPTANCE`/u);
  assert.match(record, /WE-e091d3f8d771278f1c3b97d6870e404d5bca6322b3cac1f7bf582e07d1788b51/u);
  assert.match(record, /WE-c3701dd563e124a896c56c563f698a20acd8be7092b1719d731b7d34fbb27409/u);
  assert.match(plan, /task VSIX_ACCEPTANCE[\s\S]*?status done/u);
  assert.match(plan, /work_event WE-c3701dd563e124a896c56c563f698a20acd8be7092b1719d731b7d34fbb27409:/u);
});
