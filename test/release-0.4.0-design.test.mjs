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

test("0.4.0 release gate keeps Contract 5 acceptance and publication separate", async () => {
  const [
    requirements,
    adr,
    design,
    procedure,
    publishRecord,
    acceptanceRecord,
    governanceAcceptance,
    readiness,
    plan,
    manifestText,
    lockfileText,
    versionSource,
    changelog,
    readme,
    migration,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/adr/0003-beta-versioning.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.4.0-release.md"),
    repositoryText("docs/process/0.4.0-publish.md"),
    repositoryText("docs/process/0.4.0-release-acceptance.md"),
    repositoryText("docs/process/governance-acceptance.md"),
    repositoryText("docs/process/0.4.0-contract5-readiness.md"),
    repositoryText("plans/release-0.4.0.pert"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
    repositoryText("src/version.ts"),
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
    repositoryText("docs/process/cli-contract-5-migration.md"),
  ]);

  assert.match(
    requirements,
    /^### 21\.5 CLI Contract 5 beta release acceptance criteria$/m,
  );
  const releaseSection = requirements.split(
    "### 21.5 CLI Contract 5 beta release acceptance criteria",
  )[1].split("### 21.6 CLI Contract 6 beta release acceptance criteria")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  assert.match(adr, /Select suffix-free `0\.4\.0`/);
  assert.match(
    design,
    /^### Post-MVP Slice 4H: Contract 5 `v0\.4\.0` beta release$/m,
  );
  assert.match(procedure, /Status: Accepted 1\.5/);
  assert.match(procedure, /Expected pre-publication default: `beta=latest=0\.3\.0`/);
  assert.match(
    procedure,
    /instruction to continue authorized\s+`RELEASE_040_CANDIDATE`/,
  );
  assert.match(
    procedure,
    /instruction to proceed authorized only the named `0\.4\.0` external\s+PUBLISH batch/,
  );
  assert.match(publishRecord, /Document status: Published 1\.0/);
  assert.match(
    publishRecord,
    /6b341d1913bd943d872b14d7ef48645ac7b26667/,
  );
  assert.match(
    publishRecord,
    /010af9ce2290ade99c191b0c6a9ea485d5ae23ec1241113dfbc1d275b387cc4a/,
  );
  assert.match(publishRecord, /`beta` \| `0\.4\.0`/);
  assert.match(publishRecord, /`latest` \| `0\.3\.0`/);
  assert.match(publishRecord, /No publish\s+retry occurred/);
  assert.match(acceptanceRecord, /Document status: Accepted 1\.1/);
  assert.match(
    acceptanceRecord,
    /010af9ce2290ade99c191b0c6a9ea485d5ae23ec1241113dfbc1d275b387cc4a/,
  );
  assert.match(acceptanceRecord, /`beta` \| `0\.4\.0`/);
  assert.match(acceptanceRecord, /`latest` \| `0\.3\.0`/);
  assert.match(acceptanceRecord, /npm dist-tag add perttool@0\.4\.0 latest/);
  assert.match(acceptanceRecord, /`latest` \| `0\.4\.0`/);
  assert.match(governanceAcceptance, /Document status: Accepted/);
  assert.match(governanceAcceptance, /Published package boundary: `0\.3\.0`/);
  assert.match(readiness, /Document status: Accepted 1\.0/);
  assert.match(readiness, /starts only\s+`RELEASE_040_PREPARATION`/);

  assert.match(plan, /^project RELEASE_040:$/m);
  assert.match(plan, /^  version 4$/m);
  assert.match(plan, /^  goal_owner user$/m);
  assert.match(plan, /^  dag_owner user$/m);
  assert.doesNotMatch(plan, /^task RELEASE_040_GATE_DESIGN /m);
  assert.doesNotMatch(plan, /^task RELEASE_040_CONTRACT_5_READINESS /m);
  assert.doesNotMatch(plan, /^task RELEASE_040_PREPARATION /m);
  assert.doesNotMatch(plan, /^task RELEASE_040_CANDIDATE /m);
  assert.doesNotMatch(plan, /^milestone RELEASE_040_CONTRACT_5_READY:/m);
  assert.doesNotMatch(plan, /^milestone RELEASE_040_SOURCE_PREPARED:/m);
  assert.doesNotMatch(plan, /^milestone RELEASE_040_CANDIDATE_ACCEPTED:/m);
  assert.doesNotMatch(plan, /^milestone RELEASE_040_PUBLISHED:/m);
  assert.match(
    plan,
    /^milestone RELEASE_040_ACCEPTED:\n(?:  .*\n)*?  state reached$/m,
  );
  assert.doesNotMatch(plan, /^task RELEASE_040_PUBLISH /m);
  assert.doesNotMatch(plan, /^task RELEASE_040_ACCEPTANCE /m);
  assert.match(plan, /complete NextResult v4 has no recommendation/);
  assert.match(
    plan,
    /separately authorized later npm latest promotion and Issue #4 closure remain outside/,
  );
  assert.match(
    procedure,
    /010af9ce2290ade99c191b0c6a9ea485d5ae23ec1241113dfbc1d275b387cc4a/,
  );

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.7.0");
  assert.equal(lockfile.version, "0.7.0");
  assert.equal(lockfile.packages[""].version, "0.7.0");
  assert.match(versionSource, /TOOL_VERSION = "0\.7\.0"/);
  assert.match(changelog, /^## \[0\.4\.0\] - 2026-07-28$/m);
  assert.match(
    changelog,
    /^\[0\.4\.0\]: https:\/\/github\.com\/mako10k\/perttool\/compare\/v0\.3\.0\.\.\.v0\.4\.0$/m,
  );
  assert.match(readme, /exact pins\s+`perttool@0\.4\.0`/);
  assert.match(
    readme,
    /does not move npm `latest` from Contract 6\s+`0\.6\.0`/,
  );
  assert.match(
    readme,
    /Moving from `0\.3\.0` Contract 4 to `0\.4\.0` Contract 5 changes every JSON\s+envelope to `cli_contract_version=5`/,
  );
  assert.match(migration, /`Perttool\.ProjectResult\.v2` \| `Perttool\.ProjectResult\.v3`/);
  assert.match(
    migration,
    /`Perttool\.MutationResult\.v1` \| `Perttool\.MutationResult\.v2`/,
  );
  assert.match(migration, /Persistent goal or DAG\s+changes require `--actor`/);
  assert.match(migration, /repeatable `--accepted-by-owner`/);
  assert.match(migration, /A Contract 4 runtime rejects Grammar 4 fields/);
  assert.match(
    migration,
    /no `--cli-contract 4` switch, compatibility alias/,
  );
  assert.equal(manifest.publishConfig.tag, "beta");
});
