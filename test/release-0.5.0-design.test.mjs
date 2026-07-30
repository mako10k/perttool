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
    publishRecord,
    acceptanceRecord,
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
    repositoryText("docs/process/0.5.0-publish.md"),
    repositoryText("docs/process/0.5.0-release-acceptance.md"),
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
  )[1].split("### 21.7 Contract 6 compatible patch release acceptance criteria")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  assert.match(adr, /Select suffix-free `0\.5\.0`/);
  assert.match(
    design,
    /^### Post-MVP Slice 4J: Contract 6 `v0\.5\.0` beta release$/m,
  );
  assert.match(
    procedure,
    /Status: Accepted, advanced, and locally installed 1\.9/,
  );
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
  assert.match(publishRecord, /Document status: Published 1\.0/);
  assert.match(
    publishRecord,
    /af819b44ab0f138c09dc2c96d35b65bc9aad497c/,
  );
  assert.match(
    publishRecord,
    /f3ba9b3f52dd055618084bde5e9fa51e98adf3e0e29e10ac8c7e09fd4142208c/,
  );
  assert.match(publishRecord, /\| `beta` \| `0\.5\.0` \|/);
  assert.match(publishRecord, /\| `latest` \| `0\.4\.0` \|/);
  assert.match(publishRecord, /five propagation-time `E404` responses/);
  assert.match(publishRecord, /No publish\s+retry occurred/);
  assert.match(
    acceptanceRecord,
    /Document status: Accepted, advanced, and locally installed 1\.2/,
  );
  assert.match(
    acceptanceRecord,
    /f3ba9b3f52dd055618084bde5e9fa51e98adf3e0e29e10ac8c7e09fd4142208c/,
  );
  assert.match(acceptanceRecord, /\| `beta` \| `0\.5\.0` \|/);
  assert.match(acceptanceRecord, /\| `latest` \| `0\.4\.0` \|/);
  assert.match(
    acceptanceRecord,
    /complete Contract 6\s+file-first workflow/,
  );
  assert.match(acceptanceRecord, /npm install --global perttool@0\.5\.0/);
  assert.match(
    acceptanceRecord,
    /lib\/node_modules\/perttool\/dist\/cli\.js/,
  );
  assert.match(acceptanceRecord, /exactly 33 commands/);
  assert.match(acceptanceRecord, /Perttool\.ProjectHistoryResult\.v1/);
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
  assert.doesNotMatch(plan, /^milestone RELEASE_050_SOURCE_PREPARED:/m);
  assert.doesNotMatch(plan, /^task RELEASE_050_CANDIDATE /m);
  assert.doesNotMatch(plan, /^milestone RELEASE_050_CANDIDATE_ACCEPTED:/m);
  assert.doesNotMatch(plan, /^task RELEASE_050_PUBLISH /m);
  assert.doesNotMatch(plan, /^milestone RELEASE_050_PUBLISHED:/m);
  assert.doesNotMatch(plan, /^task RELEASE_050_ACCEPTANCE /m);
  assert.match(
    plan,
    /^milestone RELEASE_050_ACCEPTED:\n(?:  .*\n)*?  state reached$/m,
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
    /npm `beta` now resolves to Contract 6 `0\.5\.0`/,
  );
  assert.match(
    migration,
    /Published target: `perttool@0\.5\.0`/,
  );
  assert.equal(manifest.publishConfig.tag, "beta");
});
