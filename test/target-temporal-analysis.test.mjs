import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";
import {
  analyzeTargetTemporalDocument,
  selectTargetTemporalTasks,
} from "../dist/application/target-temporal-analysis.js";
import {
  TARGET_GRAMMAR_3_CAPABILITY,
} from "../dist/parser/document-parser.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const fixtureDirectory = path.join(
  testDirectory,
  "fixtures",
  "temporal-units",
);

async function fixture(name) {
  return readFile(path.join(fixtureDirectory, name), "utf8");
}

function analyze(text, options) {
  const result = analyzeTargetTemporalDocument(
    text,
    TARGET_GRAMMAR_3_CAPABILITY,
    options,
  );
  assert.equal(result.ok, true);
  assert.notEqual(result.base, null);
  assert.notEqual(result.temporal, null);
  return result;
}

function next(text, options) {
  const result = selectTargetTemporalTasks(
    text,
    TARGET_GRAMMAR_3_CAPABILITY,
    options,
  );
  assert.equal(result.ok, true);
  assert.equal(result.schemaVersion, "Perttool.NextResult.v4");
  assert.notEqual(result.recommendation, null);
  return result;
}

test("target Analysis v3 and Next v4 remain capability-checked internals", () => {
  assert.equal("analyzeTargetTemporalDocument" in publicApi, false);
  assert.equal("selectTargetTemporalTasks" in publicApi, false);
  assert.equal("selectNextTasksFromAnalysis" in publicApi, false);
  assert.throws(
    () => analyzeTargetTemporalDocument("", {
      id: "perttool.target-grammar-3-source",
      version: 1,
      grammarVersion: 3,
    }),
    /target Grammar 3 source capability is required/,
  );
});

test("AnalysisResult v3 composes base analysis with separate temporal views", async () => {
  const result = analyze(await fixture("calendar-date-v2.pert"));
  assert.equal(result.schemaVersion, "Perttool.AnalysisResult.v3");
  assert.equal(result.grammarVersion, 2);
  assert.equal(result.base.durationUnit, "day");
  assert.equal(result.base.precedence.makespan.numerator, 2n);
  assert.equal(result.base.resource.makespan.numerator, 2n);
  assert.deepEqual(result.temporal.interface, {
    id: "perttool.temporal-unit-interface",
    version: 2,
  });
  assert.equal(result.temporal.precedence.state, "available");
  assert.equal(result.temporal.resource.state, "available");
  assert.equal(
    result.temporal.precedence.tasks[0].start.calendar.sourceText,
    "2028-02-29",
  );
  assert.equal(
    result.temporal.resource.tasks[0].finish.calendar.sourceText,
    "2028-03-02",
  );
  assert.equal(
    result.temporal.deadlineEvaluations[0].combinedAssessment,
    "forecast_infeasible",
  );
});

test("TUE-004 Next v4 keeps ranking and applies only the release gate", async () => {
  const result = next(await fixture("calendar-date-v2.pert"));
  assert.deepEqual(result.groups.ready, ["LEAP_WINDOW"]);
  assert.deepEqual(result.recommendation.recommendedTaskIds, ["LEAP_WINDOW"]);
  assert.deepEqual(result.groups.runnableNow, []);
  assert.deepEqual(result.temporal.authority, {
    policy: "recommendation_v1_plus_release_gate",
    recommendationAlgorithm: {
      id: "perttool.recommendation-ranking.lexicographic-frontier",
      version: 1,
    },
    deadlineFactsUsedForRanking: false,
    timeEligibleTaskIds: [],
    timeIneligibleTaskIds: ["LEAP_WINDOW"],
    timeEligibilityUnavailableTaskIds: [],
    startableRecommendedTaskIds: [],
    delayedRecommendedTaskIds: ["LEAP_WINDOW"],
    unavailableRecommendedTaskIds: [],
  });
  assert.equal(
    result.temporal.tasks[0].timeEligibility.explanation.code,
    "not_before_future",
  );
});

test("TUE-005 an equal release instant is startable", async () => {
  const result = next(await fixture("calendar-offset-v2.pert"));
  assert.deepEqual(result.groups.runnableNow, ["OFFSET_EQUAL"]);
  assert.deepEqual(
    result.temporal.authority.startableRecommendedTaskIds,
    ["OFFSET_EQUAL"],
  );
  assert.equal(result.temporal.tasks[0].timeEligibility.state, "eligible");
  assert.equal(
    result.temporal.tasks[0].timeEligibility.explanation.code,
    "not_before_reached",
  );
  assert.equal(
    result.temporal.tasks[0].precedenceFinish.calendar.sourceText,
    "2026-07-25T11:00:00+09:00",
  );
});

test("TUE-006 mixed kinds remain ready but never gain start authority", async () => {
  const result = next(await fixture("mixed-kind-v2.pert"));
  assert.deepEqual(result.groups.ready, ["FUTURE_CLOCK"]);
  assert.deepEqual(result.recommendation.recommendedTaskIds, ["FUTURE_CLOCK"]);
  assert.deepEqual(result.groups.runnableNow, []);
  assert.deepEqual(
    result.temporal.authority.timeEligibilityUnavailableTaskIds,
    ["FUTURE_CLOCK"],
  );
  assert.deepEqual(
    result.temporal.authority.unavailableRecommendedTaskIds,
    ["FUTURE_CLOCK"],
  );
  assert.equal(
    result.temporal.tasks[0].timeEligibility.unavailableCauses[0].cause,
    "incomparable_temporal_kinds",
  );
});

test("TUE-009 deadline evidence does not change recommendation ranking", async () => {
  const result = next(await fixture("deadline-resource-v2.pert"));
  assert.deepEqual(result.recommendation.recommendedTaskIds, [
    "RESOURCE_FIRST",
  ]);
  assert.deepEqual(result.groups.runnableNow, ["RESOURCE_FIRST"]);
  const deadlineTask = result.temporal.tasks.find(({ taskId }) =>
    taskId === "DEADLINE_TASK"
  );
  assert.equal(
    deadlineTask.taskDeadlineEvaluation.combinedAssessment,
    "at_risk",
  );
  assert.equal(result.temporal.authority.deadlineFactsUsedForRanking, false);
});

test("TUE-011 complete history is retained only as deadline evidence", async () => {
  const result = next(await fixture("deadline-complete-v2.pert"));
  assert.deepEqual(result.groups, {
    active: [],
    ready: [],
    runnableNow: [],
    blockedNow: [],
    upcoming: [],
  });
  assert.deepEqual(result.temporal.tasks, []);
  const analysis = analyze(await fixture("deadline-complete-v2.pert"));
  assert.deepEqual(
    analysis.temporal.deadlineEvaluations.map(({ completionState }) =>
      completionState
    ),
    [
      "complete_actual_time_unavailable",
      "complete_actual_time_unavailable",
    ],
  );
});

test("Grammar 3 fraction analysis remains exact through the public Contract 4 Core", () => {
  const text = `project FRACTION_TARGET:
  version 3
  title "fraction target"
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
  duration 1/3h
  deadline 2026-07-25T10:00:00Z
`;
  const result = analyze(text);
  assert.equal(result.base.precedence.makespan.numerator, 1n);
  assert.equal(result.base.precedence.makespan.denominator, 3n);
  assert.equal(
    result.temporal.precedence.tasks[0].finish.calendar.sourceText,
    "2026-07-25T09:20:00Z",
  );
  const publicResult = publicApi.analyzeDocument(text);
  assert.equal(publicResult.ok, true);
  assert.equal(publicResult.schemaVersion, "Perttool.AnalysisResult.v3");
  assert.equal(publicResult.precedence.makespan.numerator, 1n);
  assert.equal(publicResult.precedence.makespan.denominator, 3n);
  assert.equal(
    publicResult.temporal.precedence.tasks[0].finish.calendar.sourceText,
    "2026-07-25T09:20:00Z",
  );
});

test("Grammar 1 base recommendation remains byte-structurally unchanged", async () => {
  const text = await readFile(
    path.join(root, "docs/examples/parallel.pert"),
    "utf8",
  );
  const active = publicApi.selectNextTasks(text);
  const target = next(text);
  assert.deepEqual(target.recommendation, active.recommendation);
  assert.deepEqual(target.tasks, active.tasks);
  assert.deepEqual(target.groups.ready, active.groups.ready);
  assert.deepEqual(
    target.groups.runnableNow,
    active.groups.runnableNow,
  );
  assert.equal(target.temporal.authority.deadlineFactsUsedForRanking, false);
});

test("invalid target source suppresses analysis and temporal results", () => {
  const result = analyzeTargetTemporalDocument(
    `project INVALID:
  version 3
  title "invalid"
  duration_unit day
  finish FINISH

milestone FINISH:
  title "finish"

task BAD FINISH -> FINISH:
  title "bad"
  duration 1/0d
`,
    TARGET_GRAMMAR_3_CAPABILITY,
  );
  assert.equal(result.ok, false);
  assert.equal(result.base, null);
  assert.equal(result.temporal, null);
  assert.equal(result.diagnostics.some(({ code }) => code === "PTDSL-007"), true);
});

test("target temporal analysis and Next results are deterministic", async () => {
  const text = await fixture("migration-point-v2.pert");
  assert.deepEqual(analyze(text), analyze(text));
  assert.deepEqual(next(text), next(text));
  const result = next(text);
  assert.equal(result.recommendation.explanationStatus.complete, true);
  assert.equal(result.recommendation.explanationStatus.truncated, false);
  assert.deepEqual(
    result.temporal.tasks.map(({ taskId }) => taskId),
    ["FIXED", "ESTIMATED"],
  );
});
