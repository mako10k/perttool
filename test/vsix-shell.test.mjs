import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("VSIX shell cases are complete and dependency ordered", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/vsix-shell-cases-v1.json"),
  );
  assert.equal(fixture.schema_version, "Perttool.VsixShellCases.v1");
  assert.equal(fixture.editor_protocol_model_version, 1);
  assert.equal(fixture.vscode_engine, "^1.101.0");
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
      { length: 10 },
      (_, index) => `VSXS-${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("VSIX manifest retains the private shell while adding the accepted DAG view", async () => {
  const [manifestText, grammarText, configurationText, iconBytes] = await Promise.all([
    repositoryText("adapters/vscode/package.json"),
    repositoryText("adapters/vscode/syntaxes/pert.tmLanguage.json"),
    repositoryText("adapters/vscode/language-configuration.json"),
    readFile(path.join(root, "adapters/vscode/icon.png")),
  ]);
  const manifest = JSON.parse(manifestText);
  const grammar = JSON.parse(grammarText);
  const configuration = JSON.parse(configurationText);
  assert.equal(manifest.private, true);
  assert.equal(manifest.version, "0.0.0");
  assert.equal(manifest.engines.vscode, "^1.101.0");
  assert.deepEqual(manifest.extensionKind, ["workspace"]);
  assert.deepEqual(manifest.capabilities, {
    untrustedWorkspaces: { supported: true },
    virtualWorkspaces: { supported: true },
  });
  assert.deepEqual(manifest.activationEvents, [
    "onLanguage:pert",
    "onCommand:perttool.openHelp",
    "onCommand:perttool.showDag",
    "onView:perttool.dag",
  ]);
  assert.equal(manifest.devDependencies["vscode-languageclient"], "9.0.1");
  assert.equal(manifest.icon, "icon.png");
  assert.equal(manifest.files.includes("icon.png"), true);
  assert.deepEqual(iconBytes.subarray(0, 8), Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]));
  assert.equal(iconBytes.readUInt32BE(16) >= 256, true);
  assert.equal(iconBytes.readUInt32BE(20) >= 256, true);
  assert.deepEqual(manifest.dependencies ?? {}, {});
  assert.equal(manifest.contributes.languages[0].id, "pert");
  assert.deepEqual(manifest.contributes.languages[0].extensions, [".pert"]);
  assert.equal(manifest.contributes.grammars[0].scopeName, "source.pert");
  assert.equal(grammar.scopeName, "source.pert");
  assert.equal(configuration.comments.lineComment, "#");
  assert.equal(manifest.contributes.views.explorer[0].id, "perttool.dag");
});

test("VSIX client retains handshake, Help, DAG presentation, and bundled stdio", async () => {
  const [extension, bindings, build, gate, rootManifestText] = await Promise.all([
    repositoryText("adapters/vscode/src/extension.ts"),
    repositoryText("adapters/vscode/src/bindings.ts"),
    repositoryText("adapters/vscode/scripts/build.mjs"),
    repositoryText("scripts/check-vsix-shell.sh"),
    repositoryText("package.json"),
  ]);
  const rootManifest = JSON.parse(rootManifestText);
  assert.match(extension, /TransportKind\.stdio/u);
  assert.match(extension, /documentSelector: \[\{ language: "pert" \}\]/u);
  assert.match(extension, /isTrusted: false/u);
  assert.match(extension, /registerTextDocumentContentProvider/u);
  assert.match(extension, /registerWebviewViewProvider/u);
  assert.match(extension, /document\.version === args\.documentVersion/u);
  assert.match(bindings, /Perttool\.EditorHelpResult\.v1/u);
  assert.match(bindings, /Perttool\.GraphViewResult\.v1/u);
  assert.match(build, /\.\.\/lsp\/runtime\/main\.ts/u);
  assert.match(build, /external: \["vscode"\]/u);
  assert.equal(/node:fs|node:net|node:http/u.test(extension), false);
  assert.match(extension, /DagViewProvider/u);
  assert.match(gate, /check-lsp-isolated\.mjs/u);
  assert.match(rootManifest.scripts.check, /check:vsix-shell/u);
  const mode = (await stat(path.join(root, "scripts/check-vsix-shell.sh"))).mode;
  assert.notEqual(mode & 0o111, 0);
});

test("VSIX protocol bindings reject stale, open, and malformed values", async () => {
  const bindings = await import(
    `${pathToFileURL(path.join(root, "adapters/vscode/dist/bindings.mjs")).href}?test`
  );
  const args = {
    documentUri: "untitled:plan",
    documentGeneration: "generation-1",
    documentVersion: 3,
    topicId: "syntax.task",
  };
  assert.deepEqual(bindings.parseOpenHelpCommandArgs(args), args);
  assert.equal(
    bindings.parseOpenHelpCommandArgs({ ...args, unknown: true }),
    null,
  );
  assert.equal(
    bindings.graphBindingMatches(
      {
        schemaVersion: "Perttool.GraphViewResult.v1",
        editorProtocolModelVersion: 1,
        document: {
          uri: args.documentUri,
          generation: args.documentGeneration,
          version: args.documentVersion,
        },
      },
      args,
    ),
    true,
  );
  assert.equal(
    bindings.graphBindingMatches(
      {
        schemaVersion: "Perttool.GraphViewResult.v1",
        editorProtocolModelVersion: 1,
        document: {
          uri: args.documentUri,
          generation: "generation-2",
          version: args.documentVersion,
        },
      },
      args,
    ),
    false,
  );
  const help = {
    schemaVersion: "Perttool.EditorHelpResult.v1",
    editorProtocolModelVersion: 1,
    status: "ok",
    topicId: args.topicId,
    level: "detail",
    content: { kind: "markdown", value: "Task Help" },
    relatedTopicIds: [],
  };
  assert.deepEqual(bindings.parseEditorHelpResult(help), help);
  assert.equal(
    bindings.parseEditorHelpResult({ ...help, content: null }),
    null,
  );
});

test("VSIX shell acceptance is bound to the completed plan snapshot", async () => {
  const [record, plan] = await Promise.all([
    repositoryText("docs/process/adapter-vsix-shell-acceptance.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  assert.match(record, /Document status: Accepted 1\.0/u);
  assert.match(
    record,
    /sha256:8b6d6ed28af90495ae7937242b1197528c2ad2afdfb63fd682608f4c54e1ff9c/u,
  );
  assert.match(
    record,
    /recommends and makes startable only `NODE_PORT_BOUNDARY`/u,
  );
  assert.match(
    plan,
    /task VSIX_SHELL[\s\S]*?status done[\s\S]*?task VSIX_DAG_VIEW/u,
  );
});
