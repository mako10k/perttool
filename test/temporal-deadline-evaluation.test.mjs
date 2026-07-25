import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  evaluateTemporalDeadlines,
} from "../dist/analysis/temporal-deadline.js";
import {
  analyzeTemporalPrecedenceSchedule,
} from "../dist/analysis/temporal-precedence.js";
import {
  analyzeTemporalResourceSchedule,
} from "../dist/analysis/temporal-resource.js";
import {
  projectTargetTemporalInputs,
} from "../dist/application/target-temporal-input.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar3Document,
} from "../dist/semantic/target-validator.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(
  testDirectory,
  "fixtures",
  "temporal-units",
);

function exact(value) {
  return value === null
    ? null
    : `${value.numerator}/${value.denominator}`;
}

function evaluateText(text) {
  const checked = validateTargetGrammar3Document(
    text,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(checked.ok, true);
  assert.notEqual(checked.validatedDocument, null);
  const inputs = projectTargetTemporalInputs(checked.validatedDocument);
  const precedence = analyzeTemporalPrecedenceSchedule(
    checked.validatedDocument,
    inputs,
  );
  const resource = analyzeTemporalResourceSchedule(
    checked.validatedDocument,
    inputs,
  );
  return evaluateTemporalDeadlines(
    checked.validatedDocument,
    inputs,
    precedence,
    resource,
  );
}

async function evaluateFixture(name) {
  return evaluateText(
    await readFile(path.join(fixtureDirectory, name), "utf8"),
  );
}

test("deadline evaluation remains an internal Contract 4 target", () => {
  assert.equal("evaluateTemporalDeadlines" in publicApi, false);
  assert.equal("DEADLINE_EVALUATION_IDENTITY" in publicApi, false);
});

test("TUE-004 reports exact leap-day lateness in both views", async () => {
  const evaluations = await evaluateFixture("calendar-date-v2.pert");
  const task = evaluations.find(({ subject }) => subject.kind === "task");
  assert.equal(task.current.state, "not_due");
  assert.equal(task.precedence.forecastRelation, "after_deadline");
  assert.equal(task.precedence.assessment, "lower_bound_late");
  assert.equal(task.resource.forecastRelation, "after_deadline");
  assert.equal(task.resource.assessment, "heuristic_late");
  assert.equal(task.resource.optimal, false);
  assert.equal(task.combinedAssessment, "forecast_infeasible");
  assert.deepEqual(task.precedence.signedMargin, {
    kind: "calendar_days",
    exact: { numerator: -1n, denominator: 1n },
  });
  assert.equal(exact(task.precedence.baseUnitMargin), "-1/1");
  assert.equal(exact(task.precedence.remainingMargin), "0/1");
  assert.equal(exact(task.precedence.lateness), "1/1");
  assert.deepEqual(task.destinationRelationship, {
    milestoneId: "RELEASED",
    relation: "same_deadline",
  });
});

test("TUE-005 keeps declared offsets and derives the anchor offset", async () => {
  const evaluations = await evaluateFixture("calendar-offset-v2.pert");
  const task = evaluations.find(({ subject }) => subject.kind === "task");
  assert.equal(task.deadline.sourceText, "2026-07-25T02:00:00Z");
  assert.equal(
    task.precedence.projectedCompletion.sourceText,
    "2026-07-25T11:00:00+09:00",
  );
  assert.equal(task.precedence.forecastRelation, "on_deadline");
  assert.equal(task.resource.forecastRelation, "on_deadline");
  assert.deepEqual(task.precedence.signedMargin, {
    kind: "si_seconds",
    exact: { numerator: 0n, denominator: 1n },
  });
  assert.equal(task.combinedAssessment, "forecast_on_time");
  assert.deepEqual(task.destinationRelationship, {
    milestoneId: "FINISH",
    relation: "same_deadline",
  });
});

test("TUE-006 preserves current date facts but fails unavailable schedules closed", async () => {
  const evaluations = await evaluateFixture("mixed-kind-v2.pert");
  for (const evaluation of evaluations) {
    assert.equal(evaluation.current.state, "not_due");
    assert.equal(evaluation.precedence.state, "unavailable");
    assert.equal(evaluation.resource.state, "unavailable");
    assert.equal(evaluation.combinedAssessment, "unavailable");
    assert.equal(
      evaluation.precedence.unavailableCauses[0].underlyingCause,
      "incomparable_temporal_kinds",
    );
  }
});

test("TUE-008 current comparison is inclusive and independent from forecast", () => {
  const evaluate = (deadline) => evaluateText(`project CURRENT_${deadline.replaceAll("-", "_")}:
  version 2
  title "current"
  as_of 2026-07-25
  duration_unit day
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"

task WORK START -> FINISH:
  title "work"
  duration 1d
  deadline ${deadline}
`)[0];
  const future = evaluate("2026-07-26");
  const equal = evaluate("2026-07-25");
  const past = evaluate("2026-07-24");
  assert.equal(future.current.state, "not_due");
  assert.equal(equal.current.state, "due_now");
  assert.equal(past.current.state, "overdue");
  assert.equal(past.combinedAssessment, "overdue");
  assert.deepEqual(
    [future, equal, past].map(({ current }) => [
      current.signedWindow.kind,
      exact(current.signedWindow.exact),
    ]),
    [
      ["calendar_days", "1/1"],
      ["calendar_days", "0/1"],
      ["calendar_days", "-1/1"],
    ],
  );
});

test("TUE-009 separates heuristic lateness from precedence proof", async () => {
  const evaluations = await evaluateFixture("deadline-resource-v2.pert");
  const task = evaluations.find(({ subject }) =>
    subject.id === "DEADLINE_TASK"
  );
  assert.equal(task.precedence.projectedCompletion.sourceText,
    "2026-07-25T11:00:00+09:00");
  assert.equal(task.precedence.assessment, "lower_bound_on_time");
  assert.equal(task.resource.projectedCompletion.sourceText,
    "2026-07-25T13:00:00+09:00");
  assert.equal(task.resource.assessment, "heuristic_late");
  assert.equal(task.resource.optimal, false);
  assert.equal(exact(task.resource.baseUnitMargin), "-2/1");
  assert.equal(task.combinedAssessment, "at_risk");
});

test("TUE-010 qualifies numeric results with blocked predecessors", async () => {
  const evaluations = await evaluateFixture("deadline-blocked-v2.pert");
  for (const evaluation of evaluations) {
    assert.equal(evaluation.combinedAssessment, "forecast_on_time");
    assert.equal(evaluation.conditionalOnBlocksResolved, true);
    assert.deepEqual(evaluation.blockedTaskIds, ["BLOCKED_INPUT"]);
    assert.equal(evaluation.precedence.conditionalOnBlocksResolved, true);
    assert.equal(evaluation.resource.optimal, false);
  }
});

test("TUE-011 never substitutes relative zero for completed history", async () => {
  const evaluations = await evaluateFixture("deadline-complete-v2.pert");
  assert.deepEqual(
    evaluations.map((evaluation) => ({
      id: evaluation.subject.id,
      completion: evaluation.completionState,
      current: evaluation.current.state,
      precedence: evaluation.precedence.state,
      resource: evaluation.resource.state,
      combined: evaluation.combinedAssessment,
    })),
    [
      {
        id: "HISTORICAL",
        completion: "complete_actual_time_unavailable",
        current: "not_applicable",
        precedence: "not_applicable",
        resource: "not_applicable",
        combined: "not_applicable",
      },
      {
        id: "FINISH",
        completion: "complete_actual_time_unavailable",
        current: "not_applicable",
        precedence: "not_applicable",
        resource: "not_applicable",
        combined: "not_applicable",
      },
    ],
  );
  assert.deepEqual(evaluations[1].subject.roles, [
    "milestone",
    "project_finish",
  ]);
});

test("point velocity produces exact calendar and base-unit margins", async () => {
  const evaluations = await evaluateFixture("migration-point-v2.pert");
  const fixed = evaluations.find(({ subject }) => subject.id === "FIXED");
  const estimated = evaluations.find(({ subject }) =>
    subject.id === "ESTIMATED"
  );
  assert.equal(
    fixed.precedence.projectedCompletion.sourceText,
    "2026-07-27T09:00:00+09:00",
  );
  assert.equal(fixed.combinedAssessment, "forecast_on_time");
  assert.equal(exact(fixed.precedence.baseUnitMargin), "0/1");
  assert.equal(
    estimated.precedence.projectedCompletion.sourceText,
    "2026-07-29T09:00:00+09:00",
  );
  assert.equal(exact(estimated.precedence.baseUnitMargin), "2/1");
});

test("exact non-terminating derived seconds remain numeric with null text", () => {
  const evaluations = evaluateText(`project EXACT_SECONDS:
  version 3
  title "exact seconds"
  as_of 2026-07-25T09:00:00Z
  duration_unit hour
  finish FINISH

milestone START:
  title "start"
  state reached

milestone FINISH:
  title "finish"

task WORK START -> FINISH:
  title "work"
  duration 1/7h
  deadline 2026-07-25T10:00:00Z
`);
  const task = evaluations[0];
  assert.equal(task.precedence.state, "available");
  assert.equal(task.precedence.projectedCompletion.sourceText, null);
  assert.deepEqual(
    task.precedence.unavailableCauses.map(({ cause }) => cause),
    ["exact_datetime_text_unavailable"],
  );
  assert.equal(task.precedence.forecastRelation, "before_deadline");
  assert.equal(task.combinedAssessment, "forecast_on_time");
});

test("deadline output order and repeated results are deterministic", async () => {
  const first = await evaluateFixture("migration-point-v2.pert");
  const second = await evaluateFixture("migration-point-v2.pert");
  assert.deepEqual(second, first);
  assert.deepEqual(first.map(({ subject }) => [
    subject.kind,
    subject.id,
  ]), [
    ["task", "FIXED"],
    ["task", "ESTIMATED"],
    ["milestone", "MID"],
    ["milestone", "FINISH"],
  ]);
});
