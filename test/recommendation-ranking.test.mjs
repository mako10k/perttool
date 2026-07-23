import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  analyzePrecedence,
  buildResidualGraph,
  checkDocument,
  rational,
} from "../dist/index.js";
import {
  explainRecommendationCandidateComparison,
  rankRecommendationCandidates,
} from "../dist/recommendation/ranking.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, "fixtures/recommendation");
const manifestPath = path.join(fixtureDirectory, "cases.json");

function exact(value, unit = "") {
  return `${value.numerator}/${value.denominator}${unit}`;
}

function rankingInput(text, appliedCapacities) {
  const checked = checkDocument(text);
  assert.equal(checked.ok, true);
  const graph = buildResidualGraph(checked.document);
  return {
    graph,
    precedence: analyzePrecedence(graph, 100),
    ...(appliedCapacities === undefined ? {} : { appliedCapacities }),
  };
}

async function rankFixture(name, appliedCapacities) {
  const text = await readFile(path.join(fixtureDirectory, name), "utf8");
  return rankRecommendationCandidates(rankingInput(text, appliedCapacities));
}

function decisionMap(result) {
  return new Map(result.taskDecisions.map((decision) => [decision.facts.taskId, decision]));
}

test("REC-001 through REC-007 derive the normative candidate facts, horizon, set, and tiers", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const entry of manifest.cases.filter(({ fixture }) => fixture !== undefined)) {
    const result = await rankFixture(entry.fixture);
    const repeated = await rankFixture(entry.fixture);
    assert.deepEqual(repeated, result, `${entry.case_id}:deterministic result`);
    assert.equal(
      result.algorithmId,
      "perttool.recommendation-ranking.lexicographic-frontier",
      entry.case_id,
    );
    assert.equal(result.algorithmVersion, 1, entry.case_id);
    assert.equal(result.optimal, false, entry.case_id);
    assert.deepEqual(
      result.candidates.map(({ taskId }) => taskId).sort(),
      [...entry.expected.ready_task_ids].sort(),
      `${entry.case_id}:candidate domain`,
    );
    assert.deepEqual(result.horizonTaskIds, entry.expected.horizon_task_ids, `${entry.case_id}:H`);
    assert.deepEqual(
      result.recommendedTaskIds,
      entry.expected.recommended_task_ids,
      `${entry.case_id}:R`,
    );
    assert.equal(result.jointFeasibility.feasible, true, `${entry.case_id}:joint feasibility`);
    for (const resource of result.jointFeasibility.resources) {
      assert.ok(
        resource.activeUsage + resource.selectedUsage <= resource.capacity,
        `${entry.case_id}:${resource.resourceId}:capacity invariant`,
      );
    }
    const decisions = decisionMap(result);
    assert.deepEqual(
      Object.fromEntries(result.taskDecisions.map(({ facts, tier }) => [facts.taskId, tier])),
      entry.expected.tiers,
      `${entry.case_id}:tiers`,
    );
    assert.equal(
      result.taskDecisions.some(({ tier }) => tier === "discouraged"),
      false,
      `${entry.case_id}:version 1 discouraged`,
    );
    for (const [taskId, expected] of Object.entries(entry.candidate_facts)) {
      if (!decisions.has(taskId)) continue;
      const facts = decisions.get(taskId).facts;
      if (expected.critical_class !== undefined) {
        assert.equal(facts.precedenceCriticalClass, expected.critical_class, `${entry.case_id}:${taskId}:class`);
      }
      if (expected.total_float !== undefined) {
        assert.equal(exact(facts.precedenceTotalFloat, "p"), expected.total_float, `${entry.case_id}:${taskId}:float`);
      }
      if (expected.priority !== undefined) {
        assert.equal(facts.explicitPriority, expected.priority, `${entry.case_id}:${taskId}:priority`);
      }
      for (const [field, property] of [
        ["new_ready_task_count", "newReadyTaskCount"],
        ["new_satisfied_gate_count", "newSatisfiedGateCount"],
        ["new_reached_milestone_count", "newReachedMilestoneCount"],
        ["next_gate_task_distance", "nextGateTaskDistance"],
        ["finish_task_distance", "finishTaskDistance"],
      ]) {
        if (expected[field] !== undefined) {
          assert.equal(facts[property], expected[field], `${entry.case_id}:${taskId}:${field}`);
        }
      }
      if (expected.requirements !== undefined) {
        assert.deepEqual(
          Object.fromEntries(facts.requirements.map(({ resourceId, units }) => [resourceId, units])),
          expected.requirements,
          `${entry.case_id}:${taskId}:requirements`,
        );
      }
    }
    for (const [taskId, higher] of Object.entries(
      entry.expected.primary_higher_priority_task_ids ?? {},
    )) {
      assert.equal(
        decisions.get(taskId).primaryHigherPriorityTaskId,
        higher,
        `${entry.case_id}:${taskId}:higher priority`,
      );
    }
    if (entry.expected.selected_blocker_task_ids !== undefined) {
      const rejected = result.taskDecisions.find(({ tier }) => tier === "deferred");
      assert.deepEqual(
        rejected?.selectedBlockerTaskIds ?? [],
        entry.expected.selected_blocker_task_ids,
        `${entry.case_id}:selected blockers`,
      );
    }
    if (entry.expected.active_blocker_task_ids !== undefined) {
      const rejected = result.taskDecisions.find(({ activeBlockerTaskIds }) => activeBlockerTaskIds.length > 0);
      assert.deepEqual(
        rejected?.activeBlockerTaskIds ?? [],
        entry.expected.active_blocker_task_ids,
        `${entry.case_id}:active blockers`,
      );
    }
  }
});

test("ranking comparisons identify the first differing exact rule and later support", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const caseId of ["REC-001", "REC-002", "REC-003", "REC-005"]) {
    const entry = manifest.cases.find(({ case_id }) => case_id === caseId);
    const result = await rankFixture(entry.fixture);
    const comparison = explainRecommendationCandidateComparison(
      result.candidates[0],
      result.candidates[1],
    );
    assert.equal(comparison.decisiveRuleId, entry.expected.decisive_rule_id, caseId);
    if (entry.expected.prior_tied_rule_ids !== undefined) {
      assert.deepEqual(comparison.priorTiedRuleIds, entry.expected.prior_tied_rule_ids, caseId);
    }
    if (entry.expected.contributing_rule_ids !== undefined) {
      assert.deepEqual(comparison.contributingRuleIds, entry.expected.contributing_rule_ids, caseId);
    }
  }
});

test("complete order covers every version 1 rule through the stable task ID tie-break", () => {
  const base = {
    taskId: "TASK_A",
    precedenceTotalFloat: rational(2n),
    precedenceCriticalClass: "non_critical",
    explicitPriority: 0,
    newReadyTaskIds: [],
    newReadyTaskCount: 0,
    newSatisfiedGateIds: [],
    newSatisfiedGateCount: 0,
    newReachedMilestoneIds: [],
    newReachedMilestoneCount: 0,
    nextGateTaskDistance: "infinity",
    finishTaskDistance: 3,
    expectedDuration: rational(1n),
    requirements: [],
  };
  const cases = [
    ["critical_class", { precedenceCriticalClass: "near_critical" }, {}],
    ["lower_total_float", { precedenceTotalFloat: rational(1n) }, {}],
    ["higher_explicit_priority", { explicitPriority: 1 }, {}],
    ["higher_new_ready_count", { newReadyTaskCount: 1 }, {}],
    ["higher_new_gate_count", { newSatisfiedGateCount: 1 }, {}],
    ["higher_new_milestone_count", { newReachedMilestoneCount: 1 }, {}],
    ["shorter_next_gate_distance", { nextGateTaskDistance: 2 }, {}],
    ["shorter_finish_distance", { finishTaskDistance: 2 }, {}],
    ["longer_expected_duration", { expectedDuration: rational(2n) }, {}],
    ["task_id_tiebreak", {}, { taskId: "TASK_B" }],
  ];
  for (const [rule, winnerOverrides, alternativeOverrides] of cases) {
    const winner = { ...base, ...winnerOverrides };
    const alternative = { ...base, taskId: "TASK_B", ...alternativeOverrides };
    const comparison = explainRecommendationCandidateComparison(winner, alternative);
    assert.equal(comparison.winnerTaskId, "TASK_A", rule);
    assert.equal(comparison.decisiveRuleId, rule, rule);
  }
});

test("selection horizon prefers the best ready critical class, then minimum float", () => {
  const text = `project HORIZON:
  version 1
  title "selection horizon"
  duration_unit point
  velocity 1p/1d
  critical_epsilon 1p
  finish FINISH

milestone NOW:
  title "now"
  state reached

milestone ACTIVE_DONE:
  title "active"

milestone NEAR_DONE:
  title "near"

milestone NON_DONE:
  title "non"

milestone FINISH:
  title "finish"

task ACTIVE NOW -> ACTIVE_DONE:
  title "driving active work"
  duration 3p
  status active

task NEAR NOW -> NEAR_DONE:
  title "near-critical ready work"
  duration 2p

task NON NOW -> NON_DONE:
  title "non-critical ready work"
  duration 1p

gate ACTIVE_GATE ACTIVE_DONE -> FINISH:
  reason "active"

gate NEAR_GATE NEAR_DONE -> FINISH:
  reason "near"

gate NON_GATE NON_DONE -> FINISH:
  reason "non"
`;
  const near = rankRecommendationCandidates(rankingInput(text));
  assert.deepEqual(
    near.candidates.map(({ taskId, precedenceCriticalClass }) => [taskId, precedenceCriticalClass]),
    [["NEAR", "near_critical"], ["NON", "non_critical"]],
  );
  assert.deepEqual(near.horizonTaskIds, ["NEAR"]);
  assert.deepEqual(near.recommendedTaskIds, ["NEAR"]);

  const exactOnly = rankRecommendationCandidates(
    rankingInput(text.replace("critical_epsilon 1p", "critical_epsilon 0p")),
  );
  assert.deepEqual(
    exactOnly.candidates.map(({ precedenceCriticalClass }) => precedenceCriticalClass),
    ["non_critical", "non_critical"],
  );
  assert.deepEqual(exactOnly.horizonTaskIds, ["NEAR"]);
});

test("resource scan separates selected blockers, active-only blockers, parallel capacity, and overrides", async () => {
  const selectedConflict = await rankFixture("rec-005-selected-resource-conflict.pert");
  const low = decisionMap(selectedConflict).get("ENV_LOW");
  const lowResource = low.selection.feasibility.resources.find(({ resourceId }) => resourceId === "ENV");
  assert.deepEqual(
    {
      activeUsage: lowResource.activeUsage,
      selectedUsage: lowResource.selectedUsage,
      required: lowResource.required,
      available: lowResource.available,
      deficit: lowResource.deficit,
      activeTaskIds: lowResource.activeTaskIds,
      selectedTaskIds: lowResource.selectedTaskIds,
    },
    {
      activeUsage: 0,
      selectedUsage: 1,
      required: 1,
      available: 0,
      deficit: 1,
      activeTaskIds: [],
      selectedTaskIds: ["ENV_HIGH"],
    },
  );

  const activeConflict = await rankFixture("rec-006-active-resource-empty.pert");
  const frontier = decisionMap(activeConflict).get("FRONTIER_TEST");
  assert.deepEqual(frontier.selectedBlockerTaskIds, []);
  assert.deepEqual(frontier.activeBlockerTaskIds, ["ACTIVE_TEST"]);
  assert.equal(frontier.primaryHigherPriorityTaskId, null);

  const parallel = await rankFixture("rec-004-parallel-set.pert");
  assert.deepEqual(parallel.recommendedTaskIds, ["PARALLEL_A", "PARALLEL_B"]);
  const reduced = await rankFixture(
    "rec-004-parallel-set.pert",
    new Map([["DEV", 1]]),
  );
  assert.deepEqual(reduced.recommendedTaskIds, ["PARALLEL_A"]);
  assert.equal(decisionMap(reduced).get("PARALLEL_B").tier, "deferred");
});
