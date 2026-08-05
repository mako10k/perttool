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

test("LSP acceptance cases are complete and dependency ordered", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/lsp-acceptance-cases-v1.json"),
  );
  assert.equal(fixture.schema_version, "Perttool.LspAcceptanceCases.v1");
  assert.deepEqual(fixture.runtime_matrix, [22, 24]);
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
      (_, index) => `LSPA-${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("private LSP package is installable beside the exact accepted Core", async () => {
  const [manifestText, rootManifestText, packageGate, smoke] = await Promise.all([
    repositoryText("adapters/lsp/package.json"),
    repositoryText("package.json"),
    repositoryText("scripts/check-lsp-package.sh"),
    repositoryText("scripts/check-lsp-isolated.mjs"),
  ]);
  const manifest = JSON.parse(manifestText);
  const rootManifest = JSON.parse(rootManifestText);
  assert.equal(manifest.private, true);
  assert.deepEqual(manifest.files, ["dist"]);
  assert.equal(manifest.peerDependencies.perttool, rootManifest.version);
  assert.equal(manifest.devDependencies.perttool, "file:../..");
  assert.equal(manifest.dependencies["vscode-languageserver"], "9.0.1");
  assert.match(packageGate, /npm pack --silent/u);
  assert.match(packageGate, /--workspace perttool-language-server-private/u);
  assert.match(packageGate, /--ignore-scripts/u);
  assert.match(packageGate, /PERTTOOL_NODE_BINARY/u);
  assert.match(packageGate, /check-lsp-isolated\.mjs/u);
  assert.match(smoke, /perttool\/graphView/u);
  assert.match(smoke, /analysisMode: "both"/u);
  assert.equal(/node:fs|node:net|node:http/u.test(smoke), false);
  const mode = (await stat(path.join(root, "scripts/check-lsp-package.sh"))).mode;
  assert.notEqual(mode & 0o111, 0);
});

test("LSP acceptance record is bound to the completed plan snapshot", async () => {
  const [record, plan] = await Promise.all([
    repositoryText("docs/process/adapter-lsp-acceptance.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  assert.match(record, /Document status: Accepted 1\.0/u);
  assert.match(
    record,
    /sha256:072c05fa5b0d8e0c014fa5616bc140b3ab88bbabf7c039fef816e2c3f30d9382/u,
  );
  assert.match(record, /recommends and makes startable only\n`VSIX_SHELL`/u);
  assert.match(
    plan,
    /task LSP_ACCEPTANCE[\s\S]*?status done[\s\S]*?task VSIX_SHELL/u,
  );
});
