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
  )[1].split("## 22.")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  );
  assert.match(adr, /Select suffix-free `0\.4\.0`/);
  assert.match(
    design,
    /^### Post-MVP Slice 4H: Contract 5 `v0\.4\.0` beta release$/m,
  );
  assert.match(procedure, /Status: Source prepared 1\.1/);
  assert.match(procedure, /Expected pre-publication default: `beta=latest=0\.3\.0`/);
  assert.match(
    procedure,
    /2026-07-28 instruction to perform the\s+next release task authorizes `RELEASE_040_PREPARATION`/,
  );
  assert.match(
    procedure,
    /`RELEASE_040_PUBLISH` remains blocked until a separate user instruction/,
  );
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
  assert.doesNotMatch(plan, /^milestone RELEASE_040_CONTRACT_5_READY:/m);
  assert.match(
    plan,
    /^milestone RELEASE_040_SOURCE_PREPARED:\n(?:  .*\n)*?  state reached$/m,
  );
  assert.match(plan, /Complete NextResult v4 recommends RELEASE_040_CANDIDATE/);
  assert.match(plan, /^task RELEASE_040_PUBLISH /m);
  assert.match(plan, /^task RELEASE_040_ACCEPTANCE /m);
  assert.match(
    plan,
    /task RELEASE_040_PUBLISH[\s\S]*?  status blocked[\s\S]*?  blocked_reason "Await separate explicit user authorization/,
  );
  assert.match(plan, /npm latest promotion and Issue #4 closure remain separate/);

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.4.0");
  assert.equal(lockfile.version, "0.4.0");
  assert.equal(lockfile.packages[""].version, "0.4.0");
  assert.match(versionSource, /TOOL_VERSION = "0\.4\.0"/);
  assert.match(changelog, /^## \[0\.4\.0\] - 2026-07-28$/m);
  assert.match(
    changelog,
    /^\[0\.4\.0\]: https:\/\/github\.com\/mako10k\/perttool\/compare\/v0\.3\.0\.\.\.v0\.4\.0$/m,
  );
  assert.match(readme, /npx --yes --package=perttool@0\.4\.0/);
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
