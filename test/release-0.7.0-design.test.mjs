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
  )[1].split("## 22.")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    Array.from({ length: 17 }, (_, index) => index + 1),
  );
  assert.match(releaseSection, /authorizes only local design/);
  assert.match(releaseSection, /does not authorize readiness/);
  assert.match(adr, /Select suffix-free `0\.7\.0`/);
  assert.match(adr, /`0\.6\.1` would understate/);
  assert.match(
    design,
    /^### Post-MVP Slice 4Q: Conditional plan assurance `v0\.7\.0` beta minor$/m,
  );
  assert.match(procedure, /- Status: Planned 1\.0/);
  assert.match(procedure, /Expected pre-publication tags: `beta=latest=0\.6\.0`, no `alpha`/);
  assert.match(procedure, /authorizes only[\s\S]*`RELEASE_070_GATE_DESIGN`/);
  assert.match(procedure, /does not authorize the readiness/);
  assert.match(procedure, /SHA-256 is a digital signature/);
  assert.match(procedure, /Consumers can roll back by pinning `perttool@0\.6\.0`/);
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
    /^task RELEASE_070_PUBLISH RELEASE_070_CANDIDATE_ACCEPTED -> RELEASE_070_PUBLISHED:$/m,
  );
  assert.match(plan, /user separately authorizes this exact candidate/);

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.6.0");
  assert.equal(lockfile.version, "0.6.0");
  assert.equal(lockfile.packages[""].version, "0.6.0");
  assert.equal(lockfile.packages["node_modules/fast-uri"].version, "3.1.5");
  assert.match(versionSource, /TOOL_VERSION = "0\.6\.0"/);
  assert.equal(manifest.publishConfig.tag, "beta");
  assert.match(
    readme,
    /npm `beta`, npm `latest`, and an unqualified install resolve to Contract 6\s+`0\.6\.0`/,
  );
  assert.match(readme, /Suffix-free beta `0\.7\.0` is selected/);
});
