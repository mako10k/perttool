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

test("0.5.5 release gate binds the governed-preview warning boundary", async () => {
  const [
    requirements,
    design,
    procedure,
    publish,
    acceptance,
    review,
    authority,
    contract,
    plan,
    manifestText,
    lockfileText,
    versionSource,
    changelog,
    readme,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.5.5-release.md"),
    repositoryText("docs/process/0.5.5-publish.md"),
    repositoryText("docs/process/0.5.5-release-acceptance.md"),
    repositoryText("docs/process/0.5.5-self-review.md"),
    repositoryText("src/governance/authority.ts"),
    repositoryText("docs/specs/governance-interface.md"),
    repositoryText("plans/release-0.5.5.pert"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
    repositoryText("src/version.ts"),
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
  ]);

  assert.match(
    requirements,
    /^### 21\.11 Governed-preview warning patch release acceptance criteria$/m,
  );
  assert.match(
    design,
    /^### Post-MVP Slice 4O: Governed-preview assertion warning `v0\.5\.5` beta patch$/m,
  );
  assert.match(procedure, /Target version: `0\.5\.5`/);
  assert.match(procedure, /npm `latest` promotion/);
  assert.match(procedure, /modification time/);
  assert.match(procedure, /0\.5\.5-publish\.md/);
  assert.match(publish, /Version: `0\.5\.5`/);
  assert.match(procedure, /0\.5\.5-release-acceptance\.md/);
  assert.match(acceptance, /Version: `0\.5\.5`/);
  assert.match(acceptance, /`beta=latest=0\.5\.5`/);
  assert.match(acceptance, /`PTGOV-101` with `actor_required`/);
  assert.match(review, /five previews and\s+five persistent attempts/);
  assert.match(review, /does not classify the five persistent attempts/);
  assert.match(authority, /code: "PTGOV-104"/);
  assert.match(contract, /owner_confirmation_on_governed_preview/);
  assert.match(contract, /`--warnings-as-errors`/);

  const checked = checkDocument(plan);
  const metadata = getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_055");
  assert.equal(metadata.grammarVersion, 5);
  assert.equal(metadata.project.finish, "RELEASE_055_ACCEPTED");
  assert.equal(metadata.project.governance.effective.goalOwner, "user");
  assert.equal(metadata.project.governance.effective.dagOwner, "user");
  assert.deepEqual(
    checked.document.declarations
      .filter(({ kind }) => kind === "task")
      .map(({ id }) => id),
    [],
  );
  assert.match(
    plan,
    /^milestone RELEASE_055_ACCEPTED:\n(?:  .*\n)*?  state reached$/m,
  );

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.10.4");
  assert.equal(lockfile.version, "0.10.4");
  assert.equal(lockfile.packages[""].version, "0.10.4");
  assert.equal(manifest.publishConfig.tag, "beta");
  assert.match(versionSource, /TOOL_VERSION = "0\.10\.4"/);
  assert.match(changelog, /^## \[0\.5\.5\] - 2026-07-30$/m);
  assert.match(readme, /npx --yes --package=perttool@0\.9\.4/);
  assert.match(
    readme,
    /does not move npm `latest` from Contract 6\s+`0\.6\.0`/,
  );
  assert.equal(COMMAND_REGISTRY.length, 56);
  assert.equal(getJsonSchemaCatalog().length, 23);
});
