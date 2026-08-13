import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ADVANCE_RESULT_SCHEMA_VERSION,
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

test("0.6.0 release gate binds advance history safety and migration", async () => {
  const [
    requirements,
    design,
    procedure,
    migration,
    review,
    publish,
    acceptance,
    plan,
    manifestText,
    lockfileText,
    versionSource,
    mutationSource,
    changelog,
    readme,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.6.0-release.md"),
    repositoryText("docs/process/0.5.5-to-0.6.0-migration.md"),
    repositoryText("docs/process/0.6.0-self-review.md"),
    repositoryText("docs/process/0.6.0-publish.md"),
    repositoryText("docs/process/0.6.0-release-acceptance.md"),
    repositoryText("plans/release-0.6.0.pert"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
    repositoryText("src/version.ts"),
    repositoryText("src/application/contract6-mutation.ts"),
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
  ]);

  assert.match(
    requirements,
    /^### 21\.12 Advance history safety release acceptance criteria$/m,
  );
  assert.match(
    design,
    /^### Post-MVP Slice 4P: Advance history safety `v0\.6\.0` beta minor$/m,
  );
  assert.match(procedure, /Target version: `0\.6\.0`/);
  assert.match(procedure, /Expected pre-publication tags: `beta=latest=0\.5\.5`/);
  assert.match(procedure, /modification time/);
  assert.match(procedure, /0\.6\.0-publish\.md/);
  assert.match(procedure, /0\.6\.0-release-acceptance\.md/);
  assert.match(migration, /Source result: `Perttool\.MutationResult\.v3`/);
  assert.match(migration, /Target result: `Perttool\.AdvanceResult\.v1`/);
  assert.match(migration, /deprecated[\s\S]*source-compatibility alias/);
  assert.match(review, /`0\.5\.6` would understate/);
  assert.match(review, /all preserved/);
  assert.match(publish, /- Status: Complete/);
  assert.match(
    publish,
    /Release commit: `935b097420d93597b17819a210e588553b1a4c06`/,
  );
  assert.match(publish, /CI:[\s\S]*30631050662/);
  assert.match(publish, /`beta=0\.6\.0`, unchanged `latest=0\.5\.5`/);
  assert.match(publish, /publication was[\s\S]*not retried/);
  assert.match(acceptance, /- Document status: Complete/);
  assert.match(acceptance, /Publication record commit: `d58ef68922d895649b19b9f5127135c5d504d626`/);
  assert.match(acceptance, /`history_guard\.status=passed`/);
  assert.match(acceptance, /npm `latest` promotion,[\s\S]*were not[\s\S]*performed/);

  const checked = checkDocument(plan);
  const metadata = getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_060");
  assert.equal(metadata.grammarVersion, 5);
  assert.equal(metadata.project.finish, "RELEASE_060_ACCEPTED");
  assert.equal(metadata.project.governance.effective.goalOwner, "user");
  assert.equal(metadata.project.governance.effective.dagOwner, "user");
  assert.deepEqual(
    checked.document.declarations
      .filter(({ kind }) => kind === "task")
      .map(({ id }) => id),
    [
      "RELEASE_060_SELF_REVIEW",
      "RELEASE_060_PREPARATION",
      "RELEASE_060_CANDIDATE",
      "RELEASE_060_PUBLISH",
      "RELEASE_060_ACCEPTANCE",
    ],
  );

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.9.0");
  assert.equal(lockfile.version, "0.9.0");
  assert.equal(lockfile.packages[""].version, "0.9.0");
  assert.equal(manifest.publishConfig.tag, "beta");
  assert.match(versionSource, /TOOL_VERSION = "0\.9\.0"/);
  assert.match(mutationSource, /@deprecated Use AdvanceResultV1/);
  assert.match(changelog, /^## \[0\.6\.0\] - 2026-07-31$/m);
  assert.match(
    readme,
    /does not move npm `latest` from Contract 6\s+`0\.6\.0`/,
  );
  assert.equal(ADVANCE_RESULT_SCHEMA_VERSION, "Perttool.AdvanceResult.v3");
  assert.equal(COMMAND_REGISTRY.length, 53);
  assert.equal(getJsonSchemaCatalog().length, 23);
});
