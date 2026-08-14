import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function handshake(editorProtocolModelVersion) {
  return {
    perttool: {
      editorProtocolModelVersion,
      graphViewResultSchemaVersion: "Perttool.GraphViewResult.v1",
      editorHelpResultSchemaVersion: "Perttool.EditorHelpResult.v1",
    },
  };
}

test("eighteen E0 VSIX acceptance cases are complete and dependency ordered", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/editor-format-acceptance-v1.json"),
  );
  assert.equal(fixture.schema_version, "Perttool.EditorFormatAcceptanceCases.v1");
  assert.deepEqual(fixture.offered_editor_protocol_model_versions, [2, 1]);
  assert.equal(fixture.selected_editor_protocol_model_version, 2);
  assert.equal(fixture.compatible_editor_protocol_model_version, 1);
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
      { length: 18 },
      (_, index) => `EFA-${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("VSIX offers model 2 first while retaining model 1 result compatibility", async () => {
  const bindings = await import(
    `${pathToFileURL(path.join(root, "adapters/vscode/dist/bindings.mjs")).href}?format-acceptance`
  );
  assert.deepEqual([...bindings.editorProtocolModelVersions], [2, 1]);
  assert.equal(bindings.editorProtocolModelVersion, 1);
  assert.equal(bindings.editorMutationProtocolModelVersion, 2);
  assert.equal(bindings.hasAcceptedEditorHandshake(handshake(2)), true);
  assert.equal(bindings.hasAcceptedEditorMutationHandshake(handshake(2)), true);
  assert.equal(bindings.hasAcceptedEditorHandshake(handshake(1)), true);
  assert.equal(bindings.hasAcceptedEditorMutationHandshake(handshake(1)), false);
  assert.equal(bindings.hasAcceptedEditorHandshake(handshake(3)), false);
});

test("VSIX delegates only whole-document E0 formatting through negotiated LSP", async () => {
  const [extension, manifestText, host, gate] = await Promise.all([
    repositoryText("adapters/vscode/src/extension.ts"),
    repositoryText("adapters/vscode/package.json"),
    repositoryText("scripts/vsix-host-tests.cjs"),
    repositoryText("scripts/check-vsix-host.mjs"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.match(extension, /editorProtocolModelVersions/u);
  assert.match(extension, /hasAcceptedEditorMutationHandshake/u);
  assert.match(extension, /provideDocumentFormattingEdits/u);
  assert.equal(/registerDocumentFormattingEditProvider/u.test(extension), false);
  assert.equal(manifest.contributes.configuration, undefined);
  assert.equal(manifest.contributes.commands.some(({ command }) =>
    /format|repair|mutation/iu.test(command)), false);
  assert.match(host, /vscode\.executeFormatDocumentProvider/u);
  assert.match(gate, /editor\.formatOnSave/u);
  assert.match(host, /vscode\.executeFormatRangeProvider/u);
  assert.match(host, /not a PERT document/u);
  assert.match(gate, /# Café Ω/u);
  assert.match(gate, /duration 1\.0d/u);
  assert.match(gate, /format-trusted\.pert/u);
  assert.match(gate, /format-untrusted\.pert/u);
});

test("format acceptance keeps direct persistence and external mutation out of the extension", async () => {
  const [extension, host, gate, shell] = await Promise.all([
    repositoryText("adapters/vscode/src/extension.ts"),
    repositoryText("scripts/vsix-host-tests.cjs"),
    repositoryText("scripts/check-vsix-host.mjs"),
    repositoryText("scripts/check-vsix-shell.sh"),
  ]);
  assert.equal(/node:fs|node:child_process|\bgit\b|npm publish|vsce publish/iu.test(extension), false);
  assert.match(host, /vscode\.workspace\.applyEdit/u);
  assert.match(host, /formatDocument\.save\(\)/u);
  assert.match(gate, /digest\(await readFile\(workspaceFile\)\), digest\(sourceBefore\)/u);
  assert.match(gate, /trustedSettings\.settingsPath/u);
  assert.match(gate, /untrustedSettings\.settingsPath/u);
  assert.match(shell, /package:vsix/u);
  assert.match(shell, /node_modules\|media/u);
});
