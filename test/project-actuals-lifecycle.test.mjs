import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  deriveWorkEventId,
} from "../dist/actuals/lifecycle.js";
import {
  analyzeTargetActualsDocument,
  selectTargetActualsTasks,
} from "../dist/application/target-actuals-analysis.js";
import {
  projectTargetTemporalInputs,
} from "../dist/application/target-temporal-input.js";
import {
  planTargetLifecycleMutation,
} from "../dist/application/target-actuals-mutation.js";
import {
  analyzeTemporalPrecedenceSchedule,
} from "../dist/analysis/temporal-precedence.js";
import {
  TARGET_GRAMMAR_5_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar5Document,
} from "../dist/semantic/target-validator.js";

function event(id, taskId, fields) {
  return [
    "",
    `work_event ${id}:`,
    "  model 1",
    `  task ${taskId}`,
    ...fields,
  ];
}

function lifecycleSource({
  version = 4,
  status = "planned",
  events = [],
  occupied = false,
} = {}) {
  return [
    "project ACTUALS:",
    `  version ${version}`,
    '  title "actuals"',
    "  as_of 2026-07-28",
    "  duration_unit point",
    "  velocity 3p/1d",
    "  finish DONE",
    "",
    "resource DEV:",
    '  title "developer"',
    "  capacity 1",
    "",
    "milestone NOW:",
    '  title "now"',
    "  state reached",
    "",
    "milestone DONE:",
    '  title "done"',
    "",
    "task WORK NOW -> DONE:",
    '  title "work"',
    "  estimate:",
    "    optimistic 1p",
    "    most_likely 3p",
    "    pessimistic 5p",
    `  status ${status}`,
    "  requires:",
    "    DEV 1",
    ...(occupied
      ? [
          "",
          "task OCCUPIED NOW -> DONE:",
          '  title "occupied"',
          "  duration 2p",
          "  status active",
          "  requires:",
          "    DEV 1",
        ]
      : []),
    ...events,
    "",
  ].join("\n");
}

function mutation(kind, occurredAt, event = {}) {
  return {
    kind,
    taskId: "WORK",
    event: {
      occurredAt,
      ...event,
    },
  };
}

test("start, suspend, and resume append exact evidence atomically", () => {
  const started = planTargetLifecycleMutation(
    lifecycleSource(),
    mutation("task.start", "2026-07-28T09:00:00.000+09:00"),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(started.ok, true);
  assert.equal(started.lifecycle.fromState, "planned");
  assert.equal(started.lifecycle.toState, "active");
  assert.equal(started.lifecycle.coverage, "open");
  assert.equal(
    started.lifecycle.event.id,
    deriveWorkEventId(
      "WORK",
      "start",
      "2026-07-28T09:00:00+09:00",
    ),
  );
  assert.equal(started.lifecycle.event.plannedValue.sourceText, "3p");
  assert.match(started.updatedText, /  version 5/);
  assert.match(started.updatedText, /  status active/);
  assert.match(started.updatedText, /  planned_value 3p/);

  const repeatedStart = planTargetLifecycleMutation(
    started.updatedText,
    mutation("task.start", "2026-07-28T09:00:00+09:00"),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(repeatedStart.ok, true);
  assert.equal(repeatedStart.changed, false);
  assert.deepEqual(repeatedStart.edits, []);

  const suspended = planTargetLifecycleMutation(
    started.updatedText,
    mutation(
      "task.suspend",
      "2026-07-28T12:00:00+09:00",
      { reason: 'wait for "review"' },
    ),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(suspended.ok, true);
  assert.equal(suspended.lifecycle.fromState, "active");
  assert.equal(suspended.lifecycle.toState, "suspended");
  assert.equal(suspended.lifecycle.coverage, "open");
  assert.equal(suspended.lifecycle.event.reason, 'wait for "review"');
  assert.match(suspended.updatedText, /  status suspended/);
  assert.match(
    suspended.updatedText,
    /  reason "wait for \\"review\\""/,
  );

  const resumed = planTargetLifecycleMutation(
    suspended.updatedText,
    mutation("task.resume", "2026-07-28T14:00:00+09:00"),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(resumed.ok, true);
  assert.equal(resumed.lifecycle.fromState, "suspended");
  assert.equal(resumed.lifecycle.toState, "active");
  assert.equal(resumed.lifecycle.coverage, "open");
  assert.match(resumed.updatedText, /  status active/);
  assert.match(resumed.updatedText, /  kind resume/);
});

test("lifecycle transitions fail closed on wrong state, legacy gaps, and identity drift", () => {
  const wrongState = planTargetLifecycleMutation(
    lifecycleSource(),
    mutation("task.resume", "2026-07-28T09:00:00+09:00"),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(wrongState.ok, false);
  assert.equal(
    wrongState.diagnostics.find(({ code }) => code === "PTACT-105")
      .data.detail,
    "expected_suspended_found_planned",
  );

  const legacyGap = planTargetLifecycleMutation(
    lifecycleSource({ status: "active" }),
    mutation("task.suspend", "2026-07-28T10:00:00+09:00"),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(legacyGap.ok, false);
  assert.equal(
    legacyGap.diagnostics.find(({ code }) => code === "PTACT-105")
      .data.detail,
    "lifecycle_sequence_must_start_with_start",
  );

  const eventId = "WE-fixed";
  const started = planTargetLifecycleMutation(
    lifecycleSource(),
    mutation(
      "task.start",
      "2026-07-28T09:00:00+09:00",
      { id: eventId },
    ),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  const conflict = planTargetLifecycleMutation(
    started.updatedText,
    mutation(
      "task.suspend",
      "2026-07-28T10:00:00+09:00",
      { id: eventId },
    ),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(conflict.ok, false);
  assert.deepEqual(
    conflict.diagnostics
      .filter(({ code }) => code.startsWith("PTACT"))
      .map(({ code, data }) => [code, data.cause]),
    [["PTACT-106", "event_identity_conflict"]],
  );
});

test("start and resume reject unavailable snapshot resource capacity", () => {
  const start = planTargetLifecycleMutation(
    lifecycleSource({ occupied: true }),
    mutation("task.start", "2026-07-28T09:00:00+09:00"),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(start.ok, false);
  const diagnostic = start.diagnostics.find(
    ({ code }) => code === "PTACT-108",
  );
  assert.equal(diagnostic.data.cause, "resource_unavailable");
  assert.equal(diagnostic.data.resource_id, "DEV");
  assert.deepEqual(diagnostic.data.active_task_ids, ["OCCUPIED"]);
  assert.equal(diagnostic.related[0].message, "active task OCCUPIED");

  const resume = planTargetLifecycleMutation(
    lifecycleSource({
      version: 5,
      status: "suspended",
      occupied: true,
      events: [
        ...event("WE-start", "WORK", [
          "  kind start",
          "  occurred_at 2026-07-28T08:00:00+09:00",
          "  planned_value 3p",
        ]),
        ...event("WE-suspend", "WORK", [
          "  kind suspend",
          "  occurred_at 2026-07-28T08:30:00+09:00",
        ]),
      ],
    }),
    mutation("task.resume", "2026-07-28T09:00:00+09:00"),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(resume.ok, false);
  assert.equal(
    resume.diagnostics.find(({ code }) => code === "PTACT-108")
      .data.resource_id,
    "DEV",
  );
});

function suspendedAnalysisSource({ suspendedFromReached = true } = {}) {
  const taskFrom = suspendedFromReached ? "NOW" : "FUTURE";
  return [
    "project ACTUALS:",
    "  version 5",
    '  title "actuals"',
    "  as_of 2026-07-28",
    "  duration_unit point",
    "  velocity 3p/1d",
    "  finish DONE",
    "",
    "resource DEV:",
    '  title "developer"',
    "  capacity 1",
    "",
    "milestone NOW:",
    '  title "now"',
    "  state reached",
    "",
    ...(!suspendedFromReached
      ? [
          "milestone FUTURE:",
          '  title "future"',
          "",
        ]
      : []),
    "milestone DONE:",
    '  title "done"',
    "",
    ...(!suspendedFromReached
      ? [
          "task PREVIOUS NOW -> FUTURE:",
          '  title "previous"',
          "  duration 1p",
          "",
        ]
      : []),
    `task PAUSED ${taskFrom} -> DONE:`,
    '  title "paused"',
    "  duration 3p",
    "  status suspended",
    "  requires:",
    "    DEV 1",
    "",
    "task READY NOW -> DONE:",
    '  title "ready"',
    "  duration 2p",
    "  priority 100",
    "  requires:",
    "    DEV 1",
    ...event("WE-start", "PAUSED", [
      "  kind start",
      "  occurred_at 2026-07-28T09:00:00+09:00",
      "  planned_value 3p",
    ]),
    ...event("WE-suspend", "PAUSED", [
      "  kind suspend",
      "  occurred_at 2026-07-28T10:00:00+09:00",
      '  reason "pause"',
    ]),
    "",
  ].join("\n");
}

test("suspended tasks retain duration but release resources and remain separately classified", () => {
  const source = suspendedAnalysisSource();
  const analyzed = analyzeTargetActualsDocument(
    source,
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(analyzed.schemaVersion, "Perttool.AnalysisResult.v4");
  assert.equal(analyzed.ok, true);
  assert.deepEqual(analyzed.precedence.suspendedTaskIds, ["PAUSED"]);
  assert.equal(analyzed.precedence.conditionalOnSuspensionsResumed, true);
  assert.deepEqual(analyzed.resource.suspendedTaskIds, ["PAUSED"]);
  assert.equal(analyzed.resource.conditionalOnSuspensionsResumed, true);
  assert.equal(analyzed.resource.makespan.numerator, 5n);
  assert.equal(
    analyzed.resource.tasks.find(({ id }) => id === "PAUSED").expected
      .numerator,
    3n,
  );
  assert.equal(
    analyzed.temporal.resource.conditionalOnSuspensionsResumed,
    true,
  );
  assert.deepEqual(
    analyzed.taskActuals.find(({ taskId }) => taskId === "PAUSED"),
    {
      taskId: "PAUSED",
      status: "suspended",
      coverage: "open",
    },
  );

  const next = selectTargetActualsTasks(
    source,
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(next.schemaVersion, "Perttool.NextResult.v5");
  assert.equal(next.ok, true);
  assert.deepEqual(next.groups.suspended, ["PAUSED"]);
  assert.deepEqual(next.groups.blockedNow, []);
  assert.deepEqual(next.groups.ready, ["READY"]);
  assert.deepEqual(next.groups.runnableNow, ["READY"]);
  assert.deepEqual(next.recommendation.recommendedTaskIds, ["READY"]);
  assert.deepEqual(
    next.temporal.authority.startableRecommendedTaskIds,
    ["READY"],
  );
  assert.equal(
    next.temporal.authority.timeEligibleTaskIds.includes("PAUSED"),
    false,
  );
  assert.equal(
    next.tasks.find(({ id }) => id === "PAUSED").classification,
    "suspended",
  );
});

test("a suspended task requires its source milestone to be reached", () => {
  const analyzed = analyzeTargetActualsDocument(
    suspendedAnalysisSource({ suspendedFromReached: false }),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(analyzed.ok, false);
  assert.equal(
    analyzed.diagnostics.some(
      ({ code, entityId }) =>
        code === "PTDAG-207" && entityId === "PAUSED",
    ),
    true,
  );
});

test("raw suspended documents fail before low-level temporal scheduling", () => {
  const checked = validateTargetGrammar5Document(
    suspendedAnalysisSource(),
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  assert.equal(checked.ok, true);
  const inputs = projectTargetTemporalInputs(checked.validatedDocument);
  assert.throws(
    () =>
      analyzeTemporalPrecedenceSchedule(
        checked.validatedDocument,
        inputs,
      ),
    /requires a projected non-suspended status for task PAUSED/,
  );
});

test("lifecycle analysis remains internal until Contract 6 activation", () => {
  for (const name of [
    "planTargetLifecycleMutation",
    "analyzeTargetActualsDocument",
    "selectTargetActualsTasks",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
});
