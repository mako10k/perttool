import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  checkDocument,
  getJsonSchemaCatalog,
  getProjectMetadata,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("0.5.1 release gate fixes the compatible Contract 6 patch boundary", async () => {
  const [
    requirements,
    adr,
    design,
    procedure,
    publish,
    acceptance,
    review,
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
    repositoryText("docs/process/0.5.1-release.md"),
    repositoryText("docs/process/0.5.1-publish.md"),
    repositoryText("docs/process/0.5.1-release-acceptance.md"),
    repositoryText("docs/process/0.5.1-self-review.md"),
    repositoryText("plans/release-0.5.1.pert"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
    repositoryText("src/version.ts"),
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
  ]);

  assert.match(
    requirements,
    /^### 21\.7 Contract 6 compatible patch release acceptance criteria$/m,
  );
  const releaseSection = requirements.split(
    "### 21.7 Contract 6 compatible patch release acceptance criteria",
  )[1].split("### 21.8 Complete JSON Schema patch release acceptance criteria")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  assert.match(adr, /Select suffix-free `0\.5\.1`/);
  assert.match(
    design,
    /^### Post-MVP Slice 4K: Compatible Contract 6 `v0\.5\.1` beta patch$/m,
  );
  assert.match(procedure, /Target version: `0\.5\.1`/);
  assert.match(
    procedure,
    /Status: Accepted, advanced, and latest-promoted 1\.5/,
  );
  assert.match(procedure, /authorizes this complete named sequence/);
  assert.match(procedure, /does not authorize npm `latest` promotion/);
  assert.match(
    procedure,
    /93f3e01a22a41a7260792cba8df3ec9e47deedd4647b8c61616bb58886941339/,
  );
  assert.match(publish, /Document status: Published 1\.0/);
  assert.match(
    publish,
    /Release commit: `31d162adb095479ac268f3f99778bac53e806b4b`/,
  );
  assert.match(publish, /No\s+publish retry occurred/);
  assert.match(
    acceptance,
    /Document status: Accepted, advanced, and latest-promoted 1\.2/,
  );
  assert.match(
    acceptance,
    /All five release-plan tasks and 17p are complete/,
  );
  assert.match(acceptance, /all 33 prior\s+command descriptors/);
  assert.match(acceptance, /all 108 prior public exports/);
  assert.match(review, /Document status: Accepted 1\.0/);
  assert.match(review, /All 33 retained byte-semantically/);
  assert.match(review, /All 108 retained/);
  assert.match(review, /Both gaps are corrected/);

  const checked = checkDocument(plan);
  const metadata = getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_051");
  assert.equal(metadata.grammarVersion, 5);
  assert.equal(metadata.project.finish, "RELEASE_051_ACCEPTED");
  assert.equal(metadata.project.governance.effective.goalOwner, "user");
  assert.equal(metadata.project.governance.effective.dagOwner, "user");

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.10.5");
  assert.equal(lockfile.version, "0.10.5");
  assert.equal(lockfile.packages[""].version, "0.10.5");
  assert.equal(manifest.publishConfig.tag, "beta");
  assert.deepEqual(Object.keys(manifest.exports), [
    ".",
    "./core",
    "./node",
    "./schemas/*",
  ]);
  assert.match(versionSource, /TOOL_VERSION = "0\.10\.5"/);
  assert.match(changelog, /^## \[0\.5\.1\] - 2026-07-30$/m);
  assert.equal(COMMAND_REGISTRY.length, 56);
  assert.equal(getJsonSchemaCatalog().length, 23);
});
