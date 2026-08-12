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

test("0.5.4 release gate binds the governance runtime warning boundary", async () => {
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
    repositoryText("docs/process/0.5.4-release.md"),
    repositoryText("docs/process/0.5.4-publish.md"),
    repositoryText("docs/process/0.5.4-release-acceptance.md"),
    repositoryText("docs/process/0.5.4-self-review.md"),
    repositoryText("src/governance/authority.ts"),
    repositoryText("docs/specs/governance-interface.md"),
    repositoryText("plans/release-0.5.4.pert"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
    repositoryText("src/version.ts"),
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
  ]);

  assert.match(
    requirements,
    /^### 21\.10 Governance runtime warning patch release acceptance criteria$/m,
  );
  assert.match(
    design,
    /^### Post-MVP Slice 4N: Governance runtime warning `v0\.5\.4` beta patch$/m,
  );
  assert.match(procedure, /Target version: `0\.5\.4`/);
  assert.match(procedure, /npm `latest` promotion/);
  assert.match(procedure, /modification time/);
  assert.match(procedure, /0\.5\.4-publish\.md/);
  assert.match(publish, /9c2351057c59a57f74a099007316d7ebee5d575a/);
  assert.match(publish, /30536185188/);
  assert.match(publish, /The publication was not retried/);
  assert.match(publish, /unchanged `latest=0\.5\.1`/);
  assert.match(procedure, /0\.5\.4-release-acceptance\.md/);
  assert.match(acceptance, /58 files with\s+1390 insertions and 158 deletions/);
  assert.match(acceptance, /write\.written\s+false/);
  assert.match(acceptance, /NextResult v5 has no ready, recommended, or startable task/);
  assert.match(review, /18 ordinary-maintenance/);
  assert.match(review, /does not claim to\s+detect the 10 governed/);
  assert.match(authority, /code: "PTGOV-103"/);
  assert.match(
    contract,
    /owner_confirmation_not_applicable/,
  );
  assert.match(contract, /`--warnings-as-errors`/);

  const checked = checkDocument(plan);
  const metadata = getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_054");
  assert.equal(metadata.grammarVersion, 5);
  assert.equal(metadata.project.finish, "RELEASE_054_ACCEPTED");
  assert.equal(metadata.project.governance.effective.goalOwner, "user");
  assert.equal(metadata.project.governance.effective.dagOwner, "user");
  assert.deepEqual(
    checked.document.declarations
      .filter(({ kind }) => kind === "task")
      .map(({ id }) => id),
    [
      "RELEASE_054_SELF_REVIEW",
      "RELEASE_054_PREPARATION",
      "RELEASE_054_CANDIDATE",
      "RELEASE_054_PUBLISH",
      "RELEASE_054_ACCEPTANCE",
    ],
  );

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.8.0");
  assert.equal(lockfile.version, "0.8.0");
  assert.equal(lockfile.packages[""].version, "0.8.0");
  assert.equal(manifest.publishConfig.tag, "beta");
  assert.match(versionSource, /TOOL_VERSION = "0\.8\.0"/);
  assert.match(changelog, /^## \[0\.5\.4\] - 2026-07-30$/m);
  assert.match(readme, /npx --yes --package=perttool@0\.8\.0/);
  assert.match(
    readme,
    /does not move npm `latest` from Contract 6\s+`0\.6\.0`/,
  );
  assert.equal(COMMAND_REGISTRY.length, 53);
  assert.equal(getJsonSchemaCatalog().length, 23);
});
