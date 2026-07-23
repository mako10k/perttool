import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  analyzePrecedence,
  buildResidualGraph,
  checkDocument,
} from "../dist/index.js";
import {
  buildRecommendationExplanation,
} from "../dist/recommendation/explanation.js";
import {
  validateRecommendationAnalysis,
} from "../dist/recommendation/explanation-validation.js";
import {
  evaluateRecommendationExpression,
  renderRecommendationDescription,
} from "../dist/recommendation/explanation-values.js";
import {
  rankRecommendationCandidates,
} from "../dist/recommendation/ranking.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(testDirectory, "fixtures/recommendation");
const manifestPath = path.join(fixtureDirectory, "cases.json");

function sourceDigest(source) {
  return `sha256:${createHash("sha256").update(source, "utf8").digest("hex")}`;
}

async function inputs(name, appliedCapacities) {
  const source = await readFile(path.join(fixtureDirectory, name), "utf8");
  const checked = checkDocument(source);
  assert.equal(checked.ok, true);
  const graph = buildResidualGraph(checked.document);
  const ranking = rankRecommendationCandidates({
    graph,
    precedence: analyzePrecedence(graph, 100),
    ...(appliedCapacities === undefined ? {} : { appliedCapacities }),
  });
  return { graph, ranking, sourceDigest: sourceDigest(source) };
}

async function explainFixture(name, appliedCapacities) {
  const result = buildRecommendationExplanation(await inputs(name, appliedCapacities));
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.analysis;
}

function explainSource(source) {
  const checked = checkDocument(source);
  assert.equal(checked.ok, true);
  const graph = buildResidualGraph(checked.document);
  const ranking = rankRecommendationCandidates({
    graph,
    precedence: analyzePrecedence(graph, 100),
  });
  const result = buildRecommendationExplanation({
    graph,
    ranking,
    sourceDigest: sourceDigest(source),
  });
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.analysis;
}

function diagnosticCodes(analysis) {
  return validateRecommendationAnalysis(analysis).map(({ code }) => code);
}

test("REC-001 through REC-007 build deterministic, reference-closed explanation graphs", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  for (const entry of manifest.cases.filter(({ fixture }) => fixture !== undefined)) {
    const analysis = await explainFixture(entry.fixture);
    const repeated = await explainFixture(entry.fixture);
    assert.deepEqual(repeated, analysis, `${entry.case_id}:deterministic graph`);
    assert.deepEqual(validateRecommendationAnalysis(analysis), [], `${entry.case_id}:invariants`);
    assert.equal(analysis.reasonTaxonomyVersion, "1.0", entry.case_id);
    assert.equal(analysis.explanationModelVersion, 1, entry.case_id);
    assert.equal(analysis.expressionVersion, 1, entry.case_id);
    assert.equal(analysis.descriptionRegistryVersion, 1, entry.case_id);
    assert.equal(analysis.descriptionLocale, "en", entry.case_id);
    assert.deepEqual(analysis.recommendedTaskIds, entry.expected.recommended_task_ids, entry.case_id);
    assert.equal(analysis.explanationStatus.complete, true, entry.case_id);
    assert.equal(analysis.explanationStatus.decisiveChainComplete, true, entry.case_id);
    assert.equal(analysis.explanationStatus.truncated, false, entry.case_id);
    assert.equal(
      analysis.taskDecisions.length,
      entry.expected.ready_task_ids.length,
      `${entry.case_id}:ready-only decisions`,
    );
    for (const decision of analysis.taskDecisions) {
      assert.equal(decision.tier, entry.expected.tiers[decision.subjectTaskId], entry.case_id);
      assert.ok(decision.stepIds.includes(decision.decisiveStepId), entry.case_id);
      assert.ok(
        analysis.descriptions.some(({ id }) => id === decision.summaryDescriptionId),
        `${entry.case_id}:${decision.subjectTaskId}:summary`,
      );
    }
  }
});

test("REC-008 answers why the critical task ranks above the allowed alternative from typed facts", async () => {
  const analysis = await explainFixture("rec-001-critical-priority.pert");
  const allowed = analysis.taskDecisions.find(
    ({ subjectTaskId }) => subjectTaskId === "OPTIONAL_POLISH",
  );
  assert.equal(allowed.primaryHigherPriorityTaskId, "CRITICAL_FIX");
  const comparison = analysis.comparisons.find(
    ({ id }) => allowed.comparisonIds.includes(id) && id.includes("selection_horizon"),
  );
  assert.deepEqual(
    {
      winner: comparison.winnerTaskId,
      alternative: comparison.alternativeTaskId,
      rule: comparison.decisiveRule.id,
      priorTies: comparison.priorTiedRuleIds,
    },
    {
      winner: "CRITICAL_FIX",
      alternative: "OPTIONAL_POLISH",
      rule: "critical_class",
      priorTies: [],
    },
  );
  const facts = new Map(analysis.facts.map((fact) => [fact.id, fact]));
  assert.equal(evaluateRecommendationExpression(comparison.decisiveExpression, facts), true);
  const decisiveFacts = comparison.factIds
    .map((id) => facts.get(id))
    .filter(({ kind }) => kind === "precedence_critical_class");
  assert.deepEqual(
    decisiveFacts.map(({ subject, value }) => [subject.id, value.value]),
    [
      ["CRITICAL_FIX", "driving"],
      ["OPTIONAL_POLISH", "non_critical"],
    ],
  );
  const description = analysis.descriptions.find(
    ({ key }) => key === "recommendation.reason.ranking_comparison",
  );
  assert.equal(
    description.text,
    "CRITICAL_FIX ranks above OPTIONAL_POLISH by rule critical_class: driving less_than non_critical.",
  );
  assert.equal(
    renderRecommendationDescription(description.key, description.parameters),
    description.text,
  );
});

test("resource explanations preserve selected blockers and all violated witnesses", async () => {
  const analysis = await explainFixture("rec-005-selected-resource-conflict.pert");
  const deferred = analysis.taskDecisions.find(({ subjectTaskId }) => subjectTaskId === "ENV_LOW");
  assert.equal(deferred.tier, "deferred");
  assert.equal(deferred.primaryHigherPriorityTaskId, "ENV_HIGH");
  const comparison = analysis.comparisons.find(
    ({ id }) => deferred.comparisonIds.includes(id) && id.includes("resource_selection"),
  );
  assert.deepEqual(
    {
      subject: comparison.subjectTaskId,
      alternative: comparison.alternativeTaskId,
      winner: comparison.winnerTaskId,
      loser: comparison.loserTaskId,
      rule: comparison.decisiveRule.id,
    },
    {
      subject: "ENV_LOW",
      alternative: "ENV_HIGH",
      winner: "ENV_HIGH",
      loser: "ENV_LOW",
      rule: "joint_resource_feasibility",
    },
  );
  const resourceReasons = deferred.reasonOccurrenceIds
    .map((id) => analysis.reasonOccurrences.find((reason) => reason.id === id))
    .filter(({ code }) => code === "recommended_set_resource_conflict");
  const violatedResources = analysis.facts
    .filter(
      ({ id, kind }) =>
        kind === "resource_capacity_witness" &&
        resourceReasons.some(({ factIds }) => factIds.includes(id)),
    )
    .map(({ subject }) => subject.id);
  assert.deepEqual(violatedResources, ["ENV"]);
  const deficitCondition = resourceReasons[0].emissionExpression.children[1];
  assert.equal(deficitCondition.kind, "compare");
  assert.equal(deficitCondition.left.kind, "fact");
  assert.equal(
    analysis.facts.find(({ id }) => id === deficitCondition.left.factId).kind,
    "resource_deficit",
  );
  assert.match(
    analysis.descriptions.find(({ key }) => key === "recommendation.reason.resource_conflict").text,
    /^ENV_LOW cannot be added on ENV:/,
  );
});

test("active-only rejection keeps the ready-task winner fields non-applicable", async () => {
  const analysis = await explainFixture("rec-006-active-resource-empty.pert");
  const frontier = analysis.taskDecisions.find(
    ({ subjectTaskId }) => subjectTaskId === "FRONTIER_TEST",
  );
  assert.equal(frontier.tier, "deferred");
  assert.equal(frontier.primaryHigherPriorityTaskId, null);
  const comparison = analysis.comparisons.find(
    ({ id }) => frontier.comparisonIds.includes(id) && id.includes("resource_selection"),
  );
  assert.deepEqual(
    {
      subject: comparison.subjectTaskId,
      alternative: comparison.alternativeTaskId,
      winner: comparison.winnerTaskId,
      loser: comparison.loserTaskId,
    },
    {
      subject: "FRONTIER_TEST",
      alternative: null,
      winner: null,
      loser: null,
    },
  );
  const summary = analysis.descriptions.find(({ id }) => id === frontier.summaryDescriptionId);
  assert.match(summary.text, /selected blockers: \[\]; active blockers: \[ACTIVE_TEST\]/);
});

test("horizon-outside active-only conflict does not reuse the ranking winner as a resource winner", () => {
  const source = `project ACTIVE_OUTSIDE:
  version 1
  title "active-only outside"
  duration_unit point
  velocity 1p/1d
  finish FINISH

resource ENV:
  title "environment"
  capacity 1

milestone NOW:
  title "now"
  state reached

milestone ACTIVE_DONE:
  title "active done"

milestone HIGH_DONE:
  title "high done"

milestone OUT_DONE:
  title "outside done"

milestone FINISH:
  title "finish"

task ACTIVE NOW -> ACTIVE_DONE:
  title "active"
  duration 3p
  status active
  requires:
    ENV 1

task HIGH NOW -> HIGH_DONE:
  title "high"
  duration 3p

task OUTSIDE NOW -> OUT_DONE:
  title "outside"
  duration 1p
  requires:
    ENV 1

gate ACTIVE_GATE ACTIVE_DONE -> FINISH:
  reason "active path"

gate HIGH_GATE HIGH_DONE -> FINISH:
  reason "high path"

gate OUT_GATE OUT_DONE -> FINISH:
  reason "outside path"
`;
  const analysis = explainSource(source);
  const outside = analysis.taskDecisions.find(
    ({ subjectTaskId }) => subjectTaskId === "OUTSIDE",
  );
  assert.equal(outside.primaryHigherPriorityTaskId, "HIGH");
  const comparisons = outside.comparisonIds.map((id) =>
    analysis.comparisons.find((comparison) => comparison.id === id),
  );
  const rankingComparison = comparisons.find(
    ({ scope }) => scope === "selection_horizon",
  );
  assert.equal(rankingComparison.winnerTaskId, "HIGH");
  const resourceComparison = comparisons.find(
    ({ scope }) => scope === "resource_selection",
  );
  assert.deepEqual(
    {
      alternative: resourceComparison.alternativeTaskId,
      winner: resourceComparison.winnerTaskId,
      loser: resourceComparison.loserTaskId,
    },
    { alternative: null, winner: null, loser: null },
  );
});

test("resource comparison preserves the scan snapshot while tier reasons cover the final set", () => {
  const source = `project SCAN_SNAPSHOT:
  version 1
  title "scan and final set"
  duration_unit point
  velocity 1p/1d
  finish FINISH

resource R1:
  title "one"
  capacity 1

resource R2:
  title "two"
  capacity 1

milestone NOW:
  title "now"
  state reached

milestone A_DONE:
  title "a"

milestone B_DONE:
  title "b"

milestone C_DONE:
  title "c"

milestone FINISH:
  title "finish"

task A NOW -> A_DONE:
  title "first"
  duration 1p
  priority 3
  requires:
    R1 1

task B NOW -> B_DONE:
  title "rejected"
  duration 1p
  priority 2
  requires:
    R1 1
    R2 1

task C NOW -> C_DONE:
  title "later selected"
  duration 1p
  priority 1
  requires:
    R2 1

gate A_GATE A_DONE -> FINISH:
  reason "a"

gate B_GATE B_DONE -> FINISH:
  reason "b"

gate C_GATE C_DONE -> FINISH:
  reason "c"
`;
  const analysis = explainSource(source);
  assert.deepEqual(analysis.recommendedTaskIds, ["A", "C"]);
  const rejected = analysis.taskDecisions.find(({ subjectTaskId }) => subjectTaskId === "B");
  assert.equal(rejected.primaryHigherPriorityTaskId, "A");
  const resourceComparison = analysis.comparisons.find(
    ({ id }) => rejected.comparisonIds.includes(id) && id.includes("resource_selection"),
  );
  const comparisonResources = resourceComparison.factIds
    .map((id) => analysis.facts.find((fact) => fact.id === id))
    .filter(({ kind }) => kind === "resource_capacity_witness")
    .map(({ subject }) => subject.id);
  assert.deepEqual(comparisonResources, ["R1"]);
  const resourceReasons = rejected.reasonOccurrenceIds
    .map((id) => analysis.reasonOccurrences.find((reason) => reason.id === id))
    .filter(({ code }) => code === "recommended_set_resource_conflict");
  const tierResources = [
    ...new Set(
      resourceReasons.flatMap(({ factIds }) =>
        factIds
          .map((id) => analysis.facts.find((fact) => fact.id === id))
          .filter(({ kind }) => kind === "resource_capacity_witness")
          .map(({ subject }) => subject.id),
      ),
    ),
  ];
  assert.deepEqual(tierResources, ["R1", "R2"]);
});

test("canonical record ordering and exact Rational rendering remain stable", async () => {
  const analysis = await explainFixture("rec-001-critical-priority.pert");
  assert.ok(
    analysis.facts.every(({ id }) => /^rec:fact:[A-Za-z0-9._~:%-]+$/.test(id)),
  );
  const float = analysis.facts.find(
    ({ subject, kind }) =>
      subject.id === "OPTIONAL_POLISH" && kind === "precedence_total_float",
  );
  assert.equal(float.value.type, "rational");
  assert.deepEqual(
    { numerator: float.value.numerator, denominator: float.value.denominator },
    { numerator: "3", denominator: "2" },
  );
  assert.deepEqual(validateRecommendationAnalysis(analysis), []);
});

test("PTREC-301 rejects broken set, expression, and reference invariants", async () => {
  const analysis = await explainFixture("rec-001-critical-priority.pert");

  const tierMismatch = structuredClone(analysis);
  tierMismatch.taskDecisions[0].tier = "allowed";
  assert.ok(diagnosticCodes(tierMismatch).includes("PTREC-301"));

  const falseComparison = structuredClone(analysis);
  const comparison = falseComparison.comparisons[0];
  [comparison.decisiveExpression.left, comparison.decisiveExpression.right] = [
    comparison.decisiveExpression.right,
    comparison.decisiveExpression.left,
  ];
  assert.ok(diagnosticCodes(falseComparison).includes("PTREC-301"));

  const missingReference = structuredClone(analysis);
  missingReference.taskDecisions[0].stepIds[0] = "rec:step:missing";
  assert.ok(diagnosticCodes(missingReference).includes("PTREC-301"));

  const ordering = structuredClone(
    await explainFixture("rec-006-active-resource-empty.pert"),
  );
  ordering.comparisons.reverse();
  assert.ok(
    validateRecommendationAnalysis(ordering).some(
      ({ code, message }) => code === "PTREC-301" && message.includes("canonical order"),
    ),
  );
});

test("PTREC-302 rejects unregistered versions, rules, facts, and expression nodes", async () => {
  const analysis = await explainFixture("rec-001-critical-priority.pert");

  const version = structuredClone(analysis);
  version.expressionVersion = 2;
  assert.ok(diagnosticCodes(version).includes("PTREC-302"));

  const rule = structuredClone(analysis);
  rule.decisionSteps[0].rule.id = "opaque_rule";
  assert.ok(diagnosticCodes(rule).includes("PTREC-302"));

  const fact = structuredClone(analysis);
  fact.facts[0].kind = "opaque_fact";
  assert.ok(diagnosticCodes(fact).includes("PTREC-302"));

  const expression = structuredClone(analysis);
  expression.decisionSteps[0].expression = { kind: "script", source: "true" };
  assert.ok(diagnosticCodes(expression).includes("PTREC-302"));
});

test("PTREC-303 rejects description key, parameter, and canonical text mismatches", async () => {
  const analysis = await explainFixture("rec-001-critical-priority.pert");

  const key = structuredClone(analysis);
  key.descriptions[0].key = "recommendation.summary.opaque";
  assert.ok(diagnosticCodes(key).includes("PTREC-303"));

  const parameter = structuredClone(analysis);
  parameter.descriptions[0].parameters = parameter.descriptions[0].parameters.slice(1);
  assert.ok(diagnosticCodes(parameter).includes("PTREC-303"));

  const text = structuredClone(analysis);
  text.descriptions[0].text = "hand-written explanation";
  assert.ok(diagnosticCodes(text).includes("PTREC-303"));

  const sourceMismatch = structuredClone(analysis);
  const comparisonDescription = sourceMismatch.descriptions.find(
    ({ key: descriptionKey }) =>
      descriptionKey === "recommendation.reason.ranking_comparison",
  );
  comparisonDescription.parameters.find(
    ({ name }) => name === "winner_task_id",
  ).value.value.id = "OPTIONAL_POLISH";
  comparisonDescription.text = renderRecommendationDescription(
    comparisonDescription.key,
    comparisonDescription.parameters,
  );
  assert.ok(
    validateRecommendationAnalysis(sourceMismatch).some(
      ({ code, message }) => code === "PTREC-303" && message.includes("source comparison"),
    ),
  );
});

test("builder fails closed without returning a partial explanation", async () => {
  const input = await inputs("rec-007-no-ready.pert");
  const ranking = structuredClone(input.ranking);
  ranking.jointFeasibility.feasible = false;
  const result = buildRecommendationExplanation({ ...input, ranking });
  assert.equal(result.ok, false);
  assert.equal(result.analysis, null);
  assert.ok(result.diagnostics.some(({ code }) => code === "PTREC-301"));
});
