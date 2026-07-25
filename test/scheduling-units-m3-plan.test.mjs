import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

async function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("SU-M3 retains only its reached accepted frontier after advance", async () => {
  const [detail, macro, deadline, interfaceSpec] = await Promise.all([
    repositoryFile("plans/scheduling-units-m3.pert"),
    repositoryFile("plans/scheduling-units.pert"),
    repositoryFile("docs/specs/temporal-deadline.md"),
    repositoryFile("docs/specs/temporal-unit-interface.md"),
  ]);

  const taskIds = [...detail.matchAll(/^task ([A-Z0-9_]+) /gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(taskIds, []);
  const points = [...detail.matchAll(/^  duration (\d+)p$/gm)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
  assert.equal(points, 0);
  assert.match(
    detail,
    /milestone DEADLINE_CAPABILITIES_ACCEPTED:[\s\S]*state reached/,
  );
  assert.match(detail, /Active Grammar 1, CLI Contract 3/);
  assert.match(detail, /Next v3 normal authority/);
  assert.doesNotMatch(detail, /project migrate-unit/);
  assert.doesNotMatch(detail, /^task ANALYSIS_NEXT_V4_TARGET /m);
  assert.doesNotMatch(detail, /^task M3_DEADLINE_ACCEPTANCE /m);
  assert.doesNotMatch(macro, /^task SU_M4_UNIT_MIGRATION_WORK_PACKAGE /m);
  assert.match(deadline, /perttool\.deadline-evaluation/);
  assert.match(interfaceSpec, /Perttool\.AnalysisResult\.v3/);
  assert.match(interfaceSpec, /Perttool\.NextResult\.v4/);
});

test("SU-M3 records the complete accepted frontier without a recommendation", async () => {
  const source = await repositoryFile("plans/scheduling-units-m3.pert");
  const analysis = publicApi.analyzeDocument(source);
  const next = publicApi.selectNextTasks(source);

  assert.equal(analysis.ok, true);
  assert.ok(analysis.precedence);
  assert.ok(analysis.resource);
  assert.deepEqual(
    [analysis.precedence.makespan.numerator, analysis.precedence.makespan.denominator],
    [0n, 1n],
  );
  assert.deepEqual(
    [analysis.resource.makespan.numerator, analysis.resource.makespan.denominator],
    [0n, 1n],
  );
  assert.equal(next.ok, true);
  assert.ok(next.recommendation);
  assert.deepEqual(next.groups.ready, []);
  assert.deepEqual(next.groups.runnableNow, []);
  assert.deepEqual(next.recommendation.recommendedTaskIds, []);
  assert.equal(next.recommendation.explanationStatus.complete, true);
  assert.equal(next.recommendation.explanationStatus.truncated, false);
});
