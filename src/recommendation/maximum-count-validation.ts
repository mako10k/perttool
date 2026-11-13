// R: Verify model-2 identity, exact optimum, source commitments and complete explanation references.
import type { Diagnostic } from "../model/diagnostics.js";
import { rfc8785Json } from "../model/rfc8785.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { evaluateRecommendationExpression } from "./explanation-values.js";
import { validateValue as validateRecommendationValue, validateScalar as validateRecommendationScalar } from "./explanation-validation.js";
import { dispatchDescriptionRegistry, renderDispatchDescription } from "./maximum-count-descriptions.js";
import { compareStableStrings } from "../model/diagnostics.js";
import { dispatchModelToJson } from "./maximum-count-json.js";
import { selectMaximumCountTasks } from "./maximum-count.js";
import type { RecommendationAnalysisV2 } from "./maximum-count-contract.js";

const registeredReasonCodes = new Set(dispatchDescriptionRegistry.filter((entry) => entry.key.startsWith("recommendation.reason.")).map((entry) => entry.key.replace("recommendation.reason.", "")));
const registeredPhases = new Set(["eligibility", "candidate_ranking", "set_optimization", "resource_selection",
  "boundary_budget", "set_membership", "tier_classification"]);
const registeredFactKinds = new Set([
  "expected_duration", "explicit_priority", "finish_task_distance", "new_reached_milestone_count", "new_ready_task_count",
  "new_satisfied_gate_count", "next_gate_task_distance", "precedence_critical_class", "precedence_total_float", "task_id",
  "task_classification", "time_eligibility", "assurance_eligibility", "selection_input_digest", "maximum_task_count",
  "eligible_task_count", "rank_group_counts", "canonical_selected_ids", "joint_resource_feasibility", "selected_set_member",
  "resource_requirement", "resource_remaining", "boundary_allocatable_units", "resource_capacity", "active_resource_usage",
  "selected_resource_usage", "outside_group_usage",
]);

function checkInputSnapshot(analysis: RecommendationAnalysisV2): void {
  const input = analysis.selection.input;
  const rationalValues = [input.criticalEpsilon, ...input.rankGroups.flatMap((group) =>
    [group.rankKey.precedenceTotalFloat, group.rankKey.expectedDuration])];
  if (rationalValues.some((value) => validateRecommendationScalar({ type: "rational", ...value }) !== null)) {
    throw new Error("selection ranking rational is not canonical");
  }
  const lists = [input.resources.map((item) => item.resourceId), input.activeTasks.map((item) => item.taskId),
    input.capacityOverrides.map((item) => item.resourceId), ...input.rankGroups.map((group) => group.taskIds),
    ...[...input.activeTasks, ...input.candidates].map((task) => task.requirements.map((item) => item.resourceId))];
  if (lists.some((ids) => JSON.stringify(ids) !== JSON.stringify([...new Set(ids)].sort(compareStableStrings)))) {
    throw new Error("selection input ordering is not canonical");
  }
  for (const resource of input.resources) {
    const occupants = input.activeTasks.filter((task) => task.requirements.some((item) => item.resourceId === resource.resourceId));
    const usage = occupants.reduce((sum, task) => sum + task.requirements.find((item) => item.resourceId === resource.resourceId)!.units, 0);
    if (usage !== resource.activeUsage || JSON.stringify(occupants.map((task) => task.taskId)) !== JSON.stringify(resource.activeTaskIds)) {
      throw new Error("selection active-resource snapshot differs");
    }
  }
  const statesKnown = input.candidates.every((candidate) =>
    ["eligible", "not_yet_eligible", "unavailable"].includes(candidate.timeEligibility) &&
    ["eligible", "withheld", "unavailable"].includes(candidate.assuranceEligibility));
  if (!statesKnown) throw new Error("selection eligibility state is not registered");
}

function registeredRecords(analysis: RecommendationAnalysisV2): boolean {
  return [analysis.reasonOccurrences.every((reason) => registeredReasonCodes.has(reason.code)),
    analysis.decisionSteps.every((step) => registeredPhases.has(step.phase)),
    analysis.facts.every((fact) => registeredFactKinds.has(fact.kind)),
    analysis.comparisons.every((comparison) => comparison.scope === "candidate_ranking")].every(Boolean);
}

function checkSelection(analysis: RecommendationAnalysisV2): void {
  const selection = analysis.selection;
  const input = selection.input;
  if (input.sourceDigest !== analysis.sourceDigest ||
    selection.inputDigest !== sha256DigestUtf8(rfc8785Json(dispatchModelToJson(input))) ||
    analysis.resultDecision.id !== `rec:decision:result:R:${selection.inputDigest}`) throw new Error("selection commitment differs");
  const selected = selectMaximumCountTasks({ sourceDigest: input.sourceDigest,
    activeTasks: input.activeTasks, capacities: input.resources.map((resource) => ({ resourceId: resource.resourceId, units: resource.capacity })),
    candidates: input.candidates.map((candidate) => ({ ...candidate,
      eligibility: candidate.timeEligibility !== "eligible" ? "time_withheld"
        : candidate.assuranceEligibility !== "eligible" ? "assurance_withheld" : "eligible",
    })),
  });
  const expected = { selectedTaskIds: selected.selectedTaskIds, maximumTaskCount: selected.maximumTaskCount,
    resources: selected.resources, boundaryGroups: selected.boundaryGroups.map((group) => ({ ...group,
      outsideSelectedTaskIds: selected.selectedTaskIds.filter((id) => !group.selectedTaskIds.includes(id)),
    })) };
  const actual = { selectedTaskIds: selection.selectedTaskIds, maximumTaskCount: selection.maximumTaskCount,
    resources: selection.resources, boundaryGroups: selection.boundaryGroups };
  if (rfc8785Json(actual) !== rfc8785Json(expected)) throw new Error("selection differs from the exact optimum");
  const same = (a: readonly string[], b: readonly string[]) => JSON.stringify(a) === JSON.stringify(b);
  if (!same(analysis.recommendedTaskIds, selected.selectedTaskIds) ||
    !same(analysis.resultDecision.recommendedTaskIds, selected.selectedTaskIds)) throw new Error("recommended sets differ");
  const candidates = new Map(input.candidates.map((candidate) => [candidate.taskId, candidate]));
  const groupIds = input.rankGroups.flatMap((group, index) => {
    if (group.rankGroup !== index) throw new Error("rank group sequence differs");
    for (const id of group.taskIds) if (candidates.get(id)?.rankGroup !== index) throw new Error("rank group member differs");
    return group.taskIds;
  });
  if (!same(groupIds, input.candidates.map((candidate) => candidate.taskId))) throw new Error("rank group coverage differs");
  if (!same(analysis.taskDecisions.map((task) => task.subjectTaskId), [...candidates.keys()])) throw new Error("task decision coverage differs");
  for (const task of analysis.taskDecisions) {
    const chosen = selected.selectedTaskIds.includes(task.subjectTaskId);
    if (task.recommendedSetMember !== chosen || task.tier !== (chosen ? "recommended" : "deferred")) throw new Error("task tier differs");
  }
}

function evidenceMaps(analysis: RecommendationAnalysisV2) {
  return {
    facts: new Map(analysis.facts.map((fact) => [fact.id, fact])),
    steps: new Map(analysis.decisionSteps.map((step) => [step.id, step])),
    reasons: new Map(analysis.reasonOccurrences.map((reason) => [reason.id, reason])),
    descriptions: new Map(analysis.descriptions.map((description) => [description.id, description])),
    comparisons: new Map(analysis.comparisons.map((comparison) => [comparison.id, comparison])),
  };
}
type EvidenceMaps = ReturnType<typeof evidenceMaps>;

function checkFactsAndIds(analysis: RecommendationAnalysisV2): void {
  const collections = [analysis.facts, analysis.decisionSteps, analysis.comparisons,
    analysis.reasonOccurrences, analysis.descriptions, analysis.taskDecisions];
  const ids = collections.flatMap((records) => records.map((record) => record.id)).concat(analysis.resultDecision.id);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate dispatch record ID");
  for (const fact of analysis.facts) {
    if (fact.provenance.sourceDigest !== analysis.sourceDigest || validateRecommendationValue(fact.value) !== null) throw new Error("fact source or typed value differs");
  }
}

function checkStepsAndComparisons(analysis: RecommendationAnalysisV2, maps: EvidenceMaps): void {
  const visited = new Set<string>();
  for (const step of analysis.decisionSteps) {
    if (step.dependsOnStepIds.some((id) => !visited.has(id)) || step.inputFactIds.some((id) => !maps.facts.has(id)) ||
      step.reasonOccurrenceIds.some((id) => maps.reasons.get(id)?.decisionStepId !== step.id)) throw new Error("step references differ");
    if (evaluateRecommendationExpression(step.expression, maps.facts) !== step.result) throw new Error("step expression differs");
    visited.add(step.id);
  }
  for (const comparison of analysis.comparisons) {
    if (comparison.factIds.some((id) => !maps.facts.has(id)) ||
      !evaluateRecommendationExpression(comparison.decisiveExpression, maps.facts)) throw new Error("comparison evidence differs");
  }
}

function checkReasonsAndTasks(analysis: RecommendationAnalysisV2, maps: EvidenceMaps): void {
  for (const reason of analysis.reasonOccurrences) {
    const valid = [maps.steps.has(reason.decisionStepId), maps.descriptions.has(reason.descriptionId ?? ""),
      reason.factIds.every((id) => maps.facts.has(id)), evaluateRecommendationExpression(reason.emissionExpression, maps.facts)];
    if (!valid.every(Boolean)) throw new Error("reason evidence differs");
  }
  for (const task of analysis.taskDecisions) {
    const valid = [maps.steps.get(task.decisiveStepId)?.role === "decisive",
      task.stepIds.every((id) => maps.steps.has(id)), task.reasonOccurrenceIds.every((id) => maps.reasons.has(id)),
      task.descriptionIds.every((id) => maps.descriptions.has(id)), task.comparisonIds.every((id) => maps.comparisons.has(id))];
    if (!valid.every(Boolean)) throw new Error("task evidence differs");
  }
}

function checkResultEvidence(analysis: RecommendationAnalysisV2, maps: EvidenceMaps): void {
  const valid = [maps.facts.has(analysis.resultDecision.jointFeasibilityFactId),
    analysis.resultDecision.stepIds.every((id) => maps.steps.has(id)),
    analysis.resultDecision.reasonOccurrenceIds.every((id) => maps.reasons.has(id)),
    analysis.explanationStatus.complete, analysis.explanationStatus.decisiveChainComplete,
    !analysis.explanationStatus.truncated, analysis.explanationStatus.level === "full",
    Object.values(analysis.explanationStatus.omittedCounts).every((count) => count === 0)];
  if (!valid.every(Boolean)) throw new Error("result evidence is incomplete");
}

function registeredIdentity(analysis: RecommendationAnalysisV2): boolean {
  return [analysis.algorithm.id === "perttool.dispatch.maximum-count", analysis.algorithm.version === 1,
    analysis.algorithm.optimal === true, analysis.algorithm.optimalityScope === "task_count",
    analysis.reasonTaxonomyVersion === "2.0", analysis.explanationModelVersion === 2,
    analysis.expressionVersion === 1, analysis.descriptionRegistryVersion === 2, analysis.descriptionLocale === "en", analysis.selection.modelVersion === 1, analysis.selection.input.modelVersion === 1].every(Boolean);
}

export function validateMaximumCountAnalysis(analysis: RecommendationAnalysisV2): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const report = (code: string, message: string) => diagnostics.push({ code, severity: "error", message, helpTopic: "next" });
  if (!registeredIdentity(analysis) || !registeredRecords(analysis)) report("PTREC-302", "dispatch model identity is not registered");
  try {
    checkInputSnapshot(analysis);
    checkSelection(analysis);
    checkFactsAndIds(analysis);
    const maps = evidenceMaps(analysis);
    checkStepsAndComparisons(analysis, maps);
    checkReasonsAndTasks(analysis, maps);
    checkResultEvidence(analysis, maps);
  } catch (error) {
    report("PTREC-301", error instanceof Error ? error.message : "dispatch evidence is inconsistent");
  }
  for (const description of analysis.descriptions) {
    try {
      if (description.registryVersion !== 2 || description.locale !== "en" ||
        renderDispatchDescription(description.key, description.parameters) !== description.text) throw new Error("description rendering differs");
    } catch (error) {
      report("PTREC-303", error instanceof Error ? error.message : "dispatch description is inconsistent");
    }
  }
  return Object.freeze(diagnostics);
}
