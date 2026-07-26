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

test("0.2.0 release record preserves Contract 3 package identity and guidance", async () => {
  const [
    requirements,
    adr,
    specification,
    migration,
    procedure,
    acceptance,
    changelog,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/adr/0003-beta-versioning.md"),
    repositoryText("docs/specs/cli-contract-3.md"),
    repositoryText("docs/process/cli-contract-3-migration.md"),
    repositoryText("docs/process/0.2.0-release.md"),
    repositoryText("docs/process/0.2.0-release-acceptance.md"),
    repositoryText("CHANGELOG.md"),
  ]);

  assert.match(requirements, /^### 21\.3 CLI Contract 3 beta release acceptance criteria$/m);
  const releaseSection = requirements.split(
    "### 21.3 CLI Contract 3 beta release acceptance criteria",
  )[1].split("### 21.4 ")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.match(adr, /Select suffix-free `0\.2\.0`/);
  assert.match(specification, /suffix-free `0\.2\.0` as the first Contract 3 package/);
  assert.match(migration, /selects\nsuffix-free `0\.2\.0`/);
  assert.match(procedure, /Status: Accepted 1\.0/);
  assert.match(
    acceptance,
    /Local, GitHub, and registry tarball SHA-256 \| `26ab6fc3f27574f293e985032d3701e4ca1ae69f2471e6c58d0a2e4bc0cbe52b`/,
  );
  assert.match(changelog, /^## \[0\.2\.0\] - 2026-07-25$/m);
  assert.match(acceptance, /`beta` and `latest` now resolve to Contract 3 `0\.2\.0`/);
  assert.match(acceptance, /\| `latest` \| `0\.2\.0` \|/);
});

test("0.2.0 completed plan preserves release and acceptance boundaries", async () => {
  const [plan, procedure, acceptance] = await Promise.all([
    repositoryText("plans/release-0.2.0.pert"),
    repositoryText("docs/process/0.2.0-release.md"),
    repositoryText("docs/process/0.2.0-release-acceptance.md"),
  ]);

  assert.doesNotMatch(plan, /^task RELEASE_020_/m);
  assert.match(
    plan,
    /^milestone RELEASE_020_ACCEPTED:\n  title "Version 0\.2\.0 Contract 3 beta accepted"\n  state reached$/m,
  );
  assert.doesNotMatch(plan, /blocked_reason "Requires explicit user authorization/);
  assert.match(
    procedure,
    /Generate one tarball outside the worktree[\s\S]*Create a GitHub prerelease[\s\S]*publish the same\n   tarball exactly once/,
  );
  assert.match(procedure, /npm publication tag: `beta`/);
  assert.match(procedure, /`latest` promotion is a separate post-acceptance decision/);
  assert.match(procedure, /Do not retry an ambiguous GitHub or npm mutation/);
  assert.match(acceptance, /Status: Accepted 1\.1/);
  assert.match(
    acceptance,
    /Current unauthenticated[\s\S]*\| `latest` \| `0\.2\.0` \|/,
  );
  assert.match(acceptance, /no remaining recommendation/);
});
