import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  prepareTargetTemporalInputs,
} from "../dist/application/target-temporal-input.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(
  testDirectory,
  "fixtures",
  "temporal-units",
);

async function projection(fixture) {
  const text = await readFile(path.join(fixtureDirectory, fixture), "utf8");
  const result = prepareTargetTemporalInputs(
    text,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.notEqual(result.projection, null);
  return result.projection;
}

test("target temporal input projection is capability-checked and internal", () => {
  assert.equal("prepareTargetTemporalInputs" in publicApi, false);
  assert.equal("projectTargetTemporalInputs" in publicApi, false);
  assert.throws(
    () => prepareTargetTemporalInputs("", {
      id: "perttool.target-grammar-3-source",
      version: 1,
      grammarVersion: 3,
    }),
    /target Grammar 3 source capability is required/,
  );
});

test("TUE-004 derives the exact leap-day release and deadline window", async () => {
  const result = await projection("calendar-date-v2.pert");
  assert.deepEqual(result.calendar, {
    id: "perttool.calendar-projection",
    version: 1,
    profileId: "perttool.calendar.continuous-fixed-offset",
    profileVersion: 1,
  });
  assert.deepEqual(result.effectiveProjection, {
    baseUnit: "day",
    effectiveUnit: "day",
    qualifier: "base_unit",
    velocity: null,
  });
  assert.equal(result.anchor.sourceText, "2028-02-28");
  assert.deepEqual(result.tasks[0].release.bound, {
    numerator: 1n,
    denominator: 1n,
    unit: "day",
  });
  assert.deepEqual(
    result.tasks[0].deadline.anchorRelationship.calendarDifference,
    {
      kind: "calendar_days",
      exact: { numerator: 2n, denominator: 1n },
    },
  );
  assert.deepEqual(
    result.milestoneDeadlines[0].deadline.anchorRelationship.baseUnitValue,
    { numerator: 2n, denominator: 1n, unit: "day" },
  );
});

test("TUE-005 compares exact offset-bearing instants without rewriting source", async () => {
  const result = await projection("calendar-offset-v2.pert");
  const task = result.tasks[0];
  assert.equal(result.anchor.sourceText, "2026-07-25T09:00:00+09:00");
  assert.equal(task.declaredNotBefore.sourceText, "2026-07-25T00:00:00Z");
  assert.deepEqual(task.release.bound, {
    numerator: 0n,
    denominator: 1n,
    unit: "hour",
  });
  assert.deepEqual(task.release.relationship.calendarDifference, {
    kind: "si_seconds",
    exact: { numerator: 0n, denominator: 1n },
  });
  assert.equal(task.deadline.deadline.sourceText, "2026-07-25T02:00:00Z");
  assert.deepEqual(task.deadline.anchorRelationship.baseUnitValue, {
    numerator: 2n,
    denominator: 1n,
    unit: "hour",
  });
  assert.equal(
    result.milestoneDeadlines[0].deadline.deadline.sourceText,
    "2026-07-25T11:00:00+09:00",
  );
});

test("TUE-006 retains mixed kinds and fails the release bound closed", async () => {
  const result = await projection("mixed-kind-v2.pert");
  const task = result.tasks[0];
  assert.equal(task.release.state, "unavailable");
  assert.equal(task.release.bound, null);
  assert.deepEqual(task.release.unavailableCauses, [{
    cause: "incomparable_temporal_kinds",
    underlyingCause: null,
    subjectKind: "task",
    subjectId: "FUTURE_CLOCK",
    taskId: "FUTURE_CLOCK",
  }]);
  assert.equal(task.status, "planned");
  assert.equal(task.deadline.anchorRelationship.state, "available");
});

test("point input projection retains effective velocity and exact point values", async () => {
  const result = await projection("migration-point-v2.pert");
  assert.deepEqual(result.effectiveProjection, {
    baseUnit: "point",
    effectiveUnit: "day",
    qualifier: "velocity_forecast",
    velocity: {
      points: { numerator: 20n, denominator: 1n, unit: "point" },
      period: { numerator: 10n, denominator: 1n, unit: "day" },
    },
  });
  assert.deepEqual(result.tasks.map(({ taskId, release, deadline }) => ({
    taskId,
    release: release.bound,
    deadline: deadline.anchorRelationship.baseUnitValue,
  })), [
    {
      taskId: "FIXED",
      release: { numerator: 0n, denominator: 1n, unit: "point" },
      deadline: { numerator: 4n, denominator: 1n, unit: "point" },
    },
    {
      taskId: "ESTIMATED",
      release: { numerator: 0n, denominator: 1n, unit: "point" },
      deadline: { numerator: 10n, denominator: 1n, unit: "point" },
    },
  ]);
});

test("Grammar 3 fractions are accepted by active Contract 4", () => {
  const text = `project FRACTIONAL_TEMPORAL:
  version 3
  title "fractional temporal input"
  as_of 2026-07-25
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"
  deadline 2026-07-26

task WORK START -> FINISH:
  title "work"
  duration 1/3d
  status active
  not_before 2026-07-26
  deadline 2026-07-26
`;
  const result = prepareTargetTemporalInputs(
    text,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.equal(result.grammarVersion, 3);
  assert.equal(result.projection.tasks[0].release.state, "not_applicable");
  assert.equal(
    result.projection.tasks[0].release.relationship.state,
    "available",
  );
  assert.equal(publicApi.checkDocument(text).ok, true);
});

test("TUE-007 does not invent a clock for a date/hour relationship", () => {
  const text = `project DATE_HOUR:
  version 2
  title "date anchor and hour unit"
  as_of 2026-07-25
  duration_unit hour
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"

task WORK START -> FINISH:
  title "work"
  duration 1h
  not_before 2026-07-26
`;
  const result = prepareTargetTemporalInputs(
    text,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.equal(result.projection.tasks[0].release.state, "unavailable");
  assert.deepEqual(
    result.projection.tasks[0].release.unavailableCauses.map(
      ({ cause }) => cause,
    ),
    ["date_anchor_has_no_clock"],
  );
  assert.deepEqual(
    result.projection.tasks[0].release.relationship.calendarDifference,
    {
      kind: "calendar_days",
      exact: { numerator: 1n, denominator: 1n },
    },
  );
});
