import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CONTRACT9_COMMAND_REGISTRY } from "../dist/command/contract9-discovery.js";
import { getJsonSchemaCatalog } from "../dist/schema/registry.js";
import * as packageRoot from "../dist/index.js";
import * as core from "../dist/core/index.js";
import * as nodeFacade from "../dist/node/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("0.10.5 selects the compatible Issue 23 patch and retains public identities", async () => {
  const [manifestText, lockText, lspText, mcpText, versionSource, protocol,
    changelog, readme, procedure, plan, acceptance] = await Promise.all([
    read("package.json"), read("package-lock.json"), read("adapters/lsp/package.json"),
    read("adapters/mcp/package.json"), read("src/version.ts"),
    read("adapters/mcp/src/protocol.ts"), read("CHANGELOG.md"), read("README.md"),
    read("docs/process/0.10.5-release.md"), read("plans/release-0.10.5.pert"),
    read("docs/process/issue-23-assurance-recovery-acceptance.md"),
  ]);
  const manifest = JSON.parse(manifestText);
  const lock = JSON.parse(lockText);
  assert.equal(manifest.version, "0.10.5");
  assert.equal(lock.version, "0.10.5");
  assert.equal(lock.packages[""].version, "0.10.5");
  assert.equal(JSON.parse(lspText).peerDependencies.perttool, "0.10.5");
  assert.equal(JSON.parse(mcpText).peerDependencies.perttool, "0.10.5");
  assert.match(versionSource, /TOOL_VERSION = "0\.10\.5"/u);
  assert.match(protocol, /MCP_SERVER_VERSION = "0\.10\.5"/u);
  assert.match(changelog, /^## \[0\.10\.5\] - 2026-08-21$/mu);
  assert.match(readme, /compatible `0\.10\.5` Issue #23 assurance-recovery patch/u);
  assert.match(procedure, /compatible patch after published `0\.10\.4`/u);
  assert.match(plan, /npm latest, Issue mutation, public VSIX publication, plan advance/u);
  assert.match(acceptance, /replan_and_reseal/u);
  assert.equal(CONTRACT9_COMMAND_REGISTRY.length, 56);
  assert.equal(getJsonSchemaCatalog().length, 23);
  assert.equal(Object.keys(packageRoot).length, 129);
  assert.equal(Object.keys(nodeFacade).length, 129);
  assert.equal(Object.keys(core).length, 45);
});
