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
    candidate,
    publication,
    promotion,
    acceptance,
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
    repositoryText("docs/process/0.7.1-candidate.md"),
    repositoryText("docs/process/0.7.1-publish.md"),
    repositoryText("docs/process/0.7.1-latest-promotion.md"),
    repositoryText("docs/process/0.7.1-release-acceptance.md"),
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
  )[1].split("### 21.15")[0];
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
  assert.match(procedure, /- Status: Accepted 1\.0/);
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
  assert.match(candidate, /- Document status: Accepted 1\.0/);
  assert.match(candidate, /Candidate source commit: `a05b769a65dcebbf3b543538ba4930e065f3e867`/);
  assert.match(
    candidate,
    /Completed-plan source digest: `sha256:986e4200fa452535534ad11f31008de62824cfed70c3665cb35ba1c568610a10`/,
  );
  assert.match(candidate, /Packed size \| `660003` bytes/);
  assert.match(
    candidate,
    /SHA-256 \| `5bf4723131b79f04b501ae02b7585c800ac8dc37f0f3a816eff837d670e4454c`/,
  );
  assert.match(candidate, /Complete, non-truncated NextResult v6\s+recommends only `RELEASE_071_PUBLISH`/);
  assert.match(publication, /- Document status: Accepted 1\.0/);
  assert.match(publication, /CI run: \[`30969627120`\]/);
  assert.match(publication, /The publish operation was\s+not retried/);
  assert.match(promotion, /Final tags: `beta=latest=0\.7\.1`, no `alpha`/);
  assert.match(promotion, /npm dist-tag add perttool@0\.7\.1 latest/);
  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.match(
    acceptance,
    /Final plan digest: `sha256:a98401116f8ae5dc554927c49a421321015fb9e5cca53538e7e17c58043a1180`/,
  );
  assert.match(acceptance, /All five tasks and 15p are complete/);
  assert.match(changelog, /^## \[0\.7\.1\] - 2026-08-05$/m);
  assert.match(readme, /package=perttool@0\.9\.4/);
  assert.match(readme, /made `beta=latest=0\.7\.1`/);
  assert.match(readme, /Version `0\.7\.0` remains the exact rollback pin/);
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
  assert.match(
    plan,
    /^task RELEASE_071_CANDIDATE[\s\S]*?^  status done$/m,
  );
  for (const taskId of ["RELEASE_071_PUBLISH", "RELEASE_071_ACCEPTANCE"]) {
    const block = plan.split(`task ${taskId} `)[1].split("\ntask ")[0];
    assert.match(block, /^  status done$/m, taskId);
  }

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.10.1");
  assert.equal(lockfile.version, "0.10.1");
  assert.equal(lockfile.packages[""].version, "0.10.1");
  assert.match(versionSource, /TOOL_VERSION = "0\.10\.1"/);
  assert.equal(manifest.publishConfig.tag, "beta");
  assert.equal(COMMAND_REGISTRY.length, 56);
  assert.equal(getJsonSchemaCatalog().length, 23);
  assert.match(
    getGuide("next", "detail").sections.map(({ body }) => body).join("\n"),
    /recommendation_v1_plus_release_gate_plus_plan_assurance_v1/,
  );
});
