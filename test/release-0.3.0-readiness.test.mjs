import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  analyzeDocument,
  checkDocument,
  getProjectMetadata,
  selectNextTasks,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("0.3.0 readiness consumes the reached scheduling-and-units finish", async () => {
  const [macro, m3, m5, readiness] = await Promise.all([
    repositoryFile("plans/scheduling-units.pert"),
    repositoryFile("plans/scheduling-units-m3.pert"),
    repositoryFile("plans/scheduling-units-m5.pert"),
    repositoryFile("docs/process/0.3.0-contract4-readiness.md"),
  ]);

  assert.match(
    macro,
    /^milestone SCHEDULING_UNITS_ACCEPTED:\n(?:.*\n)*?  state reached$/m,
  );
  for (const [source, finish] of [
    [macro, "SCHEDULING_UNITS_ACCEPTED"],
    [m3, "DEADLINE_CAPABILITIES_ACCEPTED"],
    [m5, "CONTRACT4_ACCEPTED"],
  ]) {
    const checked = checkDocument(source);
    const metadata = getProjectMetadata(source);
    const analyzed = analyzeDocument(source);
    const next = selectNextTasks(source);
    assert.equal(checked.ok, true);
    assert.equal(metadata.ok, true);
    assert.equal(metadata.project.finish, finish);
    assert.equal(checked.summary.tasks, 0);
    assert.equal(analyzed.precedence.makespan.numerator, 0n);
    assert.equal(analyzed.resource.makespan.numerator, 0n);
    assert.deepEqual(next.recommendation.recommendedTaskIds, []);
    assert.deepEqual(next.temporal.authority.startableRecommendedTaskIds, []);
  }

  assert.match(readiness, /Document status: Accepted 1\.0/);
  assert.match(readiness, /There are no open Contract 4 readiness findings/);
  assert.match(readiness, /starts only\s+`RELEASE_030_PREPARATION`/);
});

test("0.3.0 readiness observes the complete public Contract 4 boundary", async () => {
  const [m3Acceptance, m5Acceptance, readiness] = await Promise.all([
    repositoryFile("docs/process/scheduling-units-m3-acceptance.md"),
    repositoryFile("docs/process/scheduling-units-m5-acceptance.md"),
    repositoryFile("docs/process/0.3.0-contract4-readiness.md"),
  ]);

  assert.match(m3Acceptance, /no open SU-M3 acceptance findings/);
  assert.match(m5Acceptance, /There are no open SU-M5 acceptance findings/);
  assert.equal(COMMAND_REGISTRY.length, 53);
  for (const route of [
    "project migrate-unit",
    "dag analyze",
    "dag next",
    "task set",
    "milestone set",
  ]) {
    assert.ok(
      COMMAND_REGISTRY.some(({ path: commandPath }) => commandPath.join(" ") === route),
      route,
    );
  }
  for (const identity of [
    "Grammar 1/2/3",
    "AnalysisResult v3",
    "NextResult v4",
    "UnitMigrationResult v2",
    "recommendation_v1_plus_release_gate",
  ]) {
    assert.ok(readiness.includes(identity), identity);
  }
});
