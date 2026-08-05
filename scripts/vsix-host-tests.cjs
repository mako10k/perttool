const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const vscode = require("vscode");

const extensionId = "perttool-private.perttool-vscode-private";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor(label, probe, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await probe();
    if (value) return value;
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function documentSymbols(document) {
  return vscode.commands.executeCommand(
    "vscode.executeDocumentSymbolProvider",
    document.uri,
  );
}

function countSymbols(symbols) {
  return symbols.reduce(
    (count, symbol) => count + 1 + countSymbols(symbol.children ?? []),
    0,
  );
}

function largePlan(taskCount) {
  const lines = [
    "project HOST_LARGE:",
    "  version 6",
    "  title \"Large host graph\"",
    "  duration_unit day",
    `  finish M${taskCount}`,
    "",
    "milestone M0:",
    "  title \"Start\"",
    "  state reached",
  ];
  for (let index = 1; index <= taskCount; index += 1) {
    lines.push("", `milestone M${index}:`, `  title \"Milestone ${index}\"`);
  }
  for (let index = 1; index <= taskCount; index += 1) {
    lines.push(
      "",
      `task T${index} M${index - 1} -> M${index}:`,
      `  title \"Task ${index}\"`,
      "  duration 1d",
    );
  }
  return `${lines.join("\n")}\n`;
}

async function openVirtualPert(content) {
  const document = await vscode.workspace.openTextDocument({
    language: "pert",
    content,
  });
  await vscode.window.showTextDocument(document, { preview: false });
  return document;
}

async function run() {
  const expectedTrust = process.env.PERTTOOL_HOST_EXPECTED_TRUST;
  const workspaceFile = process.env.PERTTOOL_HOST_WORKSPACE_FILE;
  assert.ok(expectedTrust === "trusted" || expectedTrust === "untrusted");
  assert.ok(workspaceFile);
  assert.equal(vscode.version, "1.101.0");
  assert.ok(Number.parseInt(process.versions.node, 10) >= 22);
  assert.equal(vscode.workspace.isTrusted, expectedTrust === "trusted");

  const extension = vscode.extensions.getExtension(extensionId);
  assert.ok(extension, `Missing installed extension ${extensionId}`);
  assert.equal(extension.packageJSON.version, "0.0.0");

  const source = await fs.readFile(workspaceFile, "utf8");
  const document = await vscode.workspace.openTextDocument(workspaceFile);
  await vscode.window.showTextDocument(document, { preview: false });
  assert.equal(document.languageId, "pert");

  await extension.activate();
  assert.equal(extension.isActive, true);
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes("perttool.openHelp"));
  assert.ok(commands.includes("perttool.showDag"));

  const symbols = await waitFor("workspace document symbols", async () => {
    const result = await documentSymbols(document);
    return Array.isArray(result) && result.length > 0 ? result : null;
  });
  assert.ok(symbols.length > 0);
  assert.equal(
    vscode.languages.getDiagnostics(document.uri).some(
      (diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error,
    ),
    false,
  );
  const workPosition = document.positionAt(source.indexOf("WORK") + 1);
  const definitions = await waitFor("workspace definition navigation", async () => {
    const result = await vscode.commands.executeCommand(
      "vscode.executeDefinitionProvider",
      document.uri,
      workPosition,
    );
    return Array.isArray(result) && result.length > 0 ? result : null;
  });
  assert.equal(definitions[0].uri.toString(), document.uri.toString());
  await vscode.commands.executeCommand("perttool.showDag");

  const virtual = await openVirtualPert(source);
  const virtualSymbols = await waitFor("virtual document symbols", async () => {
    const result = await documentSymbols(virtual);
    return Array.isArray(result) && result.length > 0 ? result : null;
  });
  assert.ok(virtualSymbols.length > 0);

  const virtualEditor = vscode.window.activeTextEditor;
  assert.ok(virtualEditor);
  const firstRefresh = vscode.commands.executeCommand("perttool.showDag");
  await virtualEditor.edit((builder) => {
    builder.insert(new vscode.Position(virtual.lineCount, 0), "# rapid edit\n");
  });
  const secondRefresh = vscode.commands.executeCommand("perttool.showDag");
  await Promise.all([firstRefresh, secondRefresh]);

  const empty = await openVirtualPert(
    "project HOST_EMPTY:\n" +
      "  version 6\n" +
      "  title \"Empty host graph\"\n" +
      "  duration_unit point\n" +
      "  finish NOW\n\n" +
      "milestone NOW:\n" +
      "  title \"Now\"\n" +
      "  state reached\n",
  );
  assert.equal(empty.languageId, "pert");
  await delay(100);
  await vscode.commands.executeCommand("perttool.showDag");

  const large = await openVirtualPert(largePlan(128));
  await waitFor("large graph document symbols", async () => {
    const result = await documentSymbols(large);
    return Array.isArray(result) && countSymbols(result) >= 128 ? result : null;
  }, 30_000);
  await vscode.commands.executeCommand("perttool.showDag");

  const invalid = await openVirtualPert("not a PERT document\n");
  const diagnostics = await waitFor("invalid document diagnostics", () => {
    const current = vscode.languages.getDiagnostics(invalid.uri);
    return current.length > 0 ? current : null;
  });
  const actions = await vscode.commands.executeCommand(
    "vscode.executeCodeActionProvider",
    invalid.uri,
    diagnostics[0].range,
  );
  assert.ok(Array.isArray(actions) && actions.length > 0);
  const helpAction = actions.find((action) => action.command?.command === "perttool.openHelp");
  assert.ok(helpAction?.command);
  await vscode.commands.executeCommand(
    helpAction.command.command,
    ...(helpAction.command.arguments ?? []),
  );
  const helpDocument = await waitFor("virtual Help document", () => {
    const active = vscode.window.activeTextEditor?.document;
    return active?.uri.scheme === "perttool-help" ? active : null;
  });
  assert.equal(helpDocument.isDirty, false);
  assert.match(helpDocument.getText(), /perttool|syntax|document/iu);

  assert.equal(document.isDirty, false);
  assert.equal(await fs.readFile(workspaceFile, "utf8"), source);

  if (typeof extension.exports?.deactivate === "function") {
    await extension.exports.deactivate();
  }
  process.stdout.write(`perttool VSIX host acceptance passed (${expectedTrust})\n`);
}

module.exports = { run };
