import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist/cli.js");
const knownTiers = new Set([
  "recommended",
  "allowed",
  "deferred",
  "discouraged",
]);
const knownRules = new Set([
  "task_ready",
  "selection_horizon",
  "critical_class",
  "lower_total_float",
  "higher_explicit_priority",
  "higher_new_ready_count",
  "higher_new_gate_count",
  "higher_new_milestone_count",
  "shorter_next_gate_distance",
  "shorter_finish_distance",
  "longer_expected_duration",
  "task_id_tiebreak",
  "joint_resource_feasibility",
  "recommended_set_membership",
  "recommendation_tier",
]);
const knownDecisiveReasonCodes = new Set([
  "recommended_set_selected",
  "recommended_set_not_selected",
  "ranking_rule_supports_task",
  "ranking_rule_opposes_task",
  "recommended_set_addition_feasible",
  "recommended_set_resource_conflict",
  "policy_defers_start",
  "modeled_negative_fact_applies",
]);
const knownRelations = new Set([
  "equal",
  "not_equal",
  "less_than",
  "less_or_equal",
  "greater_than",
  "greater_or_equal",
  "contains",
]);

function runNext(fixture) {
  const command = spawnSync(
    process.execPath,
    [cli, "dag", "next", fixture, "--format=json"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(command.status, 0, command.stderr);
  assert.equal(command.stderr, "");
  return JSON.parse(command.stdout);
}

function sameMembers(left, right) {
  return (
    left.length === right.length &&
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.every((id) => right.includes(id))
  );
}

function understandsExpression(expression) {
  if (expression?.kind === "compare") {
    return (
      ["fact", "literal"].includes(expression.left?.kind) &&
      ["fact", "literal"].includes(expression.right?.kind) &&
      knownRelations.has(expression.relation)
    );
  }
  if (expression?.kind === "all" || expression?.kind === "any") {
    return (
      Array.isArray(expression.children) &&
      expression.children.every(understandsExpression)
    );
  }
  return false;
}

function understandsAuthorityContract(result) {
  const recommendation = result.recommendation;
  const authority = result.temporal?.authority;
  const omitted = recommendation?.explanation_status?.omitted_counts;
  if (
    result.schema_version !== "Perttool.NextResult.v4" ||
    result.recommendation_interface_version !== 1 ||
    result.ok !== true ||
    recommendation == null ||
    recommendation.algorithm?.id !==
      "perttool.recommendation-ranking.lexicographic-frontier" ||
    recommendation.algorithm.version !== 1 ||
    recommendation.algorithm.optimal !== false ||
    recommendation.reason_taxonomy_version !== "1.0" ||
    recommendation.explanation_model_version !== 1 ||
    recommendation.expression_version !== 1 ||
    recommendation.description_registry_version !== 1 ||
    recommendation.description_locale !== "en" ||
    recommendation.explanation_status?.complete !== true ||
    recommendation.explanation_status.decisive_chain_complete !== true ||
    recommendation.explanation_status.truncated !== false ||
    authority?.policy !== "recommendation_v1_plus_release_gate" ||
    authority.recommendation_algorithm?.id !== recommendation.algorithm.id ||
    authority.recommendation_algorithm?.version !==
      recommendation.algorithm.version ||
    authority.deadline_facts_used_for_ranking !== false ||
    !Array.isArray(authority.time_eligible_task_ids) ||
    !Array.isArray(authority.time_ineligible_task_ids) ||
    !Array.isArray(authority.time_eligibility_unavailable_task_ids) ||
    !Array.isArray(authority.startable_recommended_task_ids) ||
    !Array.isArray(authority.delayed_recommended_task_ids) ||
    !Array.isArray(authority.unavailable_recommended_task_ids) ||
    omitted == null ||
    ![
      "decision_steps",
      "facts",
      "comparisons",
      "reason_occurrences",
      "descriptions",
    ].every((key) => omitted[key] === 0) ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.some(({ code }) => code.startsWith("PTREC-"))
  ) {
    return false;
  }
  if (
    !Array.isArray(recommendation.task_decisions) ||
    !Array.isArray(recommendation.recommended_task_ids) ||
    !Array.isArray(recommendation.decision_steps) ||
    !Array.isArray(recommendation.reason_occurrences) ||
    !Array.isArray(result.groups?.ready) ||
    recommendation.task_decisions.some(
      ({ tier }) => !knownTiers.has(tier),
    ) ||
    !sameMembers(
      recommendation.task_decisions.map(
        ({ subject_task_id }) => subject_task_id,
      ),
      result.groups.ready,
    )
  ) {
    return false;
  }
  const decisiveSteps = recommendation.decision_steps.filter(
    ({ role }) => role === "decisive",
  );
  const decisiveReasons = recommendation.reason_occurrences.filter(
    ({ role }) => role === "decisive",
  );
  if (
    decisiveSteps.some(
      ({ rule, expression }) =>
        !knownRules.has(rule?.id) ||
        !understandsExpression(expression),
    ) ||
    decisiveReasons.some(
      ({ code }) => !knownDecisiveReasonCodes.has(code),
    )
  ) {
    return false;
  }
  const decisionByTask = new Map(
    recommendation.task_decisions.map((decision) => [
      decision.subject_task_id,
      decision,
    ]),
  );
  return recommendation.recommended_task_ids.every((id) => {
    const decision = decisionByTask.get(id);
    return (
      result.groups.ready.includes(id) &&
      decision?.tier === "recommended" &&
      decision.recommended_set_member === true
    );
  }) &&
    authority.startable_recommended_task_ids.every(
      (id) =>
        recommendation.recommended_task_ids.includes(id) &&
        authority.time_eligible_task_ids.includes(id),
    ) &&
    authority.delayed_recommended_task_ids.every(
      (id) =>
        recommendation.recommended_task_ids.includes(id) &&
        authority.time_ineligible_task_ids.includes(id),
    ) &&
    authority.unavailable_recommended_task_ids.every(
      (id) =>
        recommendation.recommended_task_ids.includes(id) &&
        authority.time_eligibility_unavailable_task_ids.includes(id),
    );
}

function evaluateNormalSelection(result, requestedTaskIds) {
  if (!understandsAuthorityContract(result)) {
    return {
      status: "safe_stop",
      reason: "unknown_or_incomplete_contract",
      selected_task_ids: [],
    };
  }
  const recommendation = result.recommendation;
  const authority = result.temporal.authority;
  const selectedTaskIds =
    requestedTaskIds === undefined
      ? authority.startable_recommended_task_ids
      : requestedTaskIds;
  if (selectedTaskIds.length === 0) {
    return {
      status: "no_start",
      reason: "empty_selection",
      selected_task_ids: [],
    };
  }
  if (
    new Set(selectedTaskIds).size !== selectedTaskIds.length ||
    selectedTaskIds.some(
      (id) =>
        !result.groups.ready.includes(id) ||
        !authority.time_eligible_task_ids.includes(id),
    )
  ) {
    return {
      status: "safe_stop",
      reason: "ineligible_selection",
      selected_task_ids: [],
    };
  }
  const decisionByTask = new Map(
    recommendation.task_decisions.map((decision) => [
      decision.subject_task_id,
      decision,
    ]),
  );
  if (
    selectedTaskIds.every(
      (id) => decisionByTask.get(id)?.tier === "recommended",
    ) &&
    selectedTaskIds.every((id) =>
      authority.startable_recommended_task_ids.includes(id)
    )
  ) {
    return {
      status: "authorized",
      reason: "recommended_subset",
      selected_task_ids: selectedTaskIds,
    };
  }
  const selectedSet = new Set(selectedTaskIds);
  const allRecommendedRetained =
    recommendation.recommended_task_ids.every((id) => selectedSet.has(id));
  const additionalTaskIds = selectedTaskIds.filter(
    (id) => !recommendation.recommended_task_ids.includes(id),
  );
  if (
    allRecommendedRetained &&
    additionalTaskIds.length === 1 &&
    decisionByTask.get(additionalTaskIds[0])?.tier === "allowed"
  ) {
    return {
      status: "authorized",
      reason: "recommended_set_plus_one_allowed",
      selected_task_ids: selectedTaskIds,
    };
  }
  return {
    status: "safe_stop",
    reason: "override_required",
    selected_task_ids: [],
  };
}

test("Contract 4 dry-run adopts only the documented temporal normal authority", async () => {
  const critical = runNext(
    "test/fixtures/recommendation/rec-001-critical-priority.pert",
  );
  const parallel = runNext(
    "test/fixtures/recommendation/rec-004-parallel-set.pert",
  );
  const deferred = runNext(
    "test/fixtures/recommendation/rec-005-selected-resource-conflict.pert",
  );
  const empty = runNext(
    "test/fixtures/recommendation/rec-007-no-ready.pert",
  );
  const actual = {
    automatic_recommended: evaluateNormalSelection(critical),
    recommended_subset: evaluateNormalSelection(
      parallel,
      ["PARALLEL_A"],
    ),
    recommended_plus_allowed: evaluateNormalSelection(
      critical,
      ["CRITICAL_FIX", "OPTIONAL_POLISH"],
    ),
    allowed_replacement: evaluateNormalSelection(
      critical,
      ["OPTIONAL_POLISH"],
    ),
    deferred_selection: evaluateNormalSelection(deferred, ["ENV_LOW"]),
    empty_recommendation: evaluateNormalSelection(empty),
  };
  const expected = JSON.parse(
    await readFile(
      path.join(
        testDirectory,
        "golden/recommendation/authority-adoption.expected.json",
      ),
      "utf8",
    ),
  );
  assert.deepEqual(actual, expected.normal_authority);
});

test("Contract 4 dry-run safely stops for unknown or incomplete authority semantics", async () => {
  const source = runNext(
    "test/fixtures/recommendation/rec-001-critical-priority.pert",
  );
  const cases = [
    ["schema_version", (json) => {
      json.schema_version = "Perttool.NextResult.v3";
    }],
    ["recommendation_interface_version", (json) => {
      json.recommendation_interface_version = 2;
    }],
    ["algorithm_id", (json) => {
      json.recommendation.algorithm.id = "unknown.algorithm";
    }],
    ["algorithm_version", (json) => {
      json.recommendation.algorithm.version = 2;
    }],
    ["reason_taxonomy_version", (json) => {
      json.recommendation.reason_taxonomy_version = "2.0";
    }],
    ["explanation_model_version", (json) => {
      json.recommendation.explanation_model_version = 2;
    }],
    ["expression_version", (json) => {
      json.recommendation.expression_version = 2;
    }],
    ["description_registry_version", (json) => {
      json.recommendation.description_registry_version = 2;
    }],
    ["description_locale", (json) => {
      json.recommendation.description_locale = "ja";
    }],
    ["incomplete", (json) => {
      json.recommendation.explanation_status.complete = false;
    }],
    ["truncated", (json) => {
      json.recommendation.explanation_status.truncated = true;
    }],
    ["unknown_tier", (json) => {
      json.recommendation.task_decisions[0].tier = "unknown";
    }],
    ["unknown_decisive_rule", (json) => {
      const step = json.recommendation.decision_steps.find(
        ({ role }) => role === "decisive",
      );
      step.rule.id = "unknown_rule";
    }],
    ["unknown_decisive_reason", (json) => {
      const reason = json.recommendation.reason_occurrences.find(
        ({ role }) => role === "decisive",
      );
      reason.code = "unknown_reason";
    }],
    ["unknown_expression_node", (json) => {
      const step = json.recommendation.decision_steps.find(
        ({ role }) => role === "decisive",
      );
      step.expression.kind = "unknown";
    }],
    ["ptrec_diagnostic", (json) => {
      json.diagnostics.push({ code: "PTREC-302" });
    }],
  ];
  const actual = Object.fromEntries(cases.map(([name, mutate]) => {
    const input = structuredClone(source);
    mutate(input);
    return [name, evaluateNormalSelection(input)];
  }));
  const expected = JSON.parse(
    await readFile(
      path.join(
        testDirectory,
        "golden/recommendation/authority-adoption.expected.json",
      ),
      "utf8",
    ),
  );
  assert.deepEqual(actual, expected.safe_stop);
});

test("Contract 4 authority stops for future release and unknown temporal policy", () => {
  const future = runNext(
    "test/fixtures/temporal-units/calendar-date-v2.pert",
  );
  assert.deepEqual(
    future.temporal.authority.delayed_recommended_task_ids,
    ["LEAP_WINDOW"],
  );
  assert.deepEqual(evaluateNormalSelection(future), {
    status: "no_start",
    reason: "empty_selection",
    selected_task_ids: [],
  });
  assert.deepEqual(evaluateNormalSelection(future, ["LEAP_WINDOW"]), {
    status: "safe_stop",
    reason: "ineligible_selection",
    selected_task_ids: [],
  });

  const unknown = structuredClone(future);
  unknown.temporal.authority.policy = "unknown";
  assert.deepEqual(evaluateNormalSelection(unknown), {
    status: "safe_stop",
    reason: "unknown_or_incomplete_contract",
    selected_task_ids: [],
  });
});
