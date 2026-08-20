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

test("0.9.3 retains Contract 8 while restoring all three emergency gates", async () => {
  const [
    requirements,
    design,
    procedure,
    publish,
    acceptance,
    review,
    correction,
    contract,
    backlog,
    plan,
    manifestText,
    lockfileText,
    versionSource,
    lspManifestText,
    mcpManifestText,
    mcpProtocol,
    changelog,
    readme,
    planIndex,
    selfUseScript,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.9.3-release.md"),
    repositoryText("docs/process/0.9.3-publish.md"),
    repositoryText("docs/process/0.9.3-release-acceptance.md"),
    repositoryText("docs/process/0.9.3-self-review.md"),
    repositoryText("docs/process/issue-14-16-17-acceptance.md"),
    repositoryText("docs/specs/contract8-emergency-corrections.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("plans/release-0.9.3.pert"),
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
  ]);

  assert.match(requirements, /^### 21\.19 Contract 8 emergency gate correction release acceptance criteria$/m);
  assert.match(design, /^### Post-MVP Slice 4W: Contract 8 emergency gate patch `v0\.9\.3`$/m);
  assert.match(procedure, /Expected pre-publication tags: `beta=0\.9\.2`, `latest=0\.9\.0`, no `alpha`/u);
  assert.match(review, /Public baseline: `b47a0a450f83070340fc52df88a0243f80ef795e`/u);
  assert.match(correction, /The shared edit normalizer still rejects all overlaps/u);
  assert.match(contract, /must first parse the complete\s+Grammar 7 source/u);
  assert.match(contract, /retained milestone changed to `state reached` keeps its criterion\s+set and receipts/u);
  for (const id of ["ASSURE-002", "ADV-004", "ADV-005"]) {
    assert.match(backlog, new RegExp(`^### ${id}:`, "m"));
  }
  assert.equal(
    [...backlog.matchAll(/^Status: Released and accepted in `0\.9\.3`; Issue #(?:14|16|17) closed \(2026-08-14\)$/gm)].length,
    3,
  );
  assert.match(publish, /CI run `31770995809` completed successfully/u);
  assert.match(acceptance, /All six release tasks and 21 points are complete/u);

  const checked = perttool.checkDocument(plan);
  const metadata = perttool.getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_093");
  assert.equal(metadata.grammarVersion, 6);
  assert.equal(metadata.project.finish, "RELEASE_093_ACCEPTED");
  assert.match(plan, /task RELEASE_093_SELF_REVIEW[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_093_CORRECTIONS[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_093_PREPARATION[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_093_CANDIDATE[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_093_PUBLISH[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_093_ACCEPTANCE[\s\S]*?status done/u);
  const next = perttool.selectNextTasks(plan);
  assert.equal(next.ok, true);
  assert.deepEqual(next.recommendation.recommendedTaskIds, []);
  assert.equal(next.tasks.length, 0);

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  const lspManifest = JSON.parse(lspManifestText);
  const mcpManifest = JSON.parse(mcpManifestText);
  assert.equal(manifest.version, "0.10.1");
  assert.equal(lockfile.version, "0.10.1");
  assert.equal(lockfile.packages[""].version, "0.10.1");
  assert.equal(lspManifest.peerDependencies.perttool, "0.10.1");
  assert.equal(mcpManifest.peerDependencies.perttool, "0.10.1");
  assert.match(versionSource, /TOOL_VERSION = "0\.10\.1"/u);
  assert.match(mcpProtocol, /MCP_SERVER_VERSION = "0\.10\.1"/u);
  assert.match(changelog, /^## \[0\.9\.3\] - 2026-08-14$/m);
  assert.match(readme, /Version `0\.9\.3` is the published compatible Contract 8 emergency patch/u);
  assert.match(planIndex, /All forty-three plans pass/u);
  assert.match(selfUseScript, /plans\/release-0\.9\.3\.pert/u);

  assert.equal(perttool.COMMAND_REGISTRY.length, 56);
  assert.equal(perttool.getJsonSchemaCatalog().length, 23);
  assert.equal(Object.keys(perttool).length, 129);
  assert.equal(Object.keys(nodeApi).length, 129);
  assert.equal(Object.keys(core).length, 45);
  assert.deepEqual(Object.keys(perttool), Object.keys(nodeApi));
  for (const name of Object.keys(perttool)) assert.equal(perttool[name], nodeApi[name], name);
});
