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

test("0.5.3 release gate binds the governance guidance patch boundary", async () => {
  const [
    requirements,
    design,
    procedure,
    publish,
    acceptance,
    review,
    experiment,
    plan,
    manifestText,
    lockfileText,
    versionSource,
    changelog,
    readme,
    publishScript,
    guideSource,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.5.3-release.md"),
    repositoryText("docs/process/0.5.3-publish.md"),
    repositoryText("docs/process/0.5.3-release-acceptance.md"),
    repositoryText("docs/process/0.5.3-self-review.md"),
    repositoryText("docs/process/governance-assertion-scope-experiment.md"),
    repositoryText("plans/release-0.5.3.pert"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
    repositoryText("src/version.ts"),
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
    repositoryText("scripts/publish-npm.sh"),
    repositoryText("src/help/target-governance-guide.ts"),
  ]);

  assert.match(
    requirements,
    /^### 21\.9 Governance guidance patch release acceptance criteria$/m,
  );
  const releaseSection = requirements.split(
    "### 21.9 Governance guidance patch release acceptance criteria",
  )[1].split(
    "### 21.10 Governance runtime warning patch release acceptance criteria",
  )[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  );
  assert.match(
    design,
    /^### Post-MVP Slice 4M: Governance guidance `v0\.5\.3` beta patch$/m,
  );
  assert.match(procedure, /Target version: `0\.5\.3`/);
  assert.match(procedure, /npm `latest` promotion/);
  assert.match(procedure, /absent `alpha`/);
  assert.match(publish, /Document status: Published 1\.0/);
  assert.match(
    publish,
    /Release commit: `1dc7c055d541272fd4506e21f99ee6a0bdf33c17`/,
  );
  assert.match(publish, /one propagation-time `E404`/);
  assert.match(publish, /No npm publish retry occurred/);
  assert.match(acceptance, /Document status: Accepted 1\.0/);
  assert.match(acceptance, /All five release-plan tasks and 15p are complete/);
  assert.match(acceptance, /corrected\s+field-aware query passed/);
  assert.match(acceptance, /completed declarations are intentionally retained/);
  assert.match(acceptance, /52 files\s+changed/);
  assert.match(review, /Document status: Accepted 1\.0/);
  assert.match(review, /raw digests were a poor primary explanation/);
  assert.match(experiment, /current_modified_at/);
  assert.match(experiment, /size_bytes/);
  assert.match(experiment, /semantic_diff/);
  assert.match(experiment, /supplemental because a person cannot infer/);
  assert.match(guideSource, /available modification time/);
  assert.match(guideSource, /byte size before and after/);
  assert.match(guideSource, /supplemental machine identity/);

  const checked = checkDocument(plan);
  const metadata = getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_053");
  assert.equal(metadata.grammarVersion, 5);
  assert.equal(metadata.project.finish, "RELEASE_053_ACCEPTED");
  assert.equal(metadata.project.governance.effective.goalOwner, "user");
  assert.equal(metadata.project.governance.effective.dagOwner, "user");
  assert.deepEqual(
    checked.document.declarations
      .filter(({ kind }) => kind === "task")
      .map(({ id }) => id),
    [
      "RELEASE_053_SELF_REVIEW",
      "RELEASE_053_PREPARATION",
      "RELEASE_053_CANDIDATE",
      "RELEASE_053_PUBLISH",
      "RELEASE_053_ACCEPTANCE",
    ],
  );

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  assert.equal(manifest.version, "0.5.5");
  assert.equal(lockfile.version, "0.5.5");
  assert.equal(lockfile.packages[""].version, "0.5.5");
  assert.equal(manifest.publishConfig.tag, "beta");
  assert.match(versionSource, /TOOL_VERSION = "0\.5\.5"/);
  assert.match(changelog, /^## \[0\.5\.3\] - 2026-07-30$/m);
  assert.match(
    readme,
    /Scope-bound, human-readable loose owner-confirmation guidance requires\s+`0\.5\.3`/,
  );
  assert.match(
    readme,
    /npm `beta`, npm `latest`, and an unqualified install resolve to Contract 6\s+`0\.5\.5`/,
  );
  assert.match(publishScript, /publish_tag" != "beta"/);
  assert.doesNotMatch(publishScript, /^\s*alpha\)$/m);
  assert.equal(COMMAND_REGISTRY.length, 34);
  assert.equal(getJsonSchemaCatalog().length, 19);
});
