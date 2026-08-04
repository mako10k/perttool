import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  analyzeDocument,
  checkDocument,
  getJsonSchemaCatalog,
  inspectPlanAssurance,
  planAssuranceMutation,
  selectNextTasks,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function sha256(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

test("0.7.0 readiness consumes the exact completed ASSURE-001 input", async () => {
  const [plan, publicAcceptance, finalAcceptance, readiness] = await Promise.all([
    repositoryText("plans/plan-assurance.pert"),
    repositoryText("docs/process/plan-assurance-public-contract-acceptance.md"),
    repositoryText("docs/process/plan-assurance-acceptance.md"),
    repositoryText("docs/process/0.7.0-contract7-readiness.md"),
  ]);

  assert.equal(
    sha256(plan),
    "sha256:51dc8595b6e1306fd391c8c6da5990d9cc6e74ae30c279daecc15f5b565ea563",
  );
  const checked = checkDocument(plan);
  const analyzed = analyzeDocument(plan);
  const next = selectNextTasks(plan);
  assert.equal(checked.ok, true);
  assert.equal(checked.summary.tasks, 10);
  assert.equal(checked.summary.errors, 0);
  assert.equal(analyzed.ok, true);
  assert.equal(analyzed.precedence.makespan.numerator, 0n);
  assert.equal(analyzed.resource.makespan.numerator, 0n);
  assert.equal(analyzed.resource.resourceDelay.numerator, 0n);
  assert.deepEqual(next.groups.active, []);
  assert.deepEqual(next.groups.ready, []);
  assert.deepEqual(next.groups.runnableNow, []);
  assert.deepEqual(next.groups.upcoming, []);
  assert.deepEqual(next.recommendation.recommendedTaskIds, []);
  assert.equal(next.recommendation.explanationStatus.complete, true);
  assert.equal(next.recommendation.explanationStatus.truncated, false);
  assert.equal(next.temporal.authority.complete, true);
  assert.deepEqual(next.temporal.authority.startableRecommendedTaskIds, []);

  assert.match(publicAcceptance, /Document status: Accepted 1\.0/);
  assert.match(publicAcceptance, /44-command registry/);
  assert.match(finalAcceptance, /Document status: Accepted 1\.0/);
  assert.match(finalAcceptance, /all fourteen semantic `PAS` cases/);
  assert.match(readiness, /Document status: Accepted 1\.0/);
  assert.match(readiness, /No hidden correctness, compatibility, packaging, or\s+authority finding/);
});

test("0.7.0 readiness observes one atomic Contract 7 public boundary", async () => {
  const [releasePlan, readiness, manifestText, versionSource] = await Promise.all([
    repositoryText("plans/release-0.7.0.pert"),
    repositoryText("docs/process/0.7.0-contract7-readiness.md"),
    repositoryText("package.json"),
    repositoryText("src/version.ts"),
  ]);

  assert.equal(COMMAND_REGISTRY.length, 44);
  assert.equal(getJsonSchemaCatalog().length, 20);
  for (const route of [
    "plan-assurance show",
    "plan-assurance hash",
    "plan-assurance seal",
    "plan-assurance reseal",
    "plan-dependency add",
    "plan-dependency set",
    "plan-dependency remove",
    "task-outcome add",
    "task-outcome set",
    "task-outcome remove",
  ]) {
    assert.ok(
      COMMAND_REGISTRY.some(({ path: commandPath }) => commandPath.join(" ") === route),
      route,
    );
  }
  assert.equal(typeof inspectPlanAssurance, "function");
  assert.equal(typeof planAssuranceMutation, "function");

  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.version, "0.6.0");
  assert.match(versionSource, /TOOL_VERSION = "0\.6\.0"/);
  assert.match(
    releasePlan,
    /^task RELEASE_070_CONTRACT_7_READINESS[\s\S]*?^  status done$/m,
  );
  const next = selectNextTasks(releasePlan);
  assert.equal(next.ok, true);
  assert.deepEqual(next.groups.ready, ["RELEASE_070_PREPARATION"]);
  assert.deepEqual(next.groups.runnableNow, ["RELEASE_070_PREPARATION"]);
  assert.deepEqual(next.recommendation.recommendedTaskIds, ["RELEASE_070_PREPARATION"]);
  assert.deepEqual(
    next.temporal.authority.startableRecommendedTaskIds,
    ["RELEASE_070_PREPARATION"],
  );
  assert.match(readiness, /Package identity remains\s+`0\.6\.0`/);
  assert.match(readiness, /does not authorize or perform version-bearing source preparation/);
  assert.match(readiness, /complete repository run passed all 791 tests/);
  assert.match(readiness, /601-file, 656\.1 kB/);
});
