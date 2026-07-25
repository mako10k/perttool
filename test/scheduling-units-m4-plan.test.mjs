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
  assert.deepEqual(taskIds, ["M4_UNIT_MIGRATION_ACCEPTANCE"]);
  const points = [...detail.matchAll(/^  duration (\d+)p$/gm)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
  assert.equal(points, 4);

  assert.doesNotMatch(detail, /^milestone EXACT_CONVERSION_READY:/m);
  assert.doesNotMatch(detail, /^task EXACT_UNIT_CONVERSION /m);
  assert.doesNotMatch(detail, /^milestone MIGRATION_REQUEST_READY:/m);
  assert.doesNotMatch(detail, /^task MIGRATION_REQUEST_AND_INVENTORY /m);
  assert.doesNotMatch(detail, /^milestone RATIONAL_DURATION_ACCEPTED:/m);
  assert.match(
    detail,
    /milestone M4_ACCEPTANCE_INPUT_READY:[\s\S]*state reached/,
  );
  assert.match(detail, /finish UNIT_MIGRATION_ACCEPTED/);
  assert.match(detail, /six tasks total 25p/);
  assert.doesNotMatch(detail, /^task UNIT_MIGRATION_RESULT_V2 /m);
  assert.match(detail, /without activating Contract 4 or publishing anything/);
  assert.match(
    macro,
    /task SU_M4_UNIT_MIGRATION_WORK_PACKAGE RATIONAL_DURATION_ACCEPTED -> UNIT_MIGRATION_ACCEPTED:[\s\S]*duration 1\.041667d/,
  );
  assert.doesNotMatch(macro, /^task SU_M2R_RATIONAL_DURATION_WORK_PACKAGE /m);

  assert.match(migration, /Unit migration version: `2`/);
  assert.match(interfaceSpec, /Perttool\.UnitMigrationResult\.v2/);
});

test("SU-M4 advances Result v2 and selects final acceptance", async () => {
  const source = await repositoryFile("plans/scheduling-units-m4.pert");
  const analysis = publicApi.analyzeDocument(source);
  const next = publicApi.selectNextTasks(source);

  assert.doesNotMatch(source, /^milestone MIGRATION_ROUNDTRIP_READY:/m);
  assert.doesNotMatch(source, /^task UNIT_MIGRATION_CANDIDATE /m);
  assert.doesNotMatch(source, /^task MIGRATION_NOOP_REPEAT_INVERSE /m);
  assert.doesNotMatch(source, /^task UNIT_MIGRATION_RESULT_V2 /m);
  assert.match(source, /velocity 21p\/1d/);
  assert.equal(analysis.ok, true);
  assert.ok(analysis.precedence);
  assert.ok(analysis.resource);
  assert.deepEqual(
    [analysis.precedence.makespan.numerator, analysis.precedence.makespan.denominator],
    [4n, 1n],
  );
  assert.deepEqual(
    [analysis.resource.makespan.numerator, analysis.resource.makespan.denominator],
    [4n, 1n],
  );
  assert.equal(next.ok, true);
  assert.ok(next.recommendation);
  assert.deepEqual(next.groups.ready, ["M4_UNIT_MIGRATION_ACCEPTANCE"]);
  assert.deepEqual(next.groups.runnableNow, ["M4_UNIT_MIGRATION_ACCEPTANCE"]);
  assert.deepEqual(next.recommendation.recommendedTaskIds, [
    "M4_UNIT_MIGRATION_ACCEPTANCE",
  ]);
  assert.equal(next.recommendation.explanationStatus.complete, true);
  assert.equal(next.recommendation.explanationStatus.truncated, false);
});
