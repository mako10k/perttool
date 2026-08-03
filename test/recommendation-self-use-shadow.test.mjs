import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist/cli.js");
const planNames = [
  "advance-clean-candidate",
  "advance-history-safety",
  "agent-guidance",
  "cli-surface-reset",
  "control-plane",
  "english-baseline",
  "grammar",
  "governance",
  "operations",
  "plan-assurance",
  "project-actuals",
  "recommendation",
  "release-0.2.0",
  "release-0.3.0",
  "release-0.4.0",
  "release-0.5.0",
  "release-0.5.1",
  "release-0.5.2",
  "release-0.5.3",
  "release-0.5.4",
  "release-0.5.5",
  "release-0.6.0",
  "scheduling-units-m1",
  "scheduling-units-m2",
  "scheduling-units-m2r",
  "scheduling-units-m3",
  "scheduling-units-m4",
  "scheduling-units-m5",
  "scheduling-units",
  "mvp",
];
const knownContract = {
  schema_version: "Perttool.NextResult.v5",
  recommendation_interface_version: 1,
  algorithm_id: "perttool.recommendation-ranking.lexicographic-frontier",
  algorithm_version: 1,
  algorithm_optimal: false,
  reason_taxonomy_version: "1.0",
  explanation_model_version: 1,
  expression_version: 1,
  description_registry_version: 1,
  description_locale: "en",
};

function runNext(planName) {
  return spawnSync(
    process.execPath,
    [cli, "dag", "next", `plans/${planName}.pert`, "--format=json"],
    { cwd: root, encoding: "utf8" },
  );
}

function projectReadyTask(task) {
  return {
    id: task.id,
    runnable_now: task.runnable_now,
    precedence_critical: task.precedence_critical,
    schedule_critical: task.schedule_critical,
    total_float: `${task.total_float.numerator}/${task.total_float.denominator}`,
    resource_rejections: task.resource_rejections.map((rejection) => ({
      resource_id: rejection.resource_id,
      capacity: rejection.capacity,
      used_before_decision: rejection.used_before_decision,
      required: rejection.required,
      deficit: rejection.deficit,
      active_task_ids: rejection.active_task_ids,
      earlier_selected_task_ids: rejection.earlier_selected_task_ids,
    })),
  };
}

function projectPlan(json) {
  const recommendation = json.recommendation;
  const jointFact = recommendation.facts.find(
    ({ id }) => id === recommendation.result_decision.joint_feasibility_fact_id,
  );
  assert.ok(jointFact);
  return {
    source_digest: json.source_digest,
    groups: json.groups,
    recommended_task_ids: recommendation.recommended_task_ids,
    manual_selected_task_ids: json.groups.runnable_now,
    tiers: Object.fromEntries(
      recommendation.task_decisions.map(({ subject_task_id, tier }) => [
        subject_task_id,
        tier,
      ]),
    ),
    joint_resource_feasible: jointFact.value.value,
    ready_tasks: json.tasks
      .filter(({ id }) => json.groups.ready.includes(id))
      .map(projectReadyTask),
    record_counts: {
      task_decisions: recommendation.task_decisions.length,
      decision_steps: recommendation.decision_steps.length,
      facts: recommendation.facts.length,
      comparisons: recommendation.comparisons.length,
      reasons: recommendation.reason_occurrences.length,
      descriptions: recommendation.descriptions.length,
    },
    diagnostic_codes: [...new Set(json.diagnostics.map(({ code }) => code))],
  };
}

function mapWitness(fact) {
  assert.equal(fact.kind, "resource_capacity_witness");
  assert.equal(fact.value.type, "map");
  return Object.fromEntries(
    fact.value.entries.map(({ key, value }) => [key.value, value.value]),
  );
}

function projectWhyNot(recommendation) {
  const alternative = recommendation.task_decisions.find(
    ({ primary_higher_priority_task_id }) =>
      primary_higher_priority_task_id !== null,
  );
  if (alternative === undefined) return null;
  const higherPriorityTaskId = alternative.primary_higher_priority_task_id;
  const rankingComparison = recommendation.comparisons.find(
    ({ scope, winner_task_id, loser_task_id }) =>
      scope === "selection_horizon" &&
      winner_task_id === higherPriorityTaskId &&
      loser_task_id === alternative.subject_task_id,
  );
  const resourceComparison = recommendation.comparisons.find(
    ({ scope, winner_task_id, loser_task_id }) =>
      scope === "resource_selection" &&
      winner_task_id === higherPriorityTaskId &&
      loser_task_id === alternative.subject_task_id,
  );
  assert.ok(rankingComparison);
  assert.ok(resourceComparison);
  const witness = recommendation.facts.find(
    ({ id, kind }) =>
      kind === "resource_capacity_witness" &&
      resourceComparison.fact_ids.includes(id),
  );
  assert.ok(witness);
  const descriptions = recommendation.descriptions
    .filter(({ id }) => alternative.description_ids.includes(id))
    .map(({ key, text }) => ({ key, text }));
  return {
    subject_task_id: alternative.subject_task_id,
    tier: alternative.tier,
    higher_priority_task_id: higherPriorityTaskId,
    ranking_decisive_rule: rankingComparison.decisive_rule.id,
    resource_decisive_rule: resourceComparison.decisive_rule.id,
    resource_id: witness.subject.id,
    resource_witness: mapWitness(witness),
    descriptions,
  };
}

test("all thirty self-use plans pass the v5 recommendation shadow gate", async () => {
  const expected = JSON.parse(
    await readFile(
      path.join(
        testDirectory,
        "golden/self-use/recommendation-shadow.expected.json",
      ),
      "utf8",
    ),
  );
  const actual = {
    contract: knownContract,
    plans: {},
    why_not: null,
  };

  for (const planName of planNames) {
    const first = runNext(planName);
    const second = runNext(planName);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(first.stderr, "");
    assert.equal(second.stderr, "");
    assert.equal(first.stdout, second.stdout, `${planName}: byte determinism`);

    const json = JSON.parse(first.stdout);
    const recommendation = json.recommendation;
    assert.ok(recommendation);
    assert.deepEqual(
      {
        schema_version: json.schema_version,
        recommendation_interface_version:
          json.recommendation_interface_version,
        algorithm_id: recommendation.algorithm.id,
        algorithm_version: recommendation.algorithm.version,
        algorithm_optimal: recommendation.algorithm.optimal,
        reason_taxonomy_version: recommendation.reason_taxonomy_version,
        explanation_model_version: recommendation.explanation_model_version,
        expression_version: recommendation.expression_version,
        description_registry_version:
          recommendation.description_registry_version,
        description_locale: recommendation.description_locale,
      },
      knownContract,
      `${planName}: known contract`,
    );
    assert.equal(recommendation.explanation_status.complete, true);
    assert.equal(
      recommendation.explanation_status.decisive_chain_complete,
      true,
    );
    assert.equal(recommendation.explanation_status.truncated, false);
    assert.deepEqual(
      recommendation.explanation_status.omitted_counts,
      {
        decision_steps: 0,
        facts: 0,
        comparisons: 0,
        reason_occurrences: 0,
        descriptions: 0,
      },
    );
    assert.equal(
      json.diagnostics.some(({ code }) => code.startsWith("PTREC-")),
      false,
    );
    assert.equal(
      json.temporal.authority.policy,
      "recommendation_v1_plus_release_gate",
    );
    assert.equal(
      json.temporal.authority.startable_recommended_task_ids.every(
        (id) =>
          recommendation.recommended_task_ids.includes(id) &&
          json.temporal.authority.time_eligible_task_ids.includes(id),
      ),
      true,
      `${planName}: temporal start authority`,
    );

    const readySet = new Set(json.groups.ready);
    assert.equal(
      recommendation.recommended_task_ids.every((id) => readySet.has(id)),
      true,
      `${planName}: recommended subset of ready`,
    );
    assert.deepEqual(
      recommendation.task_decisions
        .map(({ subject_task_id }) => subject_task_id)
        .sort(),
      [...json.groups.ready].sort(),
      `${planName}: complete ready decision coverage`,
    );
    const jointFact = recommendation.facts.find(
      ({ id }) =>
        id === recommendation.result_decision.joint_feasibility_fact_id,
    );
    assert.ok(jointFact);
    assert.deepEqual(jointFact.value, { type: "boolean", value: true });

    actual.plans[planName] = projectPlan(json);
    if (planName === "recommendation") {
      actual.why_not = projectWhyNot(recommendation);
    }
  }

  assert.deepEqual(actual, expected);
});
