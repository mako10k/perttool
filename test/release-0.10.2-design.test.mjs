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

test("0.10.2 retains the compatible Issue 20 patch record and public identities", async () => {
  const [manifestText, lockText, lspText, mcpText, versionSource, protocol,
    changelog, readme, procedure, selfReview, plan, acceptance] = await Promise.all([
    read("package.json"), read("package-lock.json"), read("adapters/lsp/package.json"),
    read("adapters/mcp/package.json"), read("src/version.ts"),
    read("adapters/mcp/src/protocol.ts"), read("CHANGELOG.md"), read("README.md"),
    read("docs/process/0.10.2-release.md"), read("docs/process/0.10.2-self-review.md"),
    read("plans/release-0.10.2.pert"), read("docs/process/issue-20-retained-receipt-acceptance.md"),
  ]);
  const manifest = JSON.parse(manifestText);
  const lock = JSON.parse(lockText);
  const lsp = JSON.parse(lspText);
  const mcp = JSON.parse(mcpText);
  assert.equal(manifest.version, "0.10.5");
  assert.equal(lock.version, "0.10.5");
  assert.equal(lock.packages[""].version, "0.10.5");
  assert.equal(lsp.peerDependencies.perttool, "0.10.5");
  assert.equal(mcp.peerDependencies.perttool, "0.10.5");
  assert.match(versionSource, /TOOL_VERSION = "0\.10\.5"/u);
  assert.match(protocol, /MCP_SERVER_VERSION = "0\.10\.5"/u);
  assert.match(changelog, /^## \[0\.10\.2\] - 2026-08-21$/mu);
  assert.match(procedure, /compatible patch after published `0\.10\.1`/u);
  assert.match(selfReview, /Suffix-free `0\.10\.2` accurately represents/u);
  assert.match(plan, /Candidate acceptance, PUBLISH, durable acceptance/u);
  assert.match(acceptance, /producer is\s+absent in both snapshots/u);
  assert.equal(CONTRACT9_COMMAND_REGISTRY.length, 56);
  assert.equal(getJsonSchemaCatalog().length, 23);
  assert.equal(Object.keys(packageRoot).length, 129);
  assert.equal(Object.keys(nodeFacade).length, 129);
  assert.equal(Object.keys(core).length, 45);
});
