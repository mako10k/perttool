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

test("0.5.0 release gate binds Contract 6 scope and publication authority", async () => {
  const [
    requirements,
    adr,
    design,
    procedure,
    readiness,
    actualsAcceptance,
    englishAcceptance,
    migration,
    plan,
    manifestText,
    lockfileText,
    versionSource,
    changelog,
    readme,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/adr/0003-beta-versioning.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.5.0-release.md"),
    repositoryText("docs/process/0.5.0-contract6-readiness.md"),
    repositoryText("docs/process/project-actuals-acceptance.md"),
    repositoryText("docs/process/english-baseline-acceptance.md"),
    repositoryText("docs/process/cli-contract-6-migration.md"),
    repositoryText("plans/release-0.5.0.pert"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
    repositoryText("src/version.ts"),
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
  ]);

  assert.match(
    requirements,
    /^### 21\.6 CLI Contract 6 beta release acceptance criteria$/m,
  );
  const releaseSection = requirements.split(
    "### 21.6 CLI Contract 6 beta release acceptance criteria",
  )[1].split("## 22.")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  assert.match(adr, /Select suffix-free `0\.5\.0`/);
  assert.match(
    design,
    /^### Post-MVP Slice 4J: Contract 6 `v0\.5\.0` beta release$/m,
  );
  assert.match(procedure, /Status: Active 1\.3/);
  assert.match(
    procedure,
    /Expected pre-publication default: `beta=latest=0\.4\.0`/,
  );
  assert.match(
    procedure,
    /authorizes this complete named `0\.5\.0`\s+sequence/,
  );
  assert.match(readiness, /Document status: Accepted 1\.0/);
  assert.match(readiness, /starts only `RELEASE_050_PREPARATION`/);
  assert.match(readiness, /exactly 33 commands/);
  assert.match(procedure, /does not authorize npm\s+`latest` promotion/);
  assert.match(actualsAcceptance, /`ACTUALS_ACCEPTANCE` is accepted/);
  assert.match(actualsAcceptance, /Grammar 5 and CLI Contract 6 source/);
  assert.match(englishAcceptance, /Status: Accepted and advanced/);
  assert.match(migration, /Every Contract 6 JSON result has `cli_contract_version=6`/);
  assert.match(migration, /task start/);
  assert.match(migration, /project history/);

  assert.match(plan, /^project RELEASE_050:$/m);
  assert.match(plan, /^  version 5$/m);
  assert.match(plan, /^  goal_owner user$/m);
  assert.match(plan, /^  dag_owner user$/m);
  assert.doesNotMatch(plan, /^task RELEASE_050_GATE_DESIGN /m);
  assert.doesNotMatch(plan, /^milestone RELEASE_050_PLANNING_STARTED:/m);
  assert.doesNotMatch(plan, /^task RELEASE_050_CONTRACT_6_READINESS /m);
  assert.doesNotMatch(plan, /^milestone RELEASE_050_GATE_ACCEPTED:/m);
  assert.doesNotMatch(plan, /^milestone RELEASE_050_CONTRACT_6_READY:/m);
  assert.doesNotMatch(plan, /^task RELEASE_050_PREPARATION /m);
  assert.match(
    plan,
    /^milestone RELEASE_050_SOURCE_PREPARED:\n(?:  .*\n)*?  state reached$/m,
  );
  assert.match(
    plan,
    /^task RELEASE_050_PUBLISH RELEASE_050_CANDIDATE_ACCEPTED -> RELEASE_050_PUBLISHED:$/m,
  );
  assert.match(plan, /npm latest promotion and Issue #4 closure remain separate/);

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.5.0");
  assert.equal(lockfile.version, "0.5.0");
  assert.equal(lockfile.packages[""].version, "0.5.0");
  assert.match(versionSource, /TOOL_VERSION = "0\.5\.0"/);
  assert.match(changelog, /^## \[0\.5\.0\] - 2026-07-29$/m);
  assert.match(
    changelog,
    /^\[0\.5\.0\]: https:\/\/github\.com\/mako10k\/perttool\/compare\/v0\.4\.0\.\.\.v0\.5\.0$/m,
  );
  assert.match(readme, /npx --yes --package=perttool@0\.5\.0/);
  assert.match(
    readme,
    /prepared release will move npm `beta` to Contract 6 `0\.5\.0`/,
  );
  assert.match(
    migration,
    /Prepared release target: `perttool@0\.5\.0`/,
  );
  assert.equal(manifest.publishConfig.tag, "beta");
});
