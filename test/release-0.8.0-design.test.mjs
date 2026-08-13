import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import * as perttool from "../dist/index.js";
import * as nodeApi from "../dist/node/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("0.8.0 gate binds the additive adapter and historical DAG boundary", async () => {
  const [
    requirements,
    adr,
    design,
    procedure,
    gate,
    readiness,
    preparation,
    candidate,
    publication,
    acceptance,
    latestPromotion,
    migration,
    plan,
    manifestText,
    lockfileText,
    versionSource,
    lspManifestText,
    mcpManifestText,
    changelog,
    readme,
  ] =
    await Promise.all([
      repositoryText("docs/requirements.md"),
      repositoryText("docs/adr/0003-beta-versioning.md"),
      repositoryText("docs/basic-design.md"),
      repositoryText("docs/process/0.8.0-release.md"),
      repositoryText("docs/process/0.8.0-gate-design.md"),
      repositoryText("docs/process/0.8.0-input-readiness.md"),
      repositoryText("docs/process/0.8.0-preparation.md"),
      repositoryText("docs/process/0.8.0-candidate.md"),
      repositoryText("docs/process/0.8.0-publish.md"),
      repositoryText("docs/process/0.8.0-release-acceptance.md"),
      repositoryText("docs/process/0.8.0-latest-promotion.md"),
      repositoryText("docs/process/0.7.1-to-0.8.0-migration.md"),
      repositoryText("plans/release-0.8.0.pert"),
      repositoryText("package.json"),
      repositoryText("package-lock.json"),
      repositoryText("src/version.ts"),
      repositoryText("adapters/lsp/package.json"),
      repositoryText("adapters/mcp/package.json"),
      repositoryText("CHANGELOG.md"),
      repositoryText("README.md"),
    ]);

  assert.match(
    requirements,
    /^### 21\.15 Adapter platform and historical DAG beta release acceptance criteria$/m,
  );
  const releaseSection = requirements.split(
    "### 21.15 Adapter platform and historical DAG beta release acceptance criteria",
  )[1].split("## 22.")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    Array.from({ length: 13 }, (_, index) => index + 1),
  );
  assert.match(adr, /Select suffix-free `0\.8\.0`/u);
  assert.match(adr, /`0\.7\.2` would understate/u);
  assert.match(
    design,
    /^### Post-MVP Slice 4S: Adapter platform and historical DAG `v0\.8\.0` beta minor$/m,
  );
  assert.match(procedure, /- Status: Accepted 1\.0/u);
  assert.match(
    procedure,
    /Expected pre-publication tags: `beta=latest=0\.7\.1`, no `alpha`/u,
  );
  assert.match(procedure, /user authorizes the frozen candidate and write set/u);
  assert.match(procedure, /0\.8\.0-latest-promotion\.md/u);
  assert.match(gate, /- Document status: Accepted 1\.0/u);
  assert.match(gate, /\| Commands \| 44 \| 45 \|/u);
  assert.match(gate, /\| Root schemas \| 20 \| 21 \|/u);
  assert.match(gate, /private LSP, VSIX, and MCP workspaces/u);
  assert.match(readiness, /- Document status: Accepted 1\.0/u);
  assert.match(readiness, /sha256:4b3f887a2bf5ab293ade0931cc57a9b83a972c718e201e8629f44ab386628cf5/u);
  assert.match(preparation, /- Document status: Accepted 1\.0/u);
  assert.match(preparation, /all 973 Node\.js tests/u);
  assert.match(preparation, /all 36\s+self-use plans/u);
  assert.match(preparation, /679-file isolated public-package workflow/u);
  assert.match(
    preparation,
    /Completed-plan source digest: `sha256:0cce301fc769e276ffc45626147a8d20f38bfcbced1b565e417aee5e858dc457`/u,
  );
  assert.match(candidate, /- Document status: Accepted 1\.0/u);
  assert.match(
    candidate,
    /Candidate source commit: `f9be1ccdea04d7f029383f398d6b742d8962f09d`/u,
  );
  assert.match(candidate, /Packed size \| `2753740` bytes/u);
  assert.match(candidate, /Files \| `679`/u);
  assert.match(
    candidate,
    /SHA-256 \| `d761e2a159d2d60eb981efda403cc6b00c4eac9e31503b2e857c0b851ac00b28`/u,
  );
  assert.match(candidate, /no branch-protection claim/u);
  assert.match(publication, /- Document status: Accepted 1\.0/u);
  assert.match(publication, /CI run: \[`31154880011`\]/u);
  assert.match(publication, /GitHub prerelease `366565943`/u);
  assert.match(publication, /submitted exactly once to npm `beta`/u);
  assert.match(publication, /The publish operation was\s+not retried/u);
  assert.match(acceptance, /- Document status: Accepted and latest-promoted 1\.1/u);
  assert.match(
    acceptance,
    /Final plan digest: `sha256:e5b59c620a2c0f13093a0697b7c4060a767129b14193ed4c3b23f00e5e4298df`/u,
  );
  assert.match(acceptance, /`perttool@beta` \| `perttool 0\.8\.0`/u);
  assert.match(acceptance, /`perttool@latest` \| `perttool 0\.7\.1`/u);
  assert.match(acceptance, /beta=latest=0\.8\.0/u);
  assert.match(latestPromotion, /- Document status: Accepted 1\.0/u);
  assert.match(latestPromotion, /npm dist-tag add perttool@0\.8\.0 latest/u);
  assert.match(latestPromotion, /beta=latest=0\.8\.0/u);
  assert.match(latestPromotion, /resolved to `perttool 0\.8\.0`/u);
  assert.match(migration, /Existing Grammar 1 through 6 documents/u);
  assert.match(migration, /Pin `perttool@0\.7\.1`/u);

  const checked = perttool.checkDocument(plan);
  const metadata = perttool.getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_080");
  assert.equal(metadata.grammarVersion, 6);
  assert.equal(metadata.project.finish, "RELEASE_080_ACCEPTED");
  assert.equal(metadata.project.governance.effective.goalOwner, "user");
  assert.equal(metadata.project.governance.effective.dagOwner, "user");
  assert.deepEqual(
    checked.document.declarations
      .filter(({ kind }) => kind === "task")
      .map(({ id }) => id),
    [
      "RELEASE_080_GATE_DESIGN",
      "RELEASE_080_INPUT_READINESS",
      "RELEASE_080_PREPARATION",
      "RELEASE_080_CANDIDATE",
      "RELEASE_080_PUBLISH",
      "RELEASE_080_ACCEPTANCE",
    ],
  );
  assert.deepEqual(
    checked.document.declarations
      .filter(({ kind }) => kind === "task")
      .map(({ id, fields }) => [
        id,
        fields.find(({ name }) => name === "status")?.value ?? "planned",
      ]),
    [
      ["RELEASE_080_GATE_DESIGN", "done"],
      ["RELEASE_080_INPUT_READINESS", "done"],
      ["RELEASE_080_PREPARATION", "done"],
      ["RELEASE_080_CANDIDATE", "done"],
      ["RELEASE_080_PUBLISH", "done"],
      ["RELEASE_080_ACCEPTANCE", "done"],
    ],
  );

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  const lspManifest = JSON.parse(lspManifestText);
  const mcpManifest = JSON.parse(mcpManifestText);
  assert.equal(manifest.version, "0.8.1");
  assert.equal(lockfile.version, "0.8.1");
  assert.equal(lockfile.packages[""].version, "0.8.1");
  assert.equal(lspManifest.peerDependencies.perttool, "0.8.1");
  assert.equal(mcpManifest.peerDependencies.perttool, "0.8.1");
  assert.match(versionSource, /TOOL_VERSION = "0\.8\.1"/u);
  assert.match(changelog, /^## \[0\.8\.0\] - 2026-08-07$/m);
  assert.match(readme, /package=perttool@0\.8\.1/u);
  assert.match(readme, /use\s+`0\.8\.0` as the exact rollback pin/u);
  assert.match(readme, /left independently managed\s+`latest=0\.7\.1`/u);
  assert.match(readme, /`beta=latest=0\.8\.0`/u);
  assert.deepEqual(Object.keys(manifest.exports), [
    ".",
    "./core",
    "./node",
    "./schemas/*",
  ]);
  assert.deepEqual(manifest.files, ["dist", "schemas", "CHANGELOG.md"]);
  assert.equal(Object.keys(perttool).length, 129);
  assert.equal(Object.keys(nodeApi).length, 129);
  assert.equal(Object.keys(core).length, 45);
  assert.deepEqual(Object.keys(perttool), Object.keys(nodeApi));
  for (const name of Object.keys(perttool)) {
    assert.equal(perttool[name], nodeApi[name], name);
  }
  assert.equal(perttool.COMMAND_REGISTRY.length, 53);
  assert.equal(perttool.getJsonSchemaCatalog().length, 23);
  assert.deepEqual(
    perttool.COMMAND_REGISTRY.filter(
      ({ path: commandPath }) => commandPath.join(" ") === "dag history",
    ).map(({ operation }) => operation),
    ["dag.history"],
  );
  assert.equal(
    perttool.getJsonSchemaCatalog().some(
      ({ schemaId }) => schemaId === "Perttool.HistoricalGraphResult.v1",
    ),
    true,
  );
});
