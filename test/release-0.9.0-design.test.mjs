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

test("0.9.0 preparation binds Grammar 7 and CLI Contract 8 without publication", async () => {
  const [
    requirements,
    adr,
    design,
    procedure,
    gate,
    readiness,
    preparation,
    migration,
    planAcceptance,
    plan,
    manifestText,
    lockfileText,
    versionSource,
    lspManifestText,
    mcpManifestText,
    mcpProtocol,
    changelog,
    readme,
    planIndex,
    selfUseScript,
  ] = await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/adr/0003-beta-versioning.md"),
    repositoryText("docs/basic-design.md"),
    repositoryText("docs/process/0.9.0-release.md"),
    repositoryText("docs/process/0.9.0-gate-design.md"),
    repositoryText("docs/process/0.9.0-input-readiness.md"),
    repositoryText("docs/process/0.9.0-preparation.md"),
    repositoryText("docs/process/0.8.1-to-0.9.0-migration.md"),
    repositoryText("docs/process/0.9.0-release-plan-acceptance.md"),
    repositoryText("plans/release-0.9.0.pert"),
    repositoryText("package.json"),
    repositoryText("package-lock.json"),
    repositoryText("src/version.ts"),
    repositoryText("adapters/lsp/package.json"),
    repositoryText("adapters/mcp/package.json"),
    repositoryText("adapters/mcp/src/protocol.ts"),
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
    repositoryText("plans/README.md"),
    repositoryText("scripts/check-self-use.sh"),
  ]);

  assert.match(
    requirements,
    /^### 21\.16 Milestone acceptance beta release acceptance criteria$/m,
  );
  const releaseSection = requirements.split(
    "### 21.16 Milestone acceptance beta release acceptance criteria",
  )[1].split("## 22.")[0];
  assert.deepEqual(
    [...releaseSection.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1])),
    Array.from({ length: 13 }, (_, index) => index + 1),
  );
  assert.match(adr, /Select suffix-free `0\.9\.0`/u);
  assert.match(adr, /`0\.8\.2` would understate/u);
  assert.match(
    design,
    /^### Post-MVP Slice 4T: Milestone acceptance `v0\.9\.0` beta minor$/m,
  );
  assert.match(procedure, /- Status: Accepted 1\.0/u);
  assert.match(procedure, /Expected pre-publication tags: `beta=latest=0\.8\.1`, no `alpha`/u);
  assert.match(procedure, /It does not authorize candidate acceptance/u);
  assert.match(gate, /- Document status: Accepted 1\.0/u);
  assert.match(gate, /\| Commands \| 45 \| 53 \|/u);
  assert.match(gate, /\| Root schemas \| 21 \| 23 \|/u);
  assert.match(gate, /\| Core runtime exports \| 45 \| 45 \|/u);
  assert.match(readiness, /- Document status: Accepted 1\.0/u);
  assert.match(readiness, /beta=latest=0\.8\.1/u);
  assert.match(preparation, /- Document status: Accepted 1\.0/u);
  assert.match(preparation, /all 1,041 Node\.js tests/u);
  assert.match(preparation, /all 38 self-use plans/u);
  assert.match(preparation, /713-file `perttool@0\.9\.0` public package/u);
  assert.match(preparation, /Prepared-plan source digest: `sha256:16cdb32b/u);
  assert.match(migration, /Existing Grammar 1 through 6 documents remain readable/u);
  assert.match(migration, /Use exact `perttool@0\.8\.1` as the rollback pin/u);
  assert.match(planAcceptance, /Accepted source digest: `sha256:104c58d0/u);

  const checked = perttool.checkDocument(plan);
  const metadata = perttool.getProjectMetadata(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.id, "RELEASE_090");
  assert.equal(metadata.grammarVersion, 6);
  assert.equal(metadata.project.finish, "RELEASE_090_ACCEPTED");
  assert.deepEqual(
    checked.document.declarations
      .filter(({ kind }) => kind === "task")
      .map(({ id }) => id),
    [
      "RELEASE_090_GATE_DESIGN",
      "RELEASE_090_INPUT_READINESS",
      "RELEASE_090_PREPARATION",
      "RELEASE_090_CANDIDATE",
      "RELEASE_090_PUBLISH",
      "RELEASE_090_ACCEPTANCE",
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
      ["RELEASE_090_GATE_DESIGN", "done"],
      ["RELEASE_090_INPUT_READINESS", "done"],
      ["RELEASE_090_PREPARATION", "done"],
      ["RELEASE_090_CANDIDATE", "planned"],
      ["RELEASE_090_PUBLISH", "planned"],
      ["RELEASE_090_ACCEPTANCE", "planned"],
    ],
  );

  const manifest = JSON.parse(manifestText);
  const lockfile = JSON.parse(lockfileText);
  const lspManifest = JSON.parse(lspManifestText);
  const mcpManifest = JSON.parse(mcpManifestText);
  assert.equal(manifest.version, "0.9.0");
  assert.equal(lockfile.version, "0.9.0");
  assert.equal(lockfile.packages[""].version, "0.9.0");
  assert.equal(lspManifest.peerDependencies.perttool, "0.9.0");
  assert.equal(mcpManifest.peerDependencies.perttool, "0.9.0");
  assert.match(versionSource, /TOOL_VERSION = "0\.9\.0"/u);
  assert.match(mcpProtocol, /MCP_SERVER_VERSION = "0\.9\.0"/u);
  assert.match(changelog, /^## \[0\.9\.0\] - 2026-08-13$/m);
  assert.match(readme, /Version `0\.9\.0` is the selected, locally prepared beta/u);
  assert.match(readme, /published npm baseline remains\s+`beta=latest=0\.8\.1`/u);
  assert.match(planIndex, /All thirty-eight plans pass/u);
  assert.match(selfUseScript, /plans\/release-0\.9\.0\.pert/u);

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
  assert.equal(manifest.files.includes("adapters"), false);
  assert.doesNotMatch(procedure, /Candidate source commit:/u);
});
