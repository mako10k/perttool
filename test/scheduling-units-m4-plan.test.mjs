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

test("SU-M4 decomposes the selected exact unit-migration target Core", async () => {
  const [detail, macro, migration, interfaceSpec] = await Promise.all([
    repositoryFile("plans/scheduling-units-m4.pert"),
    repositoryFile("plans/scheduling-units.pert"),
    repositoryFile("docs/specs/unit-migration.md"),
    repositoryFile("docs/specs/temporal-unit-interface.md"),
  ]);

  const taskIds = [...detail.matchAll(/^task ([A-Z0-9_]+) /gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(taskIds, [
    "MIGRATION_REQUEST_AND_INVENTORY",
    "EXACT_UNIT_CONVERSION",
    "UNIT_MIGRATION_CANDIDATE",
    "UNIT_MIGRATION_RESULT_V2",
    "MIGRATION_NOOP_REPEAT_INVERSE",
    "M4_UNIT_MIGRATION_ACCEPTANCE",
  ]);
  const points = [...detail.matchAll(/^  duration (\d+)p$/gm)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
  assert.equal(points, 25);

  assert.match(
    detail,
    /milestone RATIONAL_DURATION_ACCEPTED:[\s\S]*state reached/,
  );
  assert.match(detail, /finish UNIT_MIGRATION_ACCEPTED/);
  assert.match(detail, /six tasks total 25p/);
  assert.match(detail, /Keep the type internal: no root export/);
  assert.match(detail, /without activating Contract 4 or publishing anything/);
  assert.match(
    macro,
    /task SU_M4_UNIT_MIGRATION_WORK_PACKAGE RATIONAL_DURATION_ACCEPTED -> UNIT_MIGRATION_ACCEPTED:[\s\S]*duration 1\.041667d/,
  );
  assert.doesNotMatch(macro, /^task SU_M2R_RATIONAL_DURATION_WORK_PACKAGE /m);

  assert.match(migration, /Unit migration version: `2`/);
  assert.match(interfaceSpec, /Perttool\.UnitMigrationResult\.v2/);
});

test("SU-M4 analysis and complete Next v3 select the request and inventory slice", async () => {
  const source = await repositoryFile("plans/scheduling-units-m4.pert");
  const analysis = publicApi.analyzeDocument(source);
  const next = publicApi.selectNextTasks(source);

  assert.equal(analysis.ok, true);
  assert.ok(analysis.precedence);
  assert.ok(analysis.resource);
  assert.deepEqual(
    [analysis.precedence.makespan.numerator, analysis.precedence.makespan.denominator],
    [21n, 1n],
  );
  assert.deepEqual(
    [analysis.resource.makespan.numerator, analysis.resource.makespan.denominator],
    [25n, 1n],
  );
  assert.equal(next.ok, true);
  assert.ok(next.recommendation);
  assert.deepEqual(next.groups.ready, ["MIGRATION_REQUEST_AND_INVENTORY"]);
  assert.deepEqual(next.groups.runnableNow, ["MIGRATION_REQUEST_AND_INVENTORY"]);
  assert.deepEqual(next.recommendation.recommendedTaskIds, [
    "MIGRATION_REQUEST_AND_INVENTORY",
  ]);
  assert.equal(next.recommendation.explanationStatus.complete, true);
  assert.equal(next.recommendation.explanationStatus.truncated, false);
});
