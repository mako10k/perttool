import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  checkDocument,
  getGuide,
  getJsonSchemaCatalog,
  getProjectMetadata,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("0.7.1 release gate binds the compatible Help and Guide patch boundary", async () => {
  const [
    requirements,
    adr,
    design,
    procedure,
    review,
    preparation,
    correction,
    plan,
    changelog,
    readme,
    manifestText,
    lockfileText,
    versionSource,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/adr/0003-beta-versioning.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.7.1-release.md"),
    repositoryText("docs/process/0.7.1-self-review.md"),
    repositoryText("docs/process/0.7.1-preparation.md"),
    repositoryText("docs/process/help-guide-consistency-acceptance.md"),
    repositoryText("plans/release-0.7.1.pert"),
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
    repositoryText("src/version.ts"),
  ]);

  assert.match(
    requirements,
    /^### 21\.14 Help and Guide consistency patch release acceptance criteria$/m,
  );
  const releaseSection = requirements.split(
    "### 21.14 Help and Guide consistency patch release acceptance criteria",
  )[1].split("## 22.")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    Array.from({ length: 13 }, (_, index) => index + 1),
  );
  assert.match(adr, /Select suffix-free `0\.7\.1`/);
  assert.match(adr, /`0\.8\.0` would overstate/);
  assert.match(
    design,
    /^### Post-MVP Slice 4R: Help and Guide consistency `v0\.7\.1` beta patch$/m,
  );
  assert.match(procedure, /- Status: Active 1\.0/);
  assert.match(
    procedure,
    /Expected pre-publication tags: `beta=latest=0\.7\.0`, no `alpha`/,
  );
  assert.match(procedure, /This is not a documentation-only package change/);
  assert.match(procedure, /authorizes local `RELEASE_071_PREPARATION` and candidate acceptance/);
  assert.match(procedure, /user separately authorizes the exact\s+candidate and external batch/);
  assert.match(review, /- Document status: Accepted 1\.0/);
  assert.match(review, /No public interface identity changes/);
  assert.match(review, /`beta=latest=0\.7\.0`/);
  assert.match(preparation, /- Document status: Accepted 1\.0/);
  assert.match(preparation, /Package and lockfile identities, CLI version, CHANGELOG,/);
  assert.match(preparation, /797 tests/);
  assert.match(preparation, /all 33 self-use plans/);
  assert.match(
    preparation,
    /Completed-plan source digest: `sha256:25ab07cca3c3a7c4a6e880d3b429023924a2e8de48aa70314f82887d928877b2`/,
  );
  assert.match(changelog, /^## \[0\.7\.1\] - 2026-08-05$/m);
  assert.match(readme, /package=perttool@0\.7\.1/);
  assert.match(readme, /leaves the\s+independently managed `latest` tag at `0\.7\.0`/);
  assert.match(correction, /All 44 registered commands/);
  assert.match(
    correction,
    /recursively discovers every literal TypeScript `helpTopic` and resolves/,
  );

  const checked = checkDocument(plan);
  const metadata = getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_071");
  assert.equal(metadata.grammarVersion, 6);
  assert.equal(metadata.project.finish, "RELEASE_071_ACCEPTED");
  assert.equal(metadata.project.governance.effective.goalOwner, "user");
  assert.equal(metadata.project.governance.effective.dagOwner, "user");
  assert.deepEqual(
    checked.document.declarations
      .filter(({ kind }) => kind === "task")
      .map(({ id }) => id),
    [
      "RELEASE_071_SELF_REVIEW",
      "RELEASE_071_PREPARATION",
      "RELEASE_071_CANDIDATE",
      "RELEASE_071_PUBLISH",
      "RELEASE_071_ACCEPTANCE",
    ],
  );
  assert.match(
    plan,
    /^task RELEASE_071_SELF_REVIEW[\s\S]*?^  status done$/m,
  );
  assert.match(
    plan,
    /^task RELEASE_071_PREPARATION[\s\S]*?^  status done$/m,
  );
  for (const taskId of [
    "RELEASE_071_CANDIDATE",
    "RELEASE_071_PUBLISH",
    "RELEASE_071_ACCEPTANCE",
  ]) {
    const block = plan.split(`task ${taskId} `)[1].split("\ntask ")[0];
    assert.doesNotMatch(block, /^  status /m, taskId);
  }

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.7.1");
  assert.equal(lockfile.version, "0.7.1");
  assert.equal(lockfile.packages[""].version, "0.7.1");
  assert.match(versionSource, /TOOL_VERSION = "0\.7\.1"/);
  assert.equal(manifest.publishConfig.tag, "beta");
  assert.equal(COMMAND_REGISTRY.length, 44);
  assert.equal(getJsonSchemaCatalog().length, 20);
  assert.match(
    getGuide("next", "detail").sections.map(({ body }) => body).join("\n"),
    /recommendation_v1_plus_release_gate_plus_plan_assurance_v1/,
  );
});
