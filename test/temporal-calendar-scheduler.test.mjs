import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import { rational } from "../dist/model/rational.js";
import {
  parseTemporalScheduleSource,
  TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
} from "../dist/temporal-schedule/source.js";
import {
  addCalendarWorkingTime,
  analyzeCalendarSchedule,
  calendarWorkSeconds,
  subtractCalendarWorkingTime,
  TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY,
  TEMPORAL_SCHEDULE_SCHEDULER_LIMITS,
} from "../dist/temporal-schedule/scheduler.js";

const seconds = (value) => rational(BigInt(Date.parse(value) / 1_000));
const duration = (value) => rational(BigInt(value));
const exact = (value) => `${value.numerator}/${value.denominator}`;

function documentSource({
  id = "SCHEDULE",
  zone = "Asia/Tokyo",
  asOf = "2026-08-17T09:00:00+09:00",
  calendarLines = [
    "  mon 09:00..12:00, 13:00..17:00",
    "  tue 09:00..12:00, 13:00..17:00",
  ],
  extraCalendars = [],
  resources = [{ id: "DEV", capacity: 1, fields: ["  calendar WORK"] }],
  tasks = [{ id: "A", from: "START", to: "END", duration: "1h", requirements: [["DEV", 1]] }],
  named = true,
} = {}) {
  const lines = [
    `project ${id}:`,
    "  version 8",
    '  title "Schedule"',
    `  as_of ${asOf}`,
    "  duration_unit hour",
    "  finish END",
    ...(named ? [`  time_zone ${JSON.stringify(zone)}`, '  tzdb "2026c"', "  calendar WORK"] : []),
    "",
    ...(named ? ["calendar WORK:", ...calendarLines, "", ...extraCalendars] : []),
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone END:",
    '  title "End"',
  ];
  for (const resource of resources) {
    lines.push("", `resource ${resource.id}:`, `  title "${resource.id}"`,
      `  capacity ${resource.capacity}`, ...resource.fields);
  }
  for (const task of tasks) {
    lines.push("", `task ${task.id} ${task.from} -> ${task.to}:`,
      `  title "${task.id}"`, `  duration ${task.duration}`);
    if (task.status) lines.push(`  status ${task.status}`);
    if (task.requirements.length > 0) {
      lines.push("  requires:", ...task.requirements.map(([resourceId, units]) => `    ${resourceId} ${units}`));
    }
  }
  return `${lines.join("\n")}\n`;
}

function parsed(options) {
  const text = documentSource(options);
  const result = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return { text, result };
}

function task(id, source, target, work, requirements = [], extra = {}) {
  return Object.freeze({
    kind: "task",
    id,
    source,
    target,
    status: extra.status ?? "planned",
    expectedWorkSeconds: duration(work),
    ...(extra.remaining === undefined ? {} : { remainingWorkSeconds: duration(extra.remaining) }),
    priority: extra.priority ?? 0,
    totalFloat: duration(extra.float ?? 0),
    requirements: Object.freeze(requirements.map(([resourceId, units]) => ({ resourceId, units }))),
  });
}

function input(source, edges, resources, extra = {}) {
  return Object.freeze({
    documentId: source.model.documentId,
    asOf: extra.asOf ?? seconds("2026-08-17T09:00:00+09:00"),
    horizonEnd: extra.horizonEnd ?? seconds("2026-08-25T18:00:00+09:00"),
    finishMilestoneId: "END",
    frontierMilestoneIds: ["START"],
    milestoneIds: ["START", "END"],
    resources,
    edges,
    ...(extra.capacityOverrides === undefined ? {} : { capacityOverrides: extra.capacityOverrides }),
  });
}

test("TCS-001 keeps the exact scheduler capability internal and source bound", async () => {
  const fixture = JSON.parse(await readFile("test/fixtures/temporal-calendar-scheduler-v1.json", "utf8"));
  assert.deepEqual(fixture.cases.map(({ id }) => id),
    Array.from({ length: 14 }, (_, index) => `TCS-${String(index + 1).padStart(3, "0")}`));
  assert.equal(Object.isFrozen(TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY), true);
  assert.deepEqual(TEMPORAL_SCHEDULE_SCHEDULER_LIMITS, {
    workSegments: 1_000_000,
    scheduleEvents: 1_000_000,
  });
  const { result } = parsed();
  assert.equal(exact(result.model.asOf.instantSeconds),
    exact(seconds("2026-08-17T09:00:00+09:00")));
  assert.throws(() => analyzeCalendarSchedule(result, input(result, [], []),
    { ...TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY }), /scheduler capability is required/);
  assert.throws(() => analyzeCalendarSchedule(result,
    { ...input(result, [], []), asOf: seconds("2026-08-17T10:00:00+09:00") },
    TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY), /does not match the source or horizon/);
  for (const name of ["analyzeCalendarSchedule", "addCalendarWorkingTime",
    "TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY"]) assert.equal(name in publicApi, false, name);
});

test("TCS-002 adds and subtracts exact work across lunch as inverse operations", () => {
  const { result } = parsed();
  const resources = [{ id: "DEV", capacity: 1 }];
  const requirements = [{ resourceId: "DEV", units: 1 }];
  const start = seconds("2026-08-17T09:00:00+09:00");
  const added = addCalendarWorkingTime(result, requirements, resources, start,
    duration(4 * 3600), seconds("2026-08-18T18:00:00+09:00"),
    TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(added.state, "available");
  assert.equal(exact(added.value), exact(seconds("2026-08-17T14:00:00+09:00")));
  assert.deepEqual(added.segments.map(({ start: left, end }) => [exact(left), exact(end)]), [
    [exact(start), exact(seconds("2026-08-17T12:00:00+09:00"))],
    [exact(seconds("2026-08-17T13:00:00+09:00")), exact(added.value)],
  ]);
  const subtracted = subtractCalendarWorkingTime(result, requirements, resources,
    added.value, duration(4 * 3600), start, TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(exact(subtracted.value), exact(start));
  assert.equal(exact(calendarWorkSeconds(result, rational(3n, 2n), "hour", null,
    TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY).seconds), "5400/1");
});

test("TCS-003 counts exact elapsed instants through a daylight-saving gap", () => {
  const { result } = parsed({
    zone: "America/New_York",
    asOf: "2026-03-08T01:00:00-05:00",
    calendarLines: ["  sun 01:00..04:00"],
  });
  const added = addCalendarWorkingTime(result, [{ resourceId: "DEV", units: 1 }],
    [{ id: "DEV", capacity: 1 }], seconds("2026-03-08T01:00:00-05:00"),
    duration(2 * 3600), seconds("2026-03-09T05:00:00-04:00"),
    TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(added.state, "available");
  assert.equal(exact(added.value), exact(seconds("2026-03-08T04:00:00-04:00")));
  const overlapSource = parsed({
    zone: "America/New_York",
    asOf: "2026-11-01T00:30:00-04:00",
    calendarLines: ["  sun 00:30..02:30"],
  }).result;
  const overlap = addCalendarWorkingTime(overlapSource, [{ resourceId: "DEV", units: 1 }],
    [{ id: "DEV", capacity: 1 }], seconds("2026-11-01T00:30:00-04:00"),
    duration(3 * 3600), seconds("2026-11-02T03:00:00-05:00"),
    TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(overlap.state, "available");
  assert.equal(exact(overlap.value), exact(seconds("2026-11-01T02:30:00-05:00")));
});

test("TCS-004 applies validity outside and capacity replacement before calendars", () => {
  const { result } = parsed({ resources: [{
    id: "DEV", capacity: 2, fields: [
      "  calendar WORK",
      "  available_from 2026-08-17T10:00:00+09:00",
      "  available_until 2026-08-17T16:00:00+09:00",
      "  availability 2026-08-17T12:00:00+09:00..2026-08-17T13:00:00+09:00 capacity 1",
    ],
  }] });
  const added = addCalendarWorkingTime(result, [{ resourceId: "DEV", units: 1 }],
    [{ id: "DEV", capacity: 2 }], seconds("2026-08-17T09:00:00+09:00"),
    duration(7 * 3600), seconds("2026-08-18T18:00:00+09:00"),
    TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(added.state, "unavailable");
  assert.equal(added.unavailableCauses[0].code, "calendar_search_limit");
  const lunch = addCalendarWorkingTime(result, [{ resourceId: "DEV", units: 1 }],
    [{ id: "DEV", capacity: 2 }], seconds("2026-08-17T12:00:00+09:00"),
    duration(3600), seconds("2026-08-17T13:00:00+09:00"),
    TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(lunch.state, "available");
});

test("TCS-005 requires the exact common interval of all resources", () => {
  const { result } = parsed({
    extraCalendars: ["calendar AFTERNOON:", "  mon 13:00..17:00", ""],
    resources: [
      { id: "DEV", capacity: 1, fields: ["  calendar WORK"] },
      { id: "ROOM", capacity: 1, fields: ["  calendar AFTERNOON"] },
    ],
    tasks: [{ id: "A", from: "START", to: "END", duration: "2h", requirements: [["DEV", 1], ["ROOM", 1]] }],
  });
  const added = addCalendarWorkingTime(result,
    [{ resourceId: "DEV", units: 1 }, { resourceId: "ROOM", units: 1 }],
    [{ id: "DEV", capacity: 1 }, { id: "ROOM", capacity: 1 }],
    seconds("2026-08-17T09:00:00+09:00"), duration(7200),
    seconds("2026-08-17T18:00:00+09:00"), TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(exact(added.value), exact(seconds("2026-08-17T15:00:00+09:00")));
});

test("TCS-006 releases a calendar-interrupted task and resumes it before new work", () => {
  const { result } = parsed({
    resources: [{ id: "DEV", capacity: 1, fields: [
      "  calendar WORK",
      "  availability 2026-08-17T10:00:00+09:00..2026-08-17T11:00:00+09:00 capacity 0",
    ] }],
    tasks: [
      { id: "A", from: "START", to: "END", duration: "2h", requirements: [["DEV", 1]] },
      { id: "B", from: "START", to: "END", duration: "1h", requirements: [["DEV", 1]] },
    ],
  });
  const edges = [task("A", "START", "END", 7200, [["DEV", 1]], { priority: 10 }),
    task("B", "START", "END", 3600, [["DEV", 1]])];
  const schedule = analyzeCalendarSchedule(result,
    input(result, edges, [{ id: "DEV", capacity: 1 }]), TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(schedule.resource.state, "available");
  const a = schedule.resource.tasks.find(({ id }) => id === "A");
  const b = schedule.resource.tasks.find(({ id }) => id === "B");
  assert.deepEqual(a.segments.map(({ start, end }) => [exact(start), exact(end)]), [
    [exact(seconds("2026-08-17T09:00:00+09:00")), exact(seconds("2026-08-17T10:00:00+09:00"))],
    [exact(seconds("2026-08-17T11:00:00+09:00")), exact(seconds("2026-08-17T12:00:00+09:00"))],
  ]);
  assert.equal(exact(b.start), exact(seconds("2026-08-17T13:00:00+09:00")));
});

test("TCS-007 computes precedence version 2 without cross-task contention", () => {
  const { result } = parsed({ tasks: [
    { id: "A", from: "START", to: "END", duration: "2h", requirements: [["DEV", 1]] },
    { id: "B", from: "START", to: "END", duration: "2h", requirements: [["DEV", 1]] },
  ] });
  const schedule = analyzeCalendarSchedule(result, input(result,
    [task("A", "START", "END", 7200, [["DEV", 1]]), task("B", "START", "END", 7200, [["DEV", 1]])],
    [{ id: "DEV", capacity: 1 }]), TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(schedule.precedence.algorithm.version, 2);
  assert.equal(exact(schedule.precedence.makespanSeconds), exact(seconds("2026-08-17T11:00:00+09:00")));
});

test("TCS-008 constructs an optimal-false finite-capacity parallel-SGS schedule", () => {
  const { result } = parsed({ tasks: [
    { id: "A", from: "START", to: "END", duration: "2h", requirements: [["DEV", 1]] },
    { id: "B", from: "START", to: "END", duration: "2h", requirements: [["DEV", 1]] },
  ] });
  const schedule = analyzeCalendarSchedule(result, input(result,
    [task("A", "START", "END", 7200, [["DEV", 1]]), task("B", "START", "END", 7200, [["DEV", 1]])],
    [{ id: "DEV", capacity: 1 }]), TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(schedule.resource.algorithm.optimal, false);
  assert.equal(exact(schedule.resource.makespanSeconds), exact(seconds("2026-08-17T14:00:00+09:00")));
});

test("TCS-009 uses active remaining work and rejects simultaneous active conflicts", () => {
  const { result } = parsed({ resources: [
    { id: "DEV", capacity: 2, fields: ["  calendar WORK"] },
  ], tasks: [
    { id: "A", from: "START", to: "END", duration: "3h", status: "active", requirements: [["DEV", 1]] },
    { id: "B", from: "START", to: "END", duration: "3h", status: "active", requirements: [["DEV", 1]] },
  ] });
  const schedule = analyzeCalendarSchedule(result, input(result, [
    task("A", "START", "END", 10800, [["DEV", 1]], { status: "active", remaining: 3600 }),
    task("B", "START", "END", 10800, [["DEV", 1]], { status: "active", remaining: 3600 }),
  ], [{ id: "DEV", capacity: 2 }], { capacityOverrides: new Map([["DEV", 1]]) }),
  TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(schedule.resource.state, "unavailable");
  assert.equal(schedule.resource.unavailableCauses[0].code, "active_capacity_conflict");
});

test("TCS-010 derives exact resource utilization from unit-seconds", () => {
  const { result } = parsed();
  const schedule = analyzeCalendarSchedule(result,
    input(result, [task("A", "START", "END", 3600, [["DEV", 1]])], [{ id: "DEV", capacity: 1 }]),
    TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  const utilization = schedule.resource.utilization[0];
  assert.equal(exact(utilization.allocatedUnitSeconds), "3600/1");
  assert.equal(exact(utilization.availableUnitSeconds), "3600/1");
  assert.equal(exact(utilization.utilization), "1/1");
});

test("TCS-011 distinguishes closed calendars from exhausted finite horizons", () => {
  const closed = parsed({ calendarLines: ["  mon off"] }).result;
  const noWindow = addCalendarWorkingTime(closed, [{ resourceId: "DEV", units: 1 }],
    [{ id: "DEV", capacity: 1 }], seconds("2026-08-17T09:00:00+09:00"), duration(1),
    seconds("2026-08-17T17:00:00+09:00"), TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(noWindow.unavailableCauses[0].code, "no_feasible_window");
  const { result } = parsed();
  const exhausted = addCalendarWorkingTime(result, [{ resourceId: "DEV", units: 1 }],
    [{ id: "DEV", capacity: 1 }], seconds("2026-08-17T16:30:00+09:00"), duration(3600),
    seconds("2026-08-17T17:00:00+09:00"), TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(exhausted.unavailableCauses[0].code, "calendar_search_limit");
});

test("TCS-012 applies bounded capacity overrides without mutating source", () => {
  const { text, result } = parsed({ resources: [{ id: "DEV", capacity: 2, fields: ["  calendar WORK"] }] });
  const before = result.model;
  const schedule = analyzeCalendarSchedule(result, input(result, [
    task("A", "START", "END", 3600, [["DEV", 1]]),
    task("B", "START", "END", 3600, [["DEV", 1]]),
  ], [{ id: "DEV", capacity: 2 }], { capacityOverrides: new Map([["DEV", 1]]) }),
  TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(exact(schedule.resource.makespanSeconds), exact(seconds("2026-08-17T11:00:00+09:00")));
  assert.strictEqual(result.model, before);
  assert.equal(text.includes("capacity 2"), true);
});

test("TCS-013 delegates the continuous compatibility profile", () => {
  const { result } = parsed({ named: false, resources: [{ id: "DEV", capacity: 1, fields: [] }] });
  const schedule = analyzeCalendarSchedule(result,
    input(result, [task("A", "START", "END", 3600, [["DEV", 1]])], [{ id: "DEV", capacity: 1 }]),
    TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.equal(schedule.precedence.state, "not_applicable");
  assert.equal(schedule.resource.state, "not_applicable");
  assert.equal(schedule.resource.unavailableCauses[0].code, "calendar_profile_absent");
});

test("TCS-014 freezes deterministic results and leaves active catalogs unchanged", () => {
  const { result } = parsed();
  const request = input(result, [task("A", "START", "END", 3600, [["DEV", 1]])], [{ id: "DEV", capacity: 1 }]);
  const first = analyzeCalendarSchedule(result, request, TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  const second = analyzeCalendarSchedule(result, request, TEMPORAL_SCHEDULE_SCHEDULER_CAPABILITY);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.resource.tasks), true);
  assert.equal(publicApi.COMMAND_REGISTRY.length, 53);
  assert.equal(publicApi.getJsonSchemaCatalog().length, 23);
  assert.equal(Object.keys(publicApi).length, 129);
});
