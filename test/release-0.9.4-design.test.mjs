import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import * as perttool from "../dist/index.js";
import * as nodeApi from "../dist/node/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const repositoryText = (relativePath) => readFile(path.join(root, relativePath), "utf8");

test("0.9.4 retains Contract 8 while correcting Issue 19", async () => {
  const [requirements, design, procedure, review, correction, rca, contract,
    backlog, plan, manifestText, lockfileText, versionSource, lspManifestText,
    mcpManifestText, mcpProtocol, changelog, readme, planIndex, selfUseScript,
    staticProcedure] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.9.4-release.md"),
    repositoryText("docs/process/0.9.4-self-review.md"),
    repositoryText("docs/process/issue-19-advance-criterion-acceptance.md"),
    repositoryText("docs/process/issue-19-advance-criterion-rca.think"),
    repositoryText("docs/specs/contract8-emergency-corrections.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("plans/release-0.9.4.pert"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
    repositoryText("src/version.ts"),
    repositoryText("adapters/lsp/package.json"),
    repositoryText("adapters/mcp/package.json"),
    repositoryText("adapters/mcp/src/protocol.ts"),
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
    repositoryText("plans/README.md"),
    repositoryText("scripts/check-self-use.sh"),
    repositoryText("docs/process/source-static-analysis.md"),
  ]);

  assert.match(requirements, /^### 21\.20 Retained milestone acceptance preservation patch criteria$/m);
  assert.match(design, /^### Post-MVP Slice 4X: Retained milestone acceptance patch `v0\.9\.4`$/m);
  assert.match(procedure, /Expected pre-publication tags: `beta=0\.9\.3`, `latest=0\.9\.0`, no `alpha`/u);
  assert.match(review, /Public baseline: `7755d3e5eee59d242402b950bcbc06583df54de4`/u);
  assert.match(correction, /keptMilestoneIds/u);
  assert.match(rca, /stateChangedMilestoneIds/u);
  assert.match(contract, /every retained milestone/u);
  assert.match(backlog, /^### ADV-006:/m);
  assert.match(staticProcedure, /jscpd 5\.0\.15/u);
  assert.match(staticProcedure, /Lizard 1\.23\.0/u);

  const checked = perttool.checkDocument(plan);
  const metadata = perttool.getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_094");
  assert.equal(metadata.grammarVersion, 7);
  assert.equal(metadata.project.finish, "RELEASE_094_ACCEPTED");
  assert.match(plan, /milestone RELEASE_094_ACCEPTED:[\s\S]*?state reached/u);
  assert.match(plan, /milestone_criterion_set RELEASE_094_ACCEPTANCE_R1/u);
  assert.match(plan, /milestone_acceptance_receipt RELEASE_094_ACCEPTANCE_EVIDENCE/u);
  assert.doesNotMatch(plan, /^task /mu);

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  const lspManifest = JSON.parse(lspManifestText);
  const mcpManifest = JSON.parse(mcpManifestText);
  assert.equal(manifest.version, "0.10.5");
  assert.equal(lockfile.version, "0.10.5");
  assert.equal(lockfile.packages[""].version, "0.10.5");
  assert.equal(lspManifest.peerDependencies.perttool, "0.10.5");
  assert.equal(mcpManifest.peerDependencies.perttool, "0.10.5");
  assert.match(versionSource, /TOOL_VERSION = "0\.10\.5"/u);
  assert.match(mcpProtocol, /MCP_SERVER_VERSION = "0\.10\.5"/u);
  assert.match(changelog, /^## \[0\.9\.4\] - 2026-08-14$/m);
  assert.match(readme, /Version `0\.9\.4` is the compatible Contract 8 emergency patch/u);
  assert.match(planIndex, /All forty-three plans pass/u);
  assert.match(selfUseScript, /plans\/release-0\.9\.4\.pert/u);

  assert.equal(perttool.COMMAND_REGISTRY.length, 56);
  assert.equal(perttool.getJsonSchemaCatalog().length, 23);
  assert.equal(Object.keys(perttool).length, 129);
  assert.equal(Object.keys(nodeApi).length, 129);
  assert.equal(Object.keys(core).length, 45);
  assert.deepEqual(Object.keys(perttool), Object.keys(nodeApi));
  for (const name of Object.keys(perttool)) assert.equal(perttool[name], nodeApi[name], name);
});
