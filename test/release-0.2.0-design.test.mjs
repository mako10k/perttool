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

test("0.2.0 release identity is selected without changing package identity", async () => {
  const [
    requirements,
    adr,
    specification,
    migration,
    procedure,
    manifestText,
    lockText,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/adr/0003-beta-versioning.md"),
    repositoryText("docs/specs/cli-contract-3.md"),
    repositoryText("docs/process/cli-contract-3-migration.md"),
    repositoryText("docs/process/0.2.0-release.md"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
  ]);

  assert.match(requirements, /^### 21\.3 CLI Contract 3 beta release acceptance criteria$/m);
  const releaseSection = requirements.split(
    "### 21.3 CLI Contract 3 beta release acceptance criteria",
  )[1].split("## 22.")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.match(adr, /Select suffix-free `0\.2\.0`/);
  assert.match(specification, /suffix-free `0\.2\.0` as the first Contract 3 package/);
  assert.match(migration, /selects\nsuffix-free `0\.2\.0`/);
  assert.match(procedure, /Status: Release gate accepted; source preparation pending/);

  const manifest = JSON.parse(manifestText);
  const lock = JSON.parse(lockText);
  assert.equal(manifest.version, "0.1.0");
  assert.equal(lock.version, "0.1.0");
  assert.equal(lock.packages[""].version, "0.1.0");
  assert.equal(manifest.publishConfig.tag, "beta");
});

test("0.2.0 plan preserves preparation, authorization, and acceptance boundaries", async () => {
  const [plan, procedure] = await Promise.all([
    repositoryText("plans/release-0.2.0.pert"),
    repositoryText("docs/process/0.2.0-release.md"),
  ]);

  assert.doesNotMatch(plan, /^task RELEASE_020_GATE_DESIGN /m);
  for (const taskId of [
    "RELEASE_020_PREPARATION",
    "RELEASE_020_CANDIDATE",
    "RELEASE_020_DISTRIBUTION",
    "RELEASE_020_ACCEPTANCE",
  ]) {
    assert.match(plan, new RegExp(`^task ${taskId} `, "m"));
  }
  assert.match(
    plan,
    /^milestone RELEASE_020_GATE_ACCEPTED:\n  title "Version 0\.2\.0 release gate accepted"\n  state reached$/m,
  );
  assert.match(
    plan,
    /task RELEASE_020_DISTRIBUTION[\s\S]*?status blocked[\s\S]*?blocked_reason "Requires explicit user authorization/,
  );
  assert.match(
    procedure,
    /Generate one tarball outside the worktree[\s\S]*Create a GitHub prerelease[\s\S]*publish the same\n   tarball exactly once/,
  );
  assert.match(procedure, /npm publication tag: `beta`/);
  assert.match(procedure, /`latest` promotion is a separate post-acceptance decision/);
  assert.match(procedure, /Do not retry an ambiguous GitHub or npm mutation/);
});
