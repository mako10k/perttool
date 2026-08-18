import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocument, getProjectMetadata, selectNextTasks } from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist/cli.js");

test("0.10.0 release plan selects the Contract 9 beta boundary and gates publication", async () => {
  const [plan, acceptance, requirements, adr, design, procedure, gate, readiness, preparation, candidate, selfUse] = await Promise.all([
    readFile(path.join(root, "plans/release-0.10.0.pert"), "utf8"),
    readFile(path.join(root, "docs/process/0.10.0-release-plan-acceptance.md"), "utf8"),
    readFile(path.join(root, "docs/requirements.md"), "utf8"),
    readFile(path.join(root, "docs/adr/0003-beta-versioning.md"), "utf8"),
    readFile(path.join(root, "docs/basic-design.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.10.0-release.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.10.0-gate-design.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.10.0-input-readiness.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.10.0-preparation.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.10.0-candidate.md"), "utf8"),
    readFile(path.join(root, "scripts/check-self-use.sh"), "utf8"),
  ]);
  const checked = checkDocument(plan);
  const metadata = getProjectMetadata(plan);
  const next = selectNextTasks(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.grammarVersion, 8);
  assert.equal(metadata.project.id, "RELEASE_0100");
  assert.equal(metadata.project.finish, "RELEASE_0100_ACCEPTED");
  assert.equal(checked.document.declarations.filter(({ kind }) => kind === "task").length, 6);
  assert.deepEqual(next.groups.active, []);
  assert.deepEqual(next.groups.ready, ["RELEASE_0100_PUBLISH"]);
  assert.deepEqual(next.recommendation.recommendedTaskIds, ["RELEASE_0100_PUBLISH"]);
  assert.match(plan, /Only after every predecessor gate passes and the user separately authorizes/u);
  assert.match(acceptance, /Accepted source digest: `sha256:d8bd9cb5/u);
  assert.match(acceptance, /`0\.9\.5` would understate/u);
  assert.match(requirements, /^24\. \[ \] Release the accepted temporal scheduling boundary/mu);
  assert.match(adr, /Select suffix-free `0\.10\.0`/u);
  assert.match(adr, /The stable series begins with a future `1\.0\.0`/u);
  assert.match(design, /^### Post-MVP Slice 4U: Temporal scheduling `v0\.10\.0` beta minor$/mu);
  assert.match(procedure, /- Status: Gate design accepted 1\.0/u);
  assert.match(procedure, /PUBLISH requires a later authorization naming that exact candidate/u);
  assert.match(gate, /Document status: Accepted 1\.0/u);
  assert.match(gate, /\| Commands \| 53 \| 56 \|/u);
  assert.match(readiness, /Document status: Accepted 1\.0/u);
  assert.match(readiness, /873 files, 24 schema files/u);
  assert.match(readiness, /Twenty-eight focused integration/u);
  assert.match(preparation, /Document status: Accepted 1\.0/u);
  assert.match(preparation, /1,213 Node\.js tests/u);
  assert.match(preparation, /an 873-file npm publication dry run/u);
  assert.match(candidate, /Document status: Accepted 1\.0/u);
  assert.match(candidate, /86762a71562bf15cffe746e2aa6160996aa82942/u);
  assert.match(candidate, /b98dad654955b639275ebcccd1871a3a40ce415cf0c5504dd18c681dfa36ce9f/u);
  assert.match(selfUse, /plans\/release-0\.10\.0\.pert/u);

  const criterionPreview = spawnSync(process.execPath, [
    cli,
    "milestone",
    "acceptance",
    "replace",
    path.join(root, "plans/release-0.10.0.pert"),
    "RELEASE_0100_INPUTS_READY",
    "RELEASE_0100_INPUTS_R1",
    "R1",
    "--criterion",
    "INPUT_READINESS:required:artifact:Accepted 0.10.0 release inputs",
    "--format=json",
  ], { encoding: "utf8" });
  assert.equal(criterionPreview.status, 0, criterionPreview.stderr);
  const mutation = JSON.parse(criterionPreview.stdout);
  assert.equal(mutation.schema_version, "Perttool.MutationResult.v6");
  assert.equal(mutation.ok, true);
  assert.equal(mutation.changed, true);
  assert.equal(mutation.governance.owner_confirmation_required, true);
  assert.equal(mutation.governance.write_authorized, false);
  assert.match(mutation.updated_text, /^  version 8$/mu);
  assert.match(mutation.updated_text, /^milestone_criterion_set RELEASE_0100_INPUTS_R1:$/mu);
});
