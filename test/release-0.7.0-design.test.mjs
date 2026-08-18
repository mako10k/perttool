import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("0.7.0 release gate binds Contract 7 scope and separate publication authority", async () => {
  const [
    requirements,
    adr,
    design,
    procedure,
    readiness,
    candidate,
    publish,
    latestPromotion,
    releaseAcceptance,
    migration,
    publicAcceptance,
    finalAcceptance,
    plan,
    manifestText,
    lockfileText,
    versionSource,
    readme,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/adr/0003-beta-versioning.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.7.0-release.md"),
    repositoryText("docs/process/0.7.0-contract7-readiness.md"),
    repositoryText("docs/process/0.7.0-candidate.md"),
    repositoryText("docs/process/0.7.0-publish.md"),
    repositoryText("docs/process/0.7.0-latest-promotion.md"),
    repositoryText("docs/process/0.7.0-release-acceptance.md"),
    repositoryText("docs/process/0.6.0-to-0.7.0-migration.md"),
    repositoryText("docs/process/plan-assurance-public-contract-acceptance.md"),
    repositoryText("docs/process/plan-assurance-acceptance.md"),
    repositoryText("plans/release-0.7.0.pert"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
    repositoryText("src/version.ts"),
    repositoryText("README.md"),
  ]);

  assert.match(
    requirements,
    /^### 21\.13 Conditional plan assurance release acceptance criteria$/m,
  );
  const releaseSection = requirements.split(
    "### 21.13 Conditional plan assurance release acceptance criteria",
  )[1].split("### 21.14")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    Array.from({ length: 17 }, (_, index) => index + 1),
  );
  assert.match(releaseSection, /initial 2026-08-04 instruction authorized only local design/);
  assert.match(releaseSection, /later instruction separately\s+authorized `RELEASE_070_CONTRACT_7_READINESS`/);
  assert.match(adr, /Select suffix-free `0\.7\.0`/);
  assert.match(adr, /`0\.6\.1` would understate/);
  assert.match(
    design,
    /^### Post-MVP Slice 4Q: Conditional plan assurance `v0\.7\.0` beta minor$/m,
  );
  assert.match(procedure, /- Status: Accepted 1\.0/);
  assert.match(procedure, /Expected pre-publication tags: `beta=latest=0\.6\.0`, no `alpha`/);
  assert.match(procedure, /initial 2026-08-04 instruction authorized only\s+`RELEASE_070_GATE_DESIGN`/);
  assert.match(procedure, /later instruction separately authorized\s+`RELEASE_070_CONTRACT_7_READINESS`/);
  assert.match(procedure, /SHA-256 is a digital signature/);
  assert.match(procedure, /Consumers can roll back by pinning `perttool@0\.6\.0`/);
  assert.match(readiness, /Document status: Accepted 1\.0/);
  assert.match(readiness, /only `RELEASE_070_PREPARATION` ready and recommended/);
  assert.match(candidate, /Document status: Accepted 1\.0/);
  assert.match(candidate, /Corrected candidate source commit: `51984c89129eaaf5ba49bbb8456ae235dc461b9d`/);
  assert.match(candidate, /Packed size \| `656702` bytes/);
  assert.match(candidate, /SHA-256 \| `8585adb5c3c2c5caeb5c2b453141c1fd87426b918ee235f21a80f557a0f4d623`/);
  assert.match(candidate, /rejected-preliminary-eeff494c3e5af2481bfc4e8f9205a6106cfa3236\.tgz/);
  assert.match(publish, /- Status: Complete/);
  assert.match(publish, /Release commit: `1279e3cbdf8f018e84380e62ac7516a2c17aa86e`/);
  assert.match(publish, /actions\/runs\/30895944899/);
  assert.match(publish, /`beta=0\.7\.0`, unchanged `latest=0\.6\.0`, and no `alpha`/);
  assert.match(publish, /SHA-256 `8585adb5c3c2c5caeb5c2b453141c1fd87426b918ee235f21a80f557a0f4d623`/);
  assert.match(latestPromotion, /- Status: Complete/);
  assert.match(latestPromotion, /npm dist-tag add perttool@0\.7\.0 latest/);
  assert.match(latestPromotion, /`beta=latest=0\.7\.0` with no `alpha`/);
  assert.match(latestPromotion, /the 44-command registry/);
  assert.match(latestPromotion, /the 20-root schema catalog/);
  assert.match(releaseAcceptance, /- Document status: Accepted 1\.0/);
  assert.match(releaseAcceptance, /actions\/runs\/30895944899/);
  assert.match(releaseAcceptance, /actions\/runs\/30900525768/);
  assert.match(releaseAcceptance, /Pairwise `cmp` passed/);
  assert.match(releaseAcceptance, /Fresh isolated installations of exact `perttool@0\.7\.0`/);
  assert.match(releaseAcceptance, /A separate exact `perttool@0\.6\.0` installation remained available/);
  assert.match(migration, /- Status: Accepted 1\.0/);
  assert.match(migration, /`cli_contract_version == 7`/);
  assert.match(migration, /recommendation_v1_plus_release_gate_plus_plan_assurance_v1/);
  assert.match(migration, /Mermaid semantic profile 2/);
  assert.match(migration, /Pin `perttool@0\.6\.0`/);
  assert.match(publicAcceptance, /CLI contract: Contract 7/);
  assert.match(publicAcceptance, /44-command registry/);
  assert.match(finalAcceptance, /all 787 tests/);
  assert.match(finalAcceptance, /completed pre-advance plan has source digest/);

  assert.match(plan, /^project RELEASE_070:$/m);
  assert.match(plan, /^  version 5$/m);
  assert.match(plan, /^  goal_owner user$/m);
  assert.match(plan, /^  dag_owner user$/m);
  assert.match(
    plan,
    /^task RELEASE_070_GATE_DESIGN RELEASE_070_PLANNING_STARTED -> RELEASE_070_GATE_ACCEPTED:$/m,
  );
  assert.match(
    plan,
    /^task RELEASE_070_CONTRACT_7_READINESS RELEASE_070_GATE_ACCEPTED -> RELEASE_070_CONTRACT_7_READY:$/m,
  );
  assert.match(
    plan,
    /^task RELEASE_070_PUBLISH RELEASE_070_CANDIDATE_ACCEPTED -> RELEASE_070_PUBLISHED:\n[\s\S]*?^  status done$/m,
  );
  assert.match(
    plan,
    /^task RELEASE_070_ACCEPTANCE RELEASE_070_PUBLISHED -> RELEASE_070_ACCEPTED:\n[\s\S]*?^  status done$/m,
  );
  assert.match(plan, /user separately authorizes this exact candidate/);
  assert.match(plan, /Preserve the publication-time fact that beta=0\.7\.0 while latest remained 0\.6\.0/);
  assert.match(plan, /post-publication promotion now reports beta=latest=0\.7\.0/);

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.10.0");
  assert.equal(lockfile.version, "0.10.0");
  assert.equal(lockfile.packages[""].version, "0.10.0");
  assert.equal(lockfile.packages["node_modules/fast-uri"].version, "3.1.5");
  assert.match(versionSource, /TOOL_VERSION = "0\.10\.0"/);
  assert.equal(manifest.publishConfig.tag, "beta");
  assert.match(
    readme,
    /does not move npm `latest` from Contract 6\s+`0\.6\.0`/,
  );
  assert.match(readme, /Version `0\.7\.0` beta atomically activates/);
  assert.match(readme, /`0\.7\.0` remains the exact rollback pin/);
});
