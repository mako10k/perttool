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

test("0.5.2 release gate binds the complete JSON Schema patch boundary", async () => {
  const [
    requirements,
    adr,
    design,
    procedure,
    publish,
    acceptance,
    review,
    schemaContract,
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
    repositoryText("docs/process/0.5.2-release.md"),
    repositoryText("docs/process/0.5.2-publish.md"),
    repositoryText("docs/process/0.5.2-release-acceptance.md"),
    repositoryText("docs/process/0.5.2-self-review.md"),
    repositoryText("docs/specs/json-schema.md"),
    repositoryText("plans/release-0.5.2.pert"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
    repositoryText("src/version.ts"),
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
  ]);

  assert.match(
    requirements,
    /^### 21\.8 Complete JSON Schema patch release acceptance criteria$/m,
  );
  const releaseSection = requirements.split(
    "### 21.8 Complete JSON Schema patch release acceptance criteria",
  )[1].split("### 21.9 Governance guidance patch release acceptance criteria")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  );
  assert.match(adr, /Select suffix-free `0\.5\.2`/);
  assert.match(
    design,
    /^### Post-MVP Slice 4L: Complete JSON Schema `v0\.5\.2` beta patch$/m,
  );
  assert.match(
    procedure,
    /Status: Accepted and advanced 1\.5/,
  );
  assert.match(procedure, /Target version: `0\.5\.2`/);
  assert.match(procedure, /authorizes this complete named sequence/);
  assert.match(procedure, /does not\s+authorize npm `latest` promotion/);
  assert.match(procedure, /passed 655 tests/);
  assert.match(procedure, /all 23 self-use plans/);
  assert.match(
    procedure,
    /e8512f0d3e20764e9397af827f6ea57f8bea7361d1e414102b0350bcaa54bbce/,
  );
  assert.match(procedure, /No external state was\s+changed/);
  assert.match(publish, /Document status: Published 1\.0/);
  assert.match(
    publish,
    /Release commit: `501d4b1ad83184bd12ba86a7fa19f7df2b58789f`/,
  );
  assert.match(publish, /No publish retry occurred/);
  assert.match(acceptance, /Document status: Accepted 1\.0/);
  assert.match(acceptance, /all 116 prior runtime exports remain/i);
  assert.match(
    acceptance,
    /33 non-schema command descriptors are byte-identical/,
  );
  assert.match(acceptance, /No product failure, compatibility mismatch/);
  assert.match(review, /Document status: Accepted 1\.0/);
  assert.match(review, /No blocking correctness, compatibility, package/);
  assert.match(review, /All 34 commands remain/);
  assert.match(review, /All 116 existing runtime exports remain/);

  assert.match(schemaContract, /--view full\|outline/);
  assert.match(schemaContract, /`--ref` requires `--view outline`/);
  assert.match(schemaContract, /performs no\s+network access/);

  const checked = checkDocument(plan);
  const metadata = getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_052");
  assert.equal(metadata.grammarVersion, 5);
  assert.equal(metadata.project.finish, "RELEASE_052_ACCEPTED");
  assert.equal(metadata.project.governance.effective.goalOwner, "user");
  assert.equal(metadata.project.governance.effective.dagOwner, "user");

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.10.2");
  assert.equal(lockfile.version, "0.10.2");
  assert.equal(lockfile.packages[""].version, "0.10.2");
  assert.equal(manifest.publishConfig.tag, "beta");
  assert.deepEqual(Object.keys(manifest.exports), [
    ".",
    "./core",
    "./node",
    "./schemas/*",
  ]);
  assert.match(versionSource, /TOOL_VERSION = "0\.10\.2"/);
  assert.match(changelog, /^## \[0\.5\.2\] - 2026-07-30$/m);
  assert.match(readme, /available by pinning `0\.5\.2`/);
  assert.match(
    readme,
    /does not move npm `latest` from Contract 6\s+`0\.6\.0`/,
  );
  assert.equal(COMMAND_REGISTRY.length, 56);
  assert.equal(getJsonSchemaCatalog().length, 23);
});
