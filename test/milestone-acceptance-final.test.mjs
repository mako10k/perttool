import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as packageRoot from "../dist/index.js";
import * as nodeFacade from "../dist/node/index.js";
import * as core from "../dist/core/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("final milestone acceptance cases are complete and dependency ordered", async () => {
  const fixture = JSON.parse(
    await repositoryText("test/fixtures/milestone-acceptance-final-v1.json"),
  );
  assert.equal(
    fixture.schema_version,
    "Perttool.MilestoneAcceptanceFinalCases.v1",
  );
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
    Array.from({ length: 16 }, (_, index) =>
      `MAF-${String(index + 1).padStart(3, "0")}`
    ),
  );
});

test("normative and technical acceptance records cover every semantic owner", async () => {
  const [contract, source, coreRecord, mutation, advance, publicRecord, history, adapter, finalRecord] =
    await Promise.all([
      repositoryText("docs/process/milestone-acceptance-contract-acceptance.md"),
      repositoryText("docs/process/milestone-acceptance-source-acceptance.md"),
      repositoryText("docs/process/milestone-acceptance-core-acceptance.md"),
      repositoryText("docs/process/milestone-acceptance-mutation-acceptance.md"),
      repositoryText("docs/process/milestone-acceptance-advance-acceptance.md"),
      repositoryText("docs/process/milestone-acceptance-public-contract-acceptance.md"),
      repositoryText("docs/process/milestone-acceptance-history-acceptance.md"),
      repositoryText("docs/process/milestone-acceptance-adapter-acceptance.md"),
      repositoryText("docs/process/milestone-acceptance-acceptance.md"),
    ]);
  assert.match(contract, /25 dependency-ordered cases/u);
  assert.match(source, /committed[\s\S]*migration/u);
  assert.match(coreRecord, /criterion[\s\S]*receipt/u);
  assert.match(mutation, /existing `dag` scope/u);
  assert.match(advance, /all-or-nothing/u);
  assert.match(publicRecord, /53 exact command paths[\s\S]*23 active root schemas/u);
  assert.match(history, /checkpoint semantics/u);
  assert.match(adapter, /LSP, VSIX, and MCP/u);
  assert.match(finalRecord, /MAF-001[\s\S]*MAF-016/u);
});

test("Contract 9 package and private adapters retain one read-only semantic boundary", async () => {
  const [plan, lsp, vscode, mcp, manifestText] = await Promise.all([
    repositoryText("plans/milestone-acceptance.pert"),
    repositoryText("adapters/lsp/src/server.ts"),
    repositoryText("adapters/vscode/src/bindings.ts"),
    repositoryText("adapters/mcp/src/protocol.ts"),
    repositoryText("package.json"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.version, "0.10.3");
  assert.equal(packageRoot.COMMAND_REGISTRY.length, 56);
  assert.equal(packageRoot.getJsonSchemaCatalog().length, 23);
  assert.equal(Object.keys(packageRoot).length, 129);
  assert.equal(Object.keys(nodeFacade).length, 129);
  assert.equal(Object.keys(core).length, 45);
  assert.deepEqual(Object.keys(packageRoot), Object.keys(nodeFacade));
  for (const name of Object.keys(packageRoot)) {
    assert.equal(packageRoot[name], nodeFacade[name], name);
  }
  assert.doesNotMatch(plan, /^task /mu);
  assert.doesNotMatch(plan, /milestone_acceptance_receipt MAC_ADAPTER_ACCEPTED:/u);
  assert.doesNotMatch(plan, /milestone_acceptance_receipt MAC_INTEGRATED_ACCEPTED:/u);
  assert.match(plan, /milestone_acceptance_receipt MAC_FINAL_ACCEPTED:/u);
  assert.match(lsp, /milestoneAcceptanceView/u);
  assert.match(vscode, /parseMilestoneAcceptanceViewResult/u);
  assert.match(mcp, /Perttool\.NextResult\.v8/u);
  assert.equal(manifest.files.includes("adapters"), false);
});

test("final gate retains explicit publication and external-write boundaries", async () => {
  const [plan, adapterRecord, packageCheck, linkCheck, lspCheck, mcpCheck, vsixCheck] =
    await Promise.all([
      repositoryText("plans/milestone-acceptance.pert"),
      repositoryText("docs/process/milestone-acceptance-adapter-acceptance.md"),
      repositoryText("scripts/check-package.sh"),
      repositoryText("scripts/check-npm-link.sh"),
      repositoryText("scripts/check-lsp-package.sh"),
      repositoryText("scripts/check-mcp-package.sh"),
      repositoryText("scripts/check-vsix-shell.sh"),
    ]);
  for (const boundary of [
    "release selection",
    "publication",
    "remote writes",
    "Issue mutation",
    "plan advance",
  ]) {
    assert.match(`${plan}\n${adapterRecord}`, new RegExp(boundary, "u"));
  }
  assert.match(packageCheck, /npm pack/u);
  assert.match(linkCheck, /npm link/u);
  assert.match(lspCheck, /perttool-language-server-private/u);
  assert.match(mcpCheck, /perttool-mcp-private/u);
  assert.match(vsixCheck, /check-vsix-host\.mjs/u);
});
