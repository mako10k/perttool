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

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("0.9.0 release and post-acceptance closure bind Grammar 7 and CLI Contract 8", async () => {
  const [
    requirements,
    adr,
    design,
    procedure,
    gate,
    readiness,
    preparation,
    candidate,
    publication,
    acceptance,
    latestPromotion,
    postAcceptance,
    migration,
    planAcceptance,
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
    lspIsolatedScript,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/adr/0003-beta-versioning.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.9.0-release.md"),
    repositoryText("docs/process/0.9.0-gate-design.md"),
    repositoryText("docs/process/0.9.0-input-readiness.md"),
    repositoryText("docs/process/0.9.0-preparation.md"),
    repositoryText("docs/process/0.9.0-candidate.md"),
    repositoryText("docs/process/0.9.0-publish.md"),
    repositoryText("docs/process/0.9.0-release-acceptance.md"),
    repositoryText("docs/process/0.9.0-latest-promotion.md"),
    repositoryText("docs/process/0.9.0-post-acceptance-operations.md"),
    repositoryText("docs/process/0.8.1-to-0.9.0-migration.md"),
    repositoryText("docs/process/0.9.0-release-plan-acceptance.md"),
    repositoryText("plans/release-0.9.0.pert"),
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
    repositoryText("scripts/check-lsp-isolated.mjs"),
  ]);

  assert.match(
    requirements,
    /^### 21\.16 Milestone acceptance beta release acceptance criteria$/m,
  );
  const releaseSection = requirements.split(
    "### 21.16 Milestone acceptance beta release acceptance criteria",
  )[1].split("### 21.17")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    Array.from({ length: 13 }, (_, index) => index + 1),
  );
  assert.match(adr, /Select suffix-free `0\.9\.0`/u);
  assert.match(adr, /`0\.8\.2` would understate/u);
  assert.match(
    design,
    /^### Post-MVP Slice 4T: Milestone acceptance `v0\.9\.0` beta minor$/m,
  );
  assert.match(procedure, /- Status: Accepted 1\.0/u);
  assert.match(procedure, /Expected pre-publication tags: `beta=latest=0\.8\.1`, no `alpha`/u);
  assert.match(procedure, /That batch is complete/u);
  assert.match(procedure, /## 8\. Post-acceptance closure/u);
  assert.match(procedure, /beta=latest=0\.9\.0/u);
  assert.match(gate, /- Document status: Accepted 1\.0/u);
  assert.match(gate, /\| Commands \| 45 \| 53 \|/u);
  assert.match(gate, /\| Root schemas \| 21 \| 23 \|/u);
  assert.match(gate, /\| Core runtime exports \| 45 \| 45 \|/u);
  assert.match(readiness, /- Document status: Accepted 1\.0/u);
  assert.match(readiness, /beta=latest=0\.8\.1/u);
  assert.match(preparation, /- Document status: Accepted 1\.0/u);
  assert.match(preparation, /all 1,041 Node\.js tests/u);
  assert.match(preparation, /all 38 self-use plans/u);
  assert.match(preparation, /713-file `perttool@0\.9\.0` public package/u);
  assert.match(preparation, /Prepared-plan source digest: `sha256:16cdb32b/u);
  assert.match(candidate, /- Document status: Accepted 1\.0/u);
  assert.match(candidate, /Candidate source commit: `5cb7bc873ddeb68f8dc27a78efaa61f9519a6f28`/u);
  assert.match(candidate, /Candidate source tree: `ac938c0a1c69582c1ce322add922e46c7277586d`/u);
  assert.match(candidate, /Completed-plan source digest: `sha256:9bd6fea7/u);
  assert.match(candidate, /SHA-256 \| `88e51bfee536a62a980c83f2af77af6245a5ce578ec9aac4153b2e8f237345e7`/u);
  assert.match(candidate, /Complete, non-truncated NextResult v7 recommends and makes startable only/u);
  assert.match(publication, /- Document status: Accepted 1\.0/u);
  assert.match(publication, /Release commit: `3aca4f0d863407d5f2abd9a09741dae85731c0b0`/u);
  assert.match(publication, /Annotated tag object: `de108f5a159cb69bd59446f5d0082776f16cee72`/u);
  assert.match(publication, /CI run: \[`31670558276`\]/u);
  assert.match(publication, /GitHub prerelease `369687054`/u);
  assert.match(publication, /beta=0\.9\.0/u);
  assert.match(publication, /unchanged\s+`latest=0\.8\.1`/u);
  assert.match(publication, /Completed-plan source digest: `sha256:4a53e9ce/u);
  assert.match(acceptance, /- Document status: Accepted and post-acceptance operations complete 1\.1/u);
  assert.match(acceptance, /- Public verification: complete/u);
  assert.match(acceptance, /Durable-acceptance plan digest: `sha256:0fdc2a84/u);
  assert.match(acceptance, /beta=0\.9\.0/u);
  assert.match(acceptance, /unchanged `latest=0\.8\.1`/u);
  assert.match(acceptance, /All six tasks and 22p are\s+complete/u);
  assert.match(acceptance, /no ready,\s+recommended, or startable task/u);
  assert.match(acceptance, /residual digest is\s+`sha256:59b5fbbe/iu);
  assert.match(latestPromotion, /- Document status: Accepted 1\.0/u);
  assert.match(latestPromotion, /Final tags: `beta=latest=0\.9\.0`, no `alpha`/u);
  assert.match(latestPromotion, /Registry modification time: `2026-08-13T06:49:54\.643Z`/u);
  assert.match(latestPromotion, /executed exactly once through `secdat`/u);
  assert.match(postAcceptance, /Accepted record commit: `4a78e586/u);
  assert.match(postAcceptance, /Migration commit: `dd007253/u);
  assert.match(postAcceptance, /Pre-advance evidence commit: `23e166430/u);
  assert.match(postAcceptance, /Residual plan digest: `sha256:59b5fbbe/u);
  assert.match(postAcceptance, /Issue \[#10\]/u);
  assert.match(postAcceptance, /Issue \[#11\]/u);
  assert.match(postAcceptance, /History guard model 1 passed with cause `baseline_matches`/u);
  assert.match(migration, /Existing Grammar 1 through 6 documents remain readable/u);
  assert.match(migration, /Use exact `perttool@0\.8\.1` as the rollback pin/u);
  assert.match(planAcceptance, /Accepted source digest: `sha256:104c58d0/u);

  const checked = perttool.checkDocument(plan);
  const metadata = perttool.getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_090");
  assert.equal(metadata.grammarVersion, 7);
  assert.equal(metadata.project.finish, "RELEASE_090_ACCEPTED");
  assert.deepEqual(
    checked.document.declarations
      .filter(({ kind }) => kind === "task")
      .map(({ id }) => id),
    [],
  );
  assert.match(plan, /^milestone RELEASE_090_ACCEPTED:$/m);
  assert.match(plan, /^  state reached$/m);
  assert.match(plan, /^milestone_criterion_set RELEASE_090_ACCEPTANCE_R1:$/m);
  assert.match(plan, /^milestone_acceptance_receipt RELEASE_090_ACCEPTANCE_EVIDENCE:$/m);
  assert.doesNotMatch(plan, /^milestone_acceptance_migration /m);

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  const lspManifest = JSON.parse(lspManifestText);
  const mcpManifest = JSON.parse(mcpManifestText);
  assert.equal(manifest.version, "0.9.2");
  assert.equal(lockfile.version, "0.9.2");
  assert.equal(lockfile.packages[""].version, "0.9.2");
  assert.equal(lspManifest.peerDependencies.perttool, "0.9.2");
  assert.equal(mcpManifest.peerDependencies.perttool, "0.9.2");
  assert.match(versionSource, /TOOL_VERSION = "0\.9\.2"/u);
  assert.match(mcpProtocol, /MCP_SERVER_VERSION = "0\.9\.2"/u);
  assert.match(changelog, /^## \[0\.9\.0\] - 2026-08-13$/m);
  assert.match(readme, /Version `0\.9\.0` is the published Grammar 7 and CLI Contract 8/u);
  assert.match(
    readme,
    /`beta=0\.9\.2`, `latest=0\.9\.0`, and no `alpha`/u,
  );
  assert.match(planIndex, /All forty-one plans pass/u);
  assert.match(selfUseScript, /plans\/release-0\.9\.0\.pert/u);
  assert.match(lspIsolatedScript, /responseTimeoutMilliseconds = 15_000/u);

  assert.deepEqual(manifest.files, ["dist", "schemas", "CHANGELOG.md"]);
  assert.equal(Object.keys(perttool).length, 129);
  assert.equal(Object.keys(nodeApi).length, 129);
  assert.equal(Object.keys(core).length, 45);
  assert.deepEqual(Object.keys(perttool), Object.keys(nodeApi));
  for (const name of Object.keys(perttool)) {
    assert.equal(perttool[name], nodeApi[name], name);
  }
  assert.equal(perttool.COMMAND_REGISTRY.length, 53);
  assert.equal(perttool.getJsonSchemaCatalog().length, 23);
  assert.equal(manifest.files.includes("adapters"), false);
  assert.match(procedure, /PUBLISH is complete from release commit `3aca4f0`/u);
  assert.match(procedure, /^## 7\. Durable acceptance stopping point$/m);
  assert.match(procedure, /0\.9\.0-post-acceptance-operations\.md/u);
  assert.match(
    procedure,
    /complete\s+NextResult v7 has no ready, recommended, or startable task/u,
  );
});
