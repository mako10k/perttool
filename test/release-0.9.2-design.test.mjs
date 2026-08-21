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

test("0.9.2 retains Contract 8 while fixing Point plans without velocity", async () => {
  const [
    requirements,
    design,
    procedure,
    review,
    correction,
    preparation,
    candidate,
    publication,
    acceptance,
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
    commonSchema,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.9.2-release.md"),
    repositoryText("docs/process/0.9.2-self-review.md"),
    repositoryText("docs/process/issue-15-point-no-velocity-acceptance.md"),
    repositoryText("docs/process/0.9.2-preparation.md"),
    repositoryText("docs/process/0.9.2-candidate.md"),
    repositoryText("docs/process/0.9.2-publish.md"),
    repositoryText("docs/process/0.9.2-release-acceptance.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("plans/release-0.9.2.pert"),
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
    repositoryText("schemas/Perttool.Common.v1.schema.json"),
  ]);

  assert.match(requirements, /^### 21\.18 Point-without-velocity emergency patch release acceptance criteria$/m);
  assert.match(design, /^### Post-MVP Slice 4V: Point-without-velocity `v0\.9\.2` emergency patch$/m);
  assert.match(procedure, /- Status: Accepted 1\.0/u);
  assert.match(procedure, /Expected pre-publication tags: `beta=0\.9\.1`, `latest=0\.9\.0`, no `alpha`/u);
  assert.match(review, /exact peeled `v0\.9\.1` commit `ddb12dc/u);
  assert.match(correction, /`velocity_forecast=null`/u);
  assert.match(preparation, /all 1,048 Node\.js tests/u);
  assert.match(candidate, /5347f4b0e7c38b44f4f6ee34ca71dd2389fcf88da3ad52b85c7b64f82e980edb/u);
  assert.match(publication, /Repository checks 31762661717/u);
  assert.match(acceptance, /Issue #15 received one evidence comment/u);
  assert.match(backlog, /^### ANALYSIS-001: Analyze point plans without declared velocity$/m);
  assert.match(commonSchema, /"missing_velocity"/u);

  const checked = perttool.checkDocument(plan);
  const metadata = perttool.getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_092");
  assert.equal(metadata.grammarVersion, 6);
  assert.equal(metadata.project.finish, "RELEASE_092_ACCEPTED");
  assert.deepEqual(
    checked.document.declarations
      .filter(({ kind }) => kind === "task")
      .map(({ id }) => id),
    [
      "RELEASE_092_SELF_REVIEW",
      "RELEASE_092_CORRECTION",
      "RELEASE_092_PREPARATION",
      "RELEASE_092_CANDIDATE",
      "RELEASE_092_PUBLISH",
      "RELEASE_092_ACCEPTANCE",
    ],
  );
  assert.match(plan, /task RELEASE_092_SELF_REVIEW[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_092_CORRECTION[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_092_PREPARATION[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_092_CANDIDATE[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_092_PUBLISH[\s\S]*?status done/u);
  assert.match(plan, /task RELEASE_092_ACCEPTANCE[\s\S]*?status done/u);
  const next = perttool.selectNextTasks(plan);
  assert.equal(next.ok, true);
  assert.deepEqual(next.recommendation.recommendedTaskIds, []);
  assert.deepEqual(next.groups.ready, []);
  assert.deepEqual(next.temporal.authority.startableRecommendedTaskIds, []);

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  const lspManifest = JSON.parse(lspManifestText);
  const mcpManifest = JSON.parse(mcpManifestText);
  assert.equal(manifest.version, "0.10.4");
  assert.equal(lockfile.version, "0.10.4");
  assert.equal(lockfile.packages[""].version, "0.10.4");
  assert.equal(lspManifest.peerDependencies.perttool, "0.10.4");
  assert.equal(mcpManifest.peerDependencies.perttool, "0.10.4");
  assert.match(versionSource, /TOOL_VERSION = "0\.10\.4"/u);
  assert.match(mcpProtocol, /MCP_SERVER_VERSION = "0\.10\.4"/u);
  assert.match(changelog, /^## \[0\.9\.2\] - 2026-08-14$/m);
  assert.match(readme, /Version `0\.9\.2` is the durably accepted compatible Contract 8 emergency patch/u);
  assert.match(planIndex, /All forty-three plans pass/u);
  assert.match(selfUseScript, /plans\/release-0\.9\.2\.pert/u);

  assert.equal(Object.keys(perttool).length, 129);
  assert.equal(Object.keys(nodeApi).length, 129);
  assert.equal(Object.keys(core).length, 45);
  assert.deepEqual(Object.keys(perttool), Object.keys(nodeApi));
  for (const name of Object.keys(perttool)) {
    assert.equal(perttool[name], nodeApi[name], name);
  }
});
