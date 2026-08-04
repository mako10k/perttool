import assert from "node:assert/strict";
import test from "node:test";
import * as publicApi from "../dist/index.js";
import {
  composePlanAssuranceMutationImpact,
  composePlanAssuranceNextAuthority,
  PLAN_ASSURANCE_AUTHORITY_POLICY,
  projectPlanAssuranceAnalysis,
  projectPlanAssuranceCheck,
} from "../dist/assurance/authority.js";
import {
  evaluatePlanAssurance,
  sealTaskResult,
} from "../dist/assurance/evaluate.js";
import {
  planTargetPlanAssuranceMutation,
} from "../dist/assurance/mutation.js";
import {
  analyzeTargetPlanAssuranceDocument,
  selectTargetPlanAssuranceAuthority,
} from "../dist/application/target-assurance-analysis.js";
import {
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../dist/parser/document-parser.js";

function contract(id, from, to, overrides = {}) {
  return {
    model: "Perttool.TaskPlanContract.v1",
    taskId: id,
    fromMilestoneId: from,
    toMilestoneId: to,
    title: id,
    description: null,
    durationOrEstimate: {
      kind: "duration",
      value: { numerator: "1", denominator: "1", unit: "point" },
    },
    notBefore: null,
    deadline: null,
    priority: 0,
    requirements: [],
    owner: null,
    tags: [],
    source: null,
    ...overrides,
  };
}

function task(taskContract, overrides = {}) {
  return {
    contract: taskContract,
    lifecycle: "unfinished",
    seal: null,
    outcome: null,
    ...overrides,
  };
}

function input(tasks, overrides = {}) {
  return {
    modelVersion: 1,
    hashModelVersion: 1,
    tasks,
    executionRelations: [],
    explicitRelations: [],
    frontierInputs: [],
    ...overrides,
  };
}

function resultById(evaluation, taskId) {
  const result = evaluation.taskResults.find(({ taskId: id }) => id === taskId);
  assert.ok(result, taskId);
  return result;
}

function withInitialSeals(unsealedInput) {
  const unsealed = evaluatePlanAssurance(unsealedInput);
  assert.equal(unsealed.ok, true);
  return {
    ...unsealedInput,
    tasks: unsealedInput.tasks.map((item) => ({
      ...item,
      seal: sealTaskResult(resultById(unsealed, item.contract.taskId)),
    })),
  };
}

function baseAuthority(overrides = {}) {
  return {
    recommendationInterfaceVersion: 1,
    rankingAlgorithm: {
      id: "perttool.recommendation-ranking.lexicographic-frontier",
      version: 1,
    },
    reasonTaxonomyVersion: "1.0",
    explanationModelVersion: 1,
    expressionVersion: 1,
    descriptionRegistryVersion: 1,
    descriptionLocale: "en",
    temporalPolicy: "recommendation_v1_plus_release_gate",
    traceComplete: true,
    diagnosticsTruncated: false,
    rawRecommendedTaskIds: [],
    temporalStartableRecommendedTaskIds: [],
    ...overrides,
  };
}

test("authority Core remains absent from the Contract 6 package root", () => {
  for (const name of [
    "composePlanAssuranceNextAuthority",
    "projectPlanAssuranceCheck",
    "projectPlanAssuranceAnalysis",
    "selectTargetPlanAssuranceAuthority",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
});

test("assurance-disabled compatibility preserves existing start authority", () => {
  const evaluation = evaluatePlanAssurance(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
  ], { modelVersion: null, hashModelVersion: null }));
  const next = composePlanAssuranceNextAuthority(evaluation, baseAuthority({
    rawRecommendedTaskIds: ["B", "A"],
    temporalStartableRecommendedTaskIds: ["B", "A"],
  }));

  assert.equal(next.ok, true);
  assert.equal(next.authority.complete, true);
  assert.equal(next.authority.policy, PLAN_ASSURANCE_AUTHORITY_POLICY);
  assert.deepEqual(next.authority.rawRecommendedTaskIds, ["B", "A"]);
  assert.deepEqual(next.authority.startableRecommendedTaskIds, ["B", "A"]);
  assert.deepEqual(next.authority.assuranceWithheldRecommendedTaskIds, []);
  const checked = projectPlanAssuranceCheck(evaluation);
  assert.equal(checked.assurance.coverage, "not_enabled");
  assert.equal(checked.stateCounts.task.not_applicable, 2);
  assert.deepEqual(checked.diagnostics, []);
});

test("conditional and verified tasks pass without changing raw ranking", () => {
  const sealed = withInitialSeals(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
  ], {
    executionRelations: [
      { predecessorTaskId: "A", successorTaskId: "B" },
    ],
  }));
  const evaluation = evaluatePlanAssurance(sealed);
  assert.equal(resultById(evaluation, "A").status, "verified");
  assert.equal(resultById(evaluation, "B").status, "conditional");

  const next = composePlanAssuranceNextAuthority(evaluation, baseAuthority({
    rawRecommendedTaskIds: ["B", "A"],
    temporalStartableRecommendedTaskIds: ["B", "A"],
  }));
  assert.deepEqual(next.authority.rawRecommendedTaskIds, ["B", "A"]);
  assert.deepEqual(next.authority.startableRecommendedTaskIds, ["B", "A"]);
  assert.deepEqual(next.authority.safeStopReasons, []);
});

test("one changed root withholds only its affected closure", () => {
  const sealed = withInitialSeals(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
    task(contract("X", "M0", "MX")),
  ], {
    executionRelations: [
      { predecessorTaskId: "A", successorTaskId: "B" },
    ],
  }));
  const changedInput = {
    ...sealed,
    tasks: sealed.tasks.map((item) => item.contract.taskId === "A"
      ? { ...item, contract: { ...item.contract, title: "A changed" } }
      : item),
  };
  const evaluation = evaluatePlanAssurance(changedInput);
  const next = composePlanAssuranceNextAuthority(
    evaluation,
    baseAuthority({
      rawRecommendedTaskIds: ["B", "X"],
      temporalStartableRecommendedTaskIds: ["B", "X"],
    }),
    ["B"],
  );

  assert.equal(next.authority.complete, true);
  assert.deepEqual(next.authority.rawRecommendedTaskIds, ["B", "X"]);
  assert.deepEqual(next.authority.startableRecommendedTaskIds, ["X"]);
  assert.deepEqual(next.authority.assuranceWithheldRecommendedTaskIds, ["B"]);
  assert.deepEqual(
    next.assurance.activeAttentionRequiredTaskIds,
    ["B"],
  );
  assert.deepEqual(next.assurance.requiredActions, [{
    kind: "replan_and_reseal",
    rootTaskIds: ["A"],
    affectedTaskIds: ["A", "B"],
  }]);
  assert.ok(next.diagnostics.some(({ code }) => code === "PTASSURE-202"));
  assert.ok(next.diagnostics.some(({ code }) => code === "PTASSURE-204"));
  assert.equal(changedInput.tasks[1].lifecycle, "unfinished");
});

test("unsealed coverage requests one atomic initial seal", () => {
  const evaluation = evaluatePlanAssurance(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
  ]));
  const analysis = projectPlanAssuranceAnalysis(evaluation);
  assert.deepEqual(analysis.assurance.requiredActions, [{
    kind: "initial_seal",
    rootTaskIds: [],
    affectedTaskIds: ["A", "B"],
  }]);
  const next = composePlanAssuranceNextAuthority(evaluation, baseAuthority({
    rawRecommendedTaskIds: ["A"],
    temporalStartableRecommendedTaskIds: ["A"],
  }));
  assert.equal(next.authority.complete, true);
  assert.deepEqual(next.authority.startableRecommendedTaskIds, []);
  assert.deepEqual(next.authority.assuranceWithheldRecommendedTaskIds, ["A"]);
  assert.ok(next.diagnostics.some(({ code }) => code === "PTASSURE-201"));
});

test("unknown assurance models fail closed with complete unavailable causes", () => {
  const evaluation = evaluatePlanAssurance(input([
    task(contract("A", "M0", "M1")),
  ], { modelVersion: 9, hashModelVersion: 9 }));
  const next = composePlanAssuranceNextAuthority(evaluation, baseAuthority({
    rawRecommendedTaskIds: ["A"],
    temporalStartableRecommendedTaskIds: ["A"],
  }));

  assert.equal(next.ok, true);
  assert.equal(next.authority.complete, false);
  assert.deepEqual(next.authority.startableRecommendedTaskIds, []);
  assert.deepEqual(next.authority.assuranceUnavailableRecommendedTaskIds, ["A"]);
  assert.deepEqual(next.authority.safeStopReasons, ["unknown_assurance_model"]);
  assert.deepEqual(next.assurance.requiredActions, [{
    kind: "restore_assurance_evidence",
    rootTaskIds: ["A"],
    affectedTaskIds: ["A"],
  }]);
  assert.ok(next.diagnostics.some(({ code }) => code === "PTASSURE-203"));
});

test("unknown or incomplete recommendation authority fails closed as a unit", () => {
  const evaluation = evaluatePlanAssurance(withInitialSeals(input([
    task(contract("A", "M0", "M1")),
  ])));
  const next = composePlanAssuranceNextAuthority(evaluation, baseAuthority({
    rankingAlgorithm: { id: "unknown", version: 2 },
    temporalPolicy: "unknown",
    traceComplete: false,
    diagnosticsTruncated: true,
    rawRecommendedTaskIds: ["A"],
    temporalStartableRecommendedTaskIds: ["A"],
  }));

  assert.equal(next.authority.complete, false);
  assert.deepEqual(next.authority.startableRecommendedTaskIds, []);
  assert.deepEqual(next.authority.assuranceWithheldRecommendedTaskIds, ["A"]);
  assert.deepEqual(next.authority.safeStopReasons, [
    "unknown_ranking_algorithm",
    "unknown_temporal_authority_policy",
    "incomplete_recommendation_trace",
  ]);
});

test("missing or invalid recommended task identities never leak start authority", () => {
  const evaluation = evaluatePlanAssurance(withInitialSeals(input([
    task(contract("A", "M0", "M1")),
  ])));
  const missing = composePlanAssuranceNextAuthority(evaluation, baseAuthority({
    rawRecommendedTaskIds: ["MISSING"],
    temporalStartableRecommendedTaskIds: ["MISSING"],
  }));
  assert.deepEqual(missing.authority.startableRecommendedTaskIds, []);
  assert.deepEqual(
    missing.authority.safeStopReasons,
    ["missing_assurance_task_result"],
  );

  const invalid = composePlanAssuranceNextAuthority(evaluation, baseAuthority({
    rawRecommendedTaskIds: ["A", "A"],
    temporalStartableRecommendedTaskIds: ["A"],
  }));
  assert.deepEqual(invalid.authority.startableRecommendedTaskIds, []);
  assert.deepEqual(
    invalid.authority.safeStopReasons,
    ["invalid_recommendation_authority"],
  );
});

test("mutation impact uses the same cause, action, and active-attention projection", () => {
  const sealed = withInitialSeals(input([
    task(contract("A", "M0", "M1")),
    task(contract("B", "M1", "M2")),
  ], {
    executionRelations: [
      { predecessorTaskId: "A", successorTaskId: "B" },
    ],
  }));
  const before = evaluatePlanAssurance(sealed);
  const after = evaluatePlanAssurance({
    ...sealed,
    tasks: sealed.tasks.map((item) => item.contract.taskId === "A"
      ? { ...item, contract: { ...item.contract, description: "changed" } }
      : item),
  });
  const impact = composePlanAssuranceMutationImpact(
    ["B", "A", "B"],
    before,
    after,
    [],
    ["B"],
  );

  assert.deepEqual(impact.affectedTaskIds, ["A", "B"]);
  assert.deepEqual(impact.after.activeAttentionRequiredTaskIds, ["B"]);
  assert.deepEqual(impact.after.requiredActions[0], {
    kind: "replan_and_reseal",
    rootTaskIds: ["A"],
    affectedTaskIds: ["A", "B"],
  });
  assert.ok(impact.diagnostics.some(({ code }) => code === "PTASSURE-204"));
});

test("Grammar 6 source analysis and Next share the same internal projection", () => {
  const source = [
    "project AUTHORITY_SOURCE:",
    "  version 5",
    '  title "authority source"',
    "  as_of 2026-08-04",
    "  duration_unit point",
    "  velocity 1p/1d",
    "  finish M1",
    "  dag_owner user",
    "",
    "milestone M0:",
    '  title "start"',
    "  state reached",
    "",
    "milestone M1:",
    '  title "finish"',
    "",
    "task A M0 -> M1:",
    '  title "A"',
    "  duration 1p",
    "  status planned",
    "",
  ].join("\n");
  const sealed = planTargetPlanAssuranceMutation(
    source,
    {
      kind: "plan_assurance.seal",
      reason: "Initial authority baseline",
    },
    TARGET_GRAMMAR_6_CAPABILITY,
    { governance: { intent: "preview" } },
  );
  assert.equal(sealed.ok, true);
  const changed = sealed.updatedText.replace('  title "A"', '  title "A changed"');
  const analyzed = analyzeTargetPlanAssuranceDocument(
    changed,
    TARGET_GRAMMAR_6_CAPABILITY,
  );
  assert.equal(analyzed.ok, true);
  assert.equal(analyzed.grammarVersion, 6);
  assert.equal(analyzed.check.assurance.taskResults[0].status, "review_required");
  const next = selectTargetPlanAssuranceAuthority(
    changed,
    TARGET_GRAMMAR_6_CAPABILITY,
    baseAuthority({
      rawRecommendedTaskIds: ["A"],
      temporalStartableRecommendedTaskIds: ["A"],
    }),
  );
  assert.equal(next.ok, true);
  assert.deepEqual(next.next.authority.startableRecommendedTaskIds, []);
  assert.deepEqual(next.next.authority.assuranceWithheldRecommendedTaskIds, ["A"]);
  assert.equal(next.diagnostics.filter(({ code }) => code === "PTASSURE-202").length, 1);
});

test("invalid Grammar 6 source returns no authority projection", () => {
  const selected = selectTargetPlanAssuranceAuthority(
    "not a PERT document\n",
    TARGET_GRAMMAR_6_CAPABILITY,
    baseAuthority({
      rawRecommendedTaskIds: ["A"],
      temporalStartableRecommendedTaskIds: ["A"],
    }),
  );
  assert.equal(selected.ok, false);
  assert.equal(selected.next, null);
  assert.ok(selected.diagnostics.some(({ severity }) => severity === "error"));
});
