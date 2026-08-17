import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { rational } from "../dist/model/rational.js";
import { evaluateScheduleAlerts, SCHEDULE_ALERT_CAPABILITY } from "../dist/temporal-schedule/alert.js";
import { analyzeTemporalConstraints, TEMPORAL_CONSTRAINT_CAPABILITY } from "../dist/temporal-schedule/constraint.js";
import { analyzeRequiredSchedule, REQUIRED_SCHEDULE_CAPABILITY } from "../dist/temporal-schedule/required.js";
import { analyzeCalendarSchedule, TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY } from "../dist/temporal-schedule/scheduler.js";
import { parseTemporalScheduleSource, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../dist/temporal-schedule/source.js";

const text = `project ALERTS:
  version 8
  title "Alerts"
  as_of 2026-08-17T09:00:00+09:00
  duration_unit hour
  finish END
  time_zone "Asia/Tokyo"
  tzdb "2026c"
  calendar STANDARD

calendar STANDARD:
  mon 09:00..18:00

milestone START:
  title "Start"
  state reached

milestone MID:
  title "Middle"

milestone END:
  title "End"
  when reach latest 2026-08-17T17:00:00+09:00

resource DEV:
  title "Developer"
  capacity 1
  calendar STANDARD

task A START -> MID:
  title "A"
  duration 2h
  requires:
    DEV 1

task B MID -> END:
  title "B"
  duration 2h
  requires:
    DEV 1
`;

function plus(value, seconds) {
  return rational(value.numerator + BigInt(seconds) * value.denominator, value.denominator);
}

function setup() {
  const source = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  assert.equal(source.ok, true, JSON.stringify(source.diagnostics));
  const asOf = source.model.asOf.instantSeconds;
  const schedule = {
    documentId: "ALERTS", asOf, horizonEnd: plus(asOf, 172800), finishMilestoneId: "END",
    frontierMilestoneIds: ["START"], milestoneIds: ["START", "MID", "END"],
    resources: [{ id: "DEV", capacity: 1 }],
    edges: ["A", "B"].map((id, index) => ({ kind: "task", id,
      source: index === 0 ? "START" : "MID", target: index === 0 ? "MID" : "END",
      status: "planned", expectedWorkSeconds: rational(7200n), priority: 100, totalFloat: rational(0n),
      requirements: [{ resourceId: "DEV", units: 1 }] })),
  };
  const scheduler = analyzeCalendarSchedule(source, schedule, TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  const constrained = analyzeTemporalConstraints(source, schedule, TEMPORAL_CONSTRAINT_CAPABILITY);
  const required = analyzeRequiredSchedule(source, { schedule, horizonStart: plus(asOf, -604800), finishDeadline: null,
    precedenceForward: constrained.precedence, resourceForward: scheduler.resource }, REQUIRED_SCHEDULE_CAPABILITY);
  const span = source.model.milestoneBounds[0].span;
  return { source, schedule, precedence: constrained.precedence, resource: scheduler.resource, required, span };
}

function target(prepared, overrides = {}) {
  return { subjectKind: "milestone", subjectId: "END", event: "reach", targetKind: "deadline",
    temporalKind: "instant", instant: plus(prepared.schedule.asOf, 10800), sourceText: "target", sourceRange: prepared.span,
    ...overrides };
}

function evaluate(prepared, targets, overrides = {}) {
  return evaluateScheduleAlerts({ source: prepared.source, sourceDigest: "sha256:alert-source", operand: "plans/example plan.pert",
    schedule: prepared.schedule, targets, eventStates: [], precedenceForward: prepared.precedence,
    resourceForward: prepared.resource, requiredSchedule: prepared.required, driverLevel: "full", ...overrides },
  SCHEDULE_ALERT_CAPABILITY);
}

test("PAC-001 through PAC-004 enforce capability, strict current comparison, and completion", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/postdue-alert-core-v1.json", "utf8"));
  assert.deepEqual(fixture.cases.map(({ id }) => id), Array.from({ length: 16 }, (_, i) => `PAC-${String(i + 1).padStart(3, "0")}`));
  const prepared = setup();
  assert.throws(() => evaluateScheduleAlerts({}, { ...SCHEDULE_ALERT_CAPABILITY }), /capability is required/);
  const late = target(prepared, { instant: plus(prepared.schedule.asOf, -1) });
  assert.equal(evaluate(prepared, [late]).occurrences[0].kind, "POSTDUE");
  assert.equal(evaluate(prepared, [target(prepared, { instant: prepared.schedule.asOf })]).occurrences
    .some(({ kind }) => kind === "POSTDUE"), false);
  assert.equal(evaluate(prepared, [late], { eventStates: [{ subjectKind: "milestone", subjectId: "END", event: "reach", complete: true, actualInstant: null }] }).summary.total, 0);
});

test("PAC-005 through PAC-008 select precedence then optimal-false resource proof", () => {
  const prepared = setup();
  const precedenceLate = evaluate(prepared, [target(prepared)]).occurrences[0];
  assert.equal(precedenceLate.proof.kind, "precedence_infeasible");
  const resource = { ...prepared.resource,
    tasks: prepared.resource.tasks.map((task) => ({ ...task, start: plus(task.start, 7200), finish: plus(task.finish, 7200) })),
    milestones: prepared.resource.milestones.map((item) => ({ ...item, reach: plus(item.reach, 7200) })) };
  const resourceOnly = evaluate(prepared, [target(prepared, { instant: plus(prepared.schedule.asOf, 18000) })], { resourceForward: resource }).occurrences[0];
  assert.equal(resourceOnly.proof.kind, "resource_heuristic_late");
  assert.equal(resourceOnly.proof.optimal, false);
  const twoTargets = evaluate(prepared, [target(prepared), target(prepared, { targetKind: "latest" })]);
  assert.equal(new Set(twoTargets.occurrences.map(({ alertId }) => alertId)).size, 2);
  assert.equal(evaluate(prepared, [target(prepared), target(prepared)]).summary.total, 1);
});

test("PAC-009 through PAC-013 produce scoped drivers or exact recovery", () => {
  const prepared = setup();
  const full = evaluate(prepared, [target(prepared)]).occurrences[0].driver;
  assert.equal(full.state, "available");
  assert.equal(full.scope, "project_finish");
  assert.deepEqual(full.steps.filter(({ kind }) => kind === "task").map(({ id }) => id), ["A", "B"]);
  const intermediate = evaluate(prepared, [target(prepared, { subjectKind: "task", subjectId: "A", event: "finish",
    instant: plus(prepared.schedule.asOf, 3600) })]).occurrences[0].driver;
  assert.equal(intermediate.scope, "target");
  assert.deepEqual(intermediate.steps.map(({ id }) => id), ["A"]);
  const compact = evaluate(prepared, [target(prepared)], { driverLevel: "none" }).occurrences[0].driver;
  assert.equal(compact.state, "not_computed");
  assert.deepEqual(compact.analysisArgv, ["perttool", "dag", "analyze", "plans/example plan.pert", "--schedule", "both", "--format", "json"]);
});

test("PAC-014/PAC-015 retain stable ordering, totals, and bounded driver prefixes", () => {
  const prepared = setup();
  const targets = [target(prepared, { targetKind: "latest" }), target(prepared)];
  const limited = evaluate(prepared, targets, { maxAlerts: 1, maxDriverSteps: 1 });
  assert.deepEqual(limited.summary, { postdue: 0, postdueForecast: 2, total: 2 });
  assert.deepEqual(limited.truncation, { truncated: true, emitted: 1, total: 2, totalKnown: true });
  assert.equal(limited.occurrences[0].driver.truncated, true);
  assert.equal(limited.occurrences[0].driver.analysisArgv !== null, true);
});

test("PAC-016 keeps the evaluator internal and public identities unchanged", () => {
  const prepared = setup();
  assert.equal(Object.isFrozen(SCHEDULE_ALERT_CAPABILITY), true);
  assert.equal("evaluateScheduleAlerts" in publicApi, false);
  assert.equal(evaluate(prepared, [target(prepared, { temporalKind: "date", instant: null })]).summary.total, 0);
  const unavailable = { state: "unavailable", algorithm: prepared.resource.algorithm, makespanSeconds: null,
    tasks: [], milestones: [], utilization: [], unavailableCauses: [] };
  const unavailableResult = evaluate(prepared, [target(prepared)], {
    precedenceForward: unavailable, resourceForward: unavailable,
  });
  assert.equal(unavailableResult.state, "unavailable");
  assert.equal(unavailableResult.unavailableCauses[0].code, "forward_schedule_unavailable");
});
