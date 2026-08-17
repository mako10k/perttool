import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { rational } from "../dist/model/rational.js";
import {
  analyzeTemporalConstraints,
  TEMPORAL_CONSTRAINT_CAPABILITY,
} from "../dist/temporal-schedule/constraint.js";
import {
  analyzeRequiredSchedule,
  REQUIRED_SCHEDULE_CAPABILITY,
} from "../dist/temporal-schedule/required.js";
import {
  analyzeCalendarSchedule,
  TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY,
} from "../dist/temporal-schedule/scheduler.js";
import {
  parseTemporalScheduleSource,
  TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
} from "../dist/temporal-schedule/source.js";

function source({ finish = [], middle = [], taskA = [], taskB = [] } = {}) {
  return `${[
    "project REQUIRED:", "  version 8", '  title "Required"',
    "  as_of 2026-08-17T09:00:00+09:00", "  duration_unit hour", "  finish END",
    '  time_zone "Asia/Tokyo"', '  tzdb "2026c"', "  calendar STANDARD", "",
    "calendar STANDARD:", "  mon 09:00..18:00", "  tue 09:00..18:00", "",
    "milestone START:", '  title "Start"', "  state reached", "",
    "milestone MID:", '  title "Middle"', ...middle, "",
    "milestone END:", '  title "End"', ...finish, "",
    "resource DEV:", '  title "Developer"', "  capacity 1", "  calendar STANDARD", "",
    "task A START -> MID:", '  title "A"', "  duration 2h", ...taskA, "  requires:", "    DEV 1", "",
    "task B MID -> END:", '  title "B"', "  duration 2h", ...taskB, "  requires:", "    DEV 1",
  ].join("\n")}\n`;
}

function setup(text, finishDeadline = null) {
  const parsed = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  assert.equal(parsed.ok, true, JSON.stringify(parsed.diagnostics));
  const asOf = parsed.model.asOf.instantSeconds;
  const schedule = {
    documentId: "REQUIRED", asOf,
    horizonEnd: rational(asOf.numerator + 172800n * asOf.denominator, asOf.denominator),
    finishMilestoneId: "END", frontierMilestoneIds: ["START"], milestoneIds: ["START", "MID", "END"],
    resources: [{ id: "DEV", capacity: 1 }],
    edges: ["A", "B"].map((id, index) => ({
      kind: "task", id, source: index === 0 ? "START" : "MID", target: index === 0 ? "MID" : "END",
      status: "planned", expectedWorkSeconds: rational(7200n), priority: 100,
      totalFloat: rational(0n), requirements: [{ resourceId: "DEV", units: 1 }],
    })),
  };
  const scheduler = analyzeCalendarSchedule(parsed, schedule, TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  const constrained = analyzeTemporalConstraints(parsed, schedule, TEMPORAL_CONSTRAINT_CAPABILITY);
  const input = {
    schedule,
    horizonStart: rational(asOf.numerator - 604800n * asOf.denominator, asOf.denominator),
    finishDeadline,
    precedenceForward: constrained.precedence,
    resourceForward: scheduler.resource,
  };
  return { parsed, schedule, input };
}

function instant(parsed, entity, event, direction = "latest") {
  const values = entity === "A" || entity === "B" ? parsed.model.taskBounds : parsed.model.milestoneBounds;
  return values.find((bound) => bound.entityId === entity && bound.event === event && bound.direction === direction)
    .value.instantSeconds;
}

test("RSC-001 keeps the required-schedule capability internal and exact", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/temporal-required-schedule-v1.json", "utf8"));
  assert.equal(fixture.cases.length, 14);
  assert.deepEqual(fixture.cases.map(({ id }) => id),
    Array.from({ length: 14 }, (_, index) => `RSC-${String(index + 1).padStart(3, "0")}`));
  assert.equal(Object.isFrozen(REQUIRED_SCHEDULE_CAPABILITY), true);
  assert.equal("analyzeRequiredSchedule" in publicApi, false);
  const prepared = setup(source({ finish: ["  when reach latest 2026-08-17T17:00:00+09:00"] }));
  assert.throws(() => analyzeRequiredSchedule(prepared.parsed, prepared.input,
    { ...REQUIRED_SCHEDULE_CAPABILITY }), /required-schedule capability is required/);
});

test("RSC-002 through RSC-004 selects latest, deadline, coincident, and earlier anchors", () => {
  const latestPrepared = setup(source({ finish: ["  when reach latest 2026-08-17T17:00:00+09:00"] }));
  const latest = analyzeRequiredSchedule(latestPrepared.parsed, latestPrepared.input, REQUIRED_SCHEDULE_CAPABILITY);
  assert.equal(latest.anchor.source, "latest_bound");

  const deadlinePrepared = setup(source(), latest.anchor.instant);
  const deadline = analyzeRequiredSchedule(deadlinePrepared.parsed, deadlinePrepared.input, REQUIRED_SCHEDULE_CAPABILITY);
  assert.equal(deadline.anchor.source, "advisory_deadline");

  const coincidentPrepared = setup(
    source({ finish: ["  when reach latest 2026-08-17T17:00:00+09:00"] }), latest.anchor.instant,
  );
  const coincident = analyzeRequiredSchedule(coincidentPrepared.parsed, coincidentPrepared.input,
    REQUIRED_SCHEDULE_CAPABILITY);
  assert.equal(coincident.anchor.source, "coincident");

  const earlier = setup(source({ finish: ["  when reach latest 2026-08-17T17:00:00+09:00"] }),
    rational(latest.anchor.instant.numerator - 3600n * latest.anchor.instant.denominator,
      latest.anchor.instant.denominator));
  assert.equal(analyzeRequiredSchedule(earlier.parsed, earlier.input, REQUIRED_SCHEDULE_CAPABILITY).anchor.source,
    "advisory_deadline");
});

test("RSC-005 through RSC-009 propagates exact intermediate and task latest drivers", () => {
  const prepared = setup(source({
    finish: ["  when reach latest 2026-08-17T17:00:00+09:00"],
    middle: ["  when reach latest 2026-08-17T14:00:00+09:00"],
    taskA: ["  when finish latest 2026-08-17T13:30:00+09:00"],
    taskB: ["  when start latest 2026-08-17T14:00:00+09:00"],
  }));
  const result = analyzeRequiredSchedule(prepared.parsed, prepared.input, REQUIRED_SCHEDULE_CAPABILITY);
  assert.equal(result.state, "available");
  const a = result.tasks.find(({ id }) => id === "A");
  const b = result.tasks.find(({ id }) => id === "B");
  assert.equal(a.requiredFinish.numerator, instant(prepared.parsed, "A", "finish").numerator);
  assert.equal(b.requiredStart.numerator, instant(prepared.parsed, "B", "start").numerator);
  assert.equal(a.segments.length, 1);
  assert.equal(a.driverIds.includes("task:A:finish:latest"), true);
  assert.equal(b.driverIds.includes("task:B:start:latest"), true);
  assert.equal(result.milestones.find(({ id }) => id === "MID").driverIds
    .includes("milestone:MID:reach:latest"), true);
});

test("RSC-010 through RSC-012 separates precedence and optimal-false resource slack", () => {
  const prepared = setup(source({
    finish: ["  when reach latest 2026-08-17T15:00:00+09:00"],
    taskA: ["  when start earliest 2026-08-17T12:00:00+09:00"],
  }));
  const precedenceLate = analyzeRequiredSchedule(prepared.parsed, prepared.input, REQUIRED_SCHEDULE_CAPABILITY);
  assert.equal(precedenceLate.precedenceComparison.classification, "precedence_infeasible");
  assert.equal(precedenceLate.precedenceComparison.events.some(({ signedSlackSeconds }) =>
    signedSlackSeconds.numerator < 0n), true);

  const feasiblePrepared = setup(source({ finish: ["  when reach latest 2026-08-17T17:00:00+09:00"] }));
  const delayedResource = {
    ...feasiblePrepared.input.resourceForward,
    tasks: feasiblePrepared.input.resourceForward.tasks.map((task) => ({
      ...task,
      start: rational(task.start.numerator + 18000n * task.start.denominator, task.start.denominator),
      finish: rational(task.finish.numerator + 18000n * task.finish.denominator, task.finish.denominator),
    })),
    milestones: feasiblePrepared.input.resourceForward.milestones.map((milestone) => ({
      ...milestone,
      reach: rational(milestone.reach.numerator + 18000n * milestone.reach.denominator, milestone.reach.denominator),
    })),
  };
  const resourceLate = analyzeRequiredSchedule(feasiblePrepared.parsed,
    { ...feasiblePrepared.input, resourceForward: delayedResource }, REQUIRED_SCHEDULE_CAPABILITY);
  assert.equal(resourceLate.precedenceComparison.classification, "feasible");
  assert.equal(resourceLate.resourceComparison.classification, "resource_heuristic_late");
  assert.equal(resourceLate.resourceComparison.optimal, false);
});

test("RSC-013/RSC-014 keeps absent, unavailable, and public boundaries closed", () => {
  const prepared = setup(source());
  const absent = analyzeRequiredSchedule(prepared.parsed, prepared.input, REQUIRED_SCHEDULE_CAPABILITY);
  assert.equal(absent.state, "absent");
  assert.equal(absent.unavailableCauses[0].code, "required_anchor_absent");
  assert.equal(absent.precedenceComparison.state, "unavailable");
  assert.deepEqual(prepared.schedule.edges.map(({ id }) => id), ["A", "B"]);
});
