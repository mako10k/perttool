import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocument } from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("0.11.1 is a compatible candidate-bound VSIX host reliability patch", async () => {
  const [plan, procedure, review, requirements, adr, design, manifestText,
    lockText, versionSource, lspText, mcpText, hostScript] = await Promise.all([
    readFile(path.join(root, "plans/release-0.11.1.pert"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.1-release.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.1-self-review.md"), "utf8"),
    readFile(path.join(root, "docs/requirements.md"), "utf8"),
    readFile(path.join(root, "docs/adr/0003-beta-versioning.md"), "utf8"),
    readFile(path.join(root, "docs/basic-design.md"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
    readFile(path.join(root, "package-lock.json"), "utf8"),
    readFile(path.join(root, "src/version.ts"), "utf8"),
    readFile(path.join(root, "adapters/lsp/package.json"), "utf8"),
    readFile(path.join(root, "adapters/mcp/package.json"), "utf8"),
    readFile(path.join(root, "scripts/check-vsix-host.mjs"), "utf8"),
  ]);

  const checked = checkDocument(plan);
  assert.equal(checked.ok, true);
  assert.equal(checked.documentId, "RELEASE_0111");
  for (const id of [
    "RELEASE_0111_SELF_REVIEW",
    "RELEASE_0111_PREPARATION",
    "RELEASE_0111_CANDIDATE",
    "RELEASE_0111_PUBLISH",
    "RELEASE_0111_ACCEPTANCE",
  ]) {
    assert.match(plan, new RegExp(`^task ${id} `, "mu"));
  }
  assert.match(procedure, /confirmation naming the exact candidate/u);
  assert.match(review, /changes repository validation and evidence, not installed/u);
  assert.match(requirements, /^27\. \[[ x]\] Release the accepted VSIX host reliability correction/mu);
  assert.match(adr, /^### Accepted compatible `0\.11\.1` VSIX host reliability patch$/mu);
  assert.match(design, /^### Post-MVP Slice 8B: compatible `v0\.11\.1` host-gate patch$/mu);

  const manifest = JSON.parse(manifestText);
  const lock = JSON.parse(lockText);
  assert.equal(manifest.version, "0.11.1");
  assert.equal(lock.version, "0.11.1");
  assert.equal(lock.packages[""].version, "0.11.1");
  assert.equal(JSON.parse(lspText).peerDependencies.perttool, "0.11.1");
  assert.equal(JSON.parse(mcpText).peerDependencies.perttool, "0.11.1");
  assert.match(versionSource, /TOOL_VERSION = "0\.11\.1"/u);
  assert.doesNotMatch(hostScript, /--list-extensions/u);
  assert.match(hostScript, /extensions\.json/u);
});
