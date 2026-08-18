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

test("0.9.1 release retains Contract 8 while fixing current velocity source binding", async () => {
  const [
    requirements,
    adr,
    design,
    procedure,
    review,
    acceptance,
    correction,
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
    repositoryText("docs/adr/0003-beta-versioning.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.9.1-release.md"),
    repositoryText("docs/process/0.9.1-self-review.md"),
    repositoryText("docs/process/0.9.1-release-acceptance.md"),
    repositoryText("docs/process/issue-8-current-velocity-acceptance.md"),
    repositoryText("plans/release-0.9.1.pert"),
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

  assert.match(
    requirements,
    /^### 21\.17 Current velocity observation patch release acceptance criteria$/m,
  );
  const releaseSection = requirements.split(
    "### 21.17 Current velocity observation patch release acceptance criteria",
  )[1].split("### 21.18")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    Array.from({ length: 10 }, (_, index) => index + 1),
  );
  assert.match(adr, /Select suffix-free `0\.9\.1`/u);
  assert.match(
    design,
    /^### Post-MVP Slice 4U: Current velocity observation `v0\.9\.1` patch$/m,
  );
  assert.match(procedure, /- Status: Accepted 1\.0/u);
  assert.match(procedure, /Expected pre-publication tags: `beta=latest=0\.9\.0`, no `alpha`/u);
  assert.match(procedure, /npm `latest` promotion, release-plan advance/u);
  assert.match(review, /- Document status: Accepted 1\.0/u);
  assert.match(review, /Accepted implementation commit: `e433a3c/u);
  assert.match(review, /\| Commands \| 53 \| 53 \|/u);
  assert.match(acceptance, /- Document status: Accepted 1\.0/u);
  assert.match(acceptance, /one GraphQL[\s\S]*closed Issue #8/u);
  assert.match(correction, /Release status: Released and durably accepted in `0\.9\.1`; Issue closed/u);
  assert.match(correction, /Exact current operand/u);

  const checked = perttool.checkDocument(plan);
  const metadata = perttool.getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_091");
  assert.equal(metadata.grammarVersion, 6);
  assert.equal(metadata.project.finish, "RELEASE_091_ACCEPTED");
  assert.deepEqual(
    checked.document.declarations
      .filter(({ kind }) => kind === "task")
      .map(({ id }) => id),
    [
      "RELEASE_091_SELF_REVIEW",
      "RELEASE_091_PREPARATION",
      "RELEASE_091_CANDIDATE",
      "RELEASE_091_PUBLISH",
      "RELEASE_091_ACCEPTANCE",
    ],
  );
  assert.match(plan, /task RELEASE_091_SELF_REVIEW[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_091_PREPARATION[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_091_CANDIDATE[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_091_PUBLISH[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_091_ACCEPTANCE[\s\S]*?status done/u);

  const next = perttool.selectNextTasks(plan);
  assert.equal(next.ok, true);
  assert.deepEqual(next.recommendation.recommendedTaskIds, []);

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  const lspManifest = JSON.parse(lspManifestText);
  const mcpManifest = JSON.parse(mcpManifestText);
  assert.equal(manifest.version, "0.10.0");
  assert.equal(lockfile.version, "0.10.0");
  assert.equal(lockfile.packages[""].version, "0.10.0");
  assert.equal(lspManifest.peerDependencies.perttool, "0.10.0");
  assert.equal(mcpManifest.peerDependencies.perttool, "0.10.0");
  assert.match(versionSource, /TOOL_VERSION = "0\.10\.0"/u);
  assert.match(mcpProtocol, /MCP_SERVER_VERSION = "0\.10\.0"/u);
  assert.match(changelog, /^## \[0\.9\.1\] - 2026-08-13$/m);
  assert.match(readme, /Version `0\.9\.1` is the durably accepted compatible Contract 8 patch/u);
  assert.match(planIndex, /All forty-three plans pass/u);
  assert.match(selfUseScript, /plans\/release-0\.9\.1\.pert/u);

  assert.equal(Object.keys(perttool).length, 129);
  assert.equal(Object.keys(nodeApi).length, 129);
  assert.equal(Object.keys(core).length, 45);
  assert.deepEqual(Object.keys(perttool), Object.keys(nodeApi));
  for (const name of Object.keys(perttool)) {
    assert.equal(perttool[name], nodeApi[name], name);
  }
  assert.equal(perttool.COMMAND_REGISTRY.length, 56);
  assert.equal(perttool.getJsonSchemaCatalog().length, 23);
  assert.deepEqual(manifest.files, ["dist", "schemas", "CHANGELOG.md"]);
  assert.equal(manifest.files.includes("adapters"), false);
});
