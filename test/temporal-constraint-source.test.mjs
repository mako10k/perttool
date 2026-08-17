import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { rational } from "../dist/model/rational.js";
import {
  analyzeTemporalConstraints,
  planTemporalConstraintMigration,
  TEMPORAL_CONSTRAINT_CAPABILITY,
} from "../dist/temporal-schedule/constraint.js";
import {
  parseTemporalScheduleSource,
  TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
} from "../dist/temporal-schedule/source.js";

function source({ taskBounds = [], milestoneBounds = [] } = {}) {
  return `${[
    "project C:",
    "  version 8",
    '  title "Constraints"',
    "  as_of 2026-08-17T09:00:00+09:00",
    "  duration_unit hour",
    "  finish END",
    '  time_zone "Asia/Tokyo"',
    '  tzdb "2026c"',
    "  calendar STANDARD",
    "",
    "calendar STANDARD:",
    "  mon 09:00..18:00",
    "  tue 09:00..18:00",
    "",
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone END:",
    '  title "End"',
    ...milestoneBounds,
    "",
    "resource DEV:",
    '  title "Developer"',
    "  capacity 1",
    "  calendar STANDARD",
    "",
    "task WORK START -> END:",
    '  title "Work"',
    "  duration 1h",
    ...taskBounds,
    "  requires:",
    "    DEV 1",
  ].join("\n")}\n`;
}

function analyze(text) {
  const parsed = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.diagnostics));
  const asOf = parsed.model.asOf.instantSeconds;
  return {
    parsed,
    result: analyzeTemporalConstraints(parsed, {
      documentId: "C",
      asOf,
      horizonEnd: rational(asOf.numerator + 172800n * asOf.denominator, asOf.denominator),
      finishMilestoneId: "END",
      frontierMilestoneIds: ["START"],
      milestoneIds: ["START", "END"],
      resources: [{ id: "DEV", capacity: 1 }],
      edges: [{
        kind: "task",
        id: "WORK",
        source: "START",
        target: "END",
        status: "planned",
        expectedWorkSeconds: rational(3600n),
        priority: 100,
        totalFloat: rational(0n),
        requirements: [{ resourceId: "DEV", units: 1 }],
      }],
    }, TEMPORAL_CONSTRAINT_CAPABILITY),
  };
}

test("TCN-001/TCN-002 keeps the identity-bound constraint Core internal", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/temporal-constraint-source-v1.json", "utf8"));
  assert.equal(fixture.cases.length, 14);
  assert.deepEqual(fixture.cases.map(({ id }) => id),
    Array.from({ length: 14 }, (_, index) => `TCN-${String(index + 1).padStart(3, "0")}`));
  assert.equal(Object.isFrozen(TEMPORAL_CONSTRAINT_CAPABILITY), true);
  assert.equal("analyzeTemporalConstraints" in publicApi, false);
  const parsed = parseTemporalScheduleSource(source(), TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  assert.throws(() => analyzeTemporalConstraints(parsed, {}, { ...TEMPORAL_CONSTRAINT_CAPABILITY }),
    /temporal constraint capability is required/);
});

test("TCN-003 through TCN-005 propagates start, finish, and reach earliest bounds", () => {
  const start = analyze(source({ taskBounds: ["  when start earliest 2026-08-17T11:00:00+09:00"] }));
  assert.equal(start.result.precedence.tasks[0].start.numerator,
    start.parsed.model.taskBounds[0].value.instantSeconds.numerator);

  const finish = analyze(source({ taskBounds: ["  when finish earliest 2026-08-17T14:00:00+09:00"] }));
  assert.equal(finish.result.precedence.tasks[0].finish.numerator,
    finish.parsed.model.taskBounds[0].value.instantSeconds.numerator);
  assert.equal(finish.result.precedence.tasks[0].segments.length, 1);

  const reach = analyze(source({ milestoneBounds: ["  when reach earliest 2026-08-17T16:00:00+09:00"] }));
  assert.equal(reach.result.precedence.milestones.find(({ id }) => id === "END").reach.numerator,
    reach.parsed.model.milestoneBounds[0].value.instantSeconds.numerator);
});

test("TCN-006 through TCN-010 returns typed latest-bound infeasibility and accepts equality", () => {
  const late = analyze(source({
    taskBounds: [
      "  when start latest 2026-08-17T08:59:00+09:00",
      "  when finish latest 2026-08-17T09:30:00+09:00",
    ],
    milestoneBounds: ["  when reach latest 2026-08-17T09:45:00+09:00"],
  })).result.precedence;
  assert.equal(late.state, "infeasible");
  assert.deepEqual(late.violations.map(({ entityKind, event }) => [entityKind, event]), [
    ["task", "start"], ["task", "finish"], ["milestone", "reach"],
  ]);
  assert.equal(late.violations.every(({ signedSlackSeconds }) => signedSlackSeconds.numerator < 0n), true);

  const exact = analyze(source({
    taskBounds: ["  when finish latest 2026-08-17T10:00:00+09:00"],
    milestoneBounds: ["  when reach latest 2026-08-17T10:00:00+09:00"],
  })).result.precedence;
  assert.equal(exact.state, "available");
  assert.deepEqual(exact.violations, []);
});

test("TCN-011 through TCN-014 migrates not_before without changing deadline or topology", () => {
  const legacy = `${[
    "project M:", "  version 7", '  title "Migration"',
    "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END", "",
    "milestone START:", '  title "Start"', "  state reached", "",
    "milestone END:", '  title "End"', "  deadline 2026-08-18T10:00:00+09:00", "",
    "task WORK START -> END:", '  title "Work"', "  duration 1h",
    "  not_before 2026-08-17T10:00:00+09:00", "  deadline 2026-08-18T09:00:00+09:00",
  ].join("\n")}\n`;
  const migrated = planTemporalConstraintMigration(legacy, TEMPORAL_CONSTRAINT_CAPABILITY);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.changed, true);
  assert.deepEqual(migrated.migratedTaskIds, ["WORK"]);
  assert.match(migrated.updatedText, /version 8/u);
  assert.match(migrated.updatedText, /when start earliest 2026-08-17T10:00:00\+09:00/u);
  assert.doesNotMatch(migrated.updatedText, /\bnot_before\b/u);
  assert.equal((migrated.updatedText.match(/deadline /gu) ?? []).length, 2);
  assert.match(migrated.updatedText, /task WORK START -> END:/u);
  assert.match(migrated.updatedText, /duration 1h/u);
});
