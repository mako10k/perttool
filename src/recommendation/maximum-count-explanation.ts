// R: Explain the exact selected set, eligibility exclusions and each overflowing tied resource group.
import type { RecommendationAnalysis as RecommendationAnalysisV1, RecommendationValue } from "./explanation-types.js";
import type { RecommendationCandidateFacts } from "./types.js";
import type { DispatchSelectionEvidence, DispatchTaskDecision, RecommendationAnalysisV2 } from "./maximum-count-contract.js";
import { buildDispatchComparisons, dispatchRankFactKinds } from "./maximum-count-comparisons.js";
import { createDispatchRecords, dispatchEntity, dispatchEnum, dispatchInteger, dispatchTaskList,
  type DispatchRecords } from "./maximum-count-records.js";

function eligibilitySteps(records: DispatchRecords, candidate: DispatchSelectionEvidence["input"]["candidates"][number]) {
  const owner = dispatchEntity("task", candidate.taskId);
  const parameters = { task_id: { type: "entity" as const, value: owner } };
  const timeCode = { eligible: "time_eligible", not_yet_eligible: "time_ineligible", unavailable: "time_eligibility_unavailable" } as const;
  const assuranceCode = { eligible: "assurance_eligible", withheld: "assurance_withheld", unavailable: "assurance_unavailable" } as const;
  const time = dispatchEnum("time_eligibility", candidate.timeEligibility);
  const assurance = dispatchEnum("assurance_eligibility", candidate.assuranceEligibility);
  return [
    records.step(owner, "task_ready", "eligibility",
      { factId: records.fact(owner, "task_classification", dispatchEnum("task_classification", "ready")),
        expected: dispatchEnum("task_classification", "ready") }, parameters),
    records.step(owner, timeCode[candidate.timeEligibility], "eligibility",
      { factId: records.fact(owner, "time_eligibility", time), expected: time }, parameters),
    records.step(owner, assuranceCode[candidate.assuranceEligibility], "eligibility",
      { factId: records.fact(owner, "assurance_eligibility", assurance), expected: assurance }, parameters),
  ];
}

function resourceConflicts(records: DispatchRecords, selection: DispatchSelectionEvidence,
  candidate: DispatchSelectionEvidence["input"]["candidates"][number], dependency: string) {
  const owner = dispatchEntity("task", candidate.taskId);
  return candidate.requirements.flatMap((requirement) => {
    const resource = selection.resources.find((item) => item.resourceId === requirement.resourceId)!;
    if (requirement.units <= resource.remainingUnits) return [];
    const reference = dispatchEntity("resource", resource.resourceId);
    const unit = { kind: "resource" as const, resource: reference };
    const required = records.fact(owner, "resource_requirement", dispatchInteger(requirement.units), unit, [reference]);
    const remaining = records.fact(owner, "resource_remaining", dispatchInteger(resource.remainingUnits), unit, [reference]);
    return [records.step(owner, "recommended_set_resource_conflict", "resource_selection",
      { factId: required, expected: dispatchInteger(requirement.units) }, {
        task_id: { type: "entity", value: owner }, resource_id: { type: "entity", value: reference },
        required_units: dispatchInteger(requirement.units), remaining_units: dispatchInteger(resource.remainingUnits),
      }, { dependsOnStepIds: [dependency], extraFacts: [remaining], expression: { kind: "compare", left: { kind: "fact", factId: required },
        relation: "greater_than", right: { kind: "fact", factId: remaining } } })];
  });
}

export function buildMaximumCountExplanation(selection: DispatchSelectionEvidence,
  candidates: readonly RecommendationCandidateFacts[], legacy: RecommendationAnalysisV1): RecommendationAnalysisV2 {
  const records = createDispatchRecords(legacy.sourceDigest, legacy.facts.filter((fact) => dispatchRankFactKinds.has(fact.kind)));
  const comparisons = buildDispatchComparisons(candidates, records.facts);
  const selected = new Set(selection.selectedTaskIds);
  const context = new Map(selection.input.candidates.map((candidate) => [candidate.taskId, eligibilitySteps(records, candidate)]));
  const owner = dispatchEntity("derived_set", "R");
  const commitment = records.fact(owner, "selection_input_digest", dispatchEnum("sha256_digest", selection.inputDigest));
  const maximum = dispatchInteger(selection.maximumTaskCount);
  const count = records.step(owner, "maximum_task_count", "set_optimization",
    { factId: records.fact(owner, "maximum_task_count", maximum), expected: maximum },
    { selected_count: maximum, eligible_count: dispatchInteger(selection.input.candidates.filter((candidate) =>
      candidate.timeEligibility === "eligible" && candidate.assuranceEligibility === "eligible").length) },
    { dependsOnStepIds: [...context.values()].flat().map((step) => step.id), extraFacts: [commitment] });
  const counts: RecommendationValue = { type: "list", itemType: "integer", items: selection.input.rankGroups.map((group) =>
    ({ type: "integer", value: String(group.taskIds.filter((id) => selected.has(id)).length) })) };
  const rank = records.step(owner, "rank_group_counts", "set_optimization",
    { factId: records.fact(owner, "rank_group_counts", counts), expected: counts }, { counts }, { dependsOnStepIds: [count.id] });
  const taskIds = dispatchTaskList(selection.selectedTaskIds);
  const canonical = records.step(owner, "task_id_tiebreak", "set_optimization",
    { factId: records.fact(owner, "canonical_selected_ids", taskIds), expected: taskIds }, { task_ids: taskIds }, { dependsOnStepIds: [rank.id] });
  const feasibleFact = records.fact(owner, "joint_resource_feasibility", { type: "boolean", value: true });
  const feasible = records.step(owner, "recommended_set_feasible", "resource_selection",
    { factId: feasibleFact, expected: { type: "boolean", value: true } }, {}, { dependsOnStepIds: [canonical.id] });
  const resultSteps = [count, rank, canonical, feasible];
  const taskDecisions = selection.input.candidates.map((candidate): DispatchTaskDecision => {
    const subject = dispatchEntity("task", candidate.taskId);
    const chosen = selected.has(candidate.taskId);
    const steps = [...context.get(candidate.taskId)!];
    const member = records.step(subject, chosen ? "recommended_set_selected" : "recommended_set_not_selected", "set_membership",
      { factId: records.fact(subject, "selected_set_member", { type: "boolean", value: chosen }),
        expected: { type: "boolean", value: chosen } },
      { task_id: { type: "entity", value: subject } }, { dependsOnStepIds: [feasible.id] });
    steps.push(member);
    const eligible = candidate.timeEligibility === "eligible" && candidate.assuranceEligibility === "eligible";
    if (!chosen && eligible) steps.push(...resourceConflicts(records, selection, candidate, feasible.id));
    const decisive = steps.findLast((step) => step.role === "decisive");
    if (decisive === undefined) throw new Error(`dispatch decision has no decisive evidence for ${candidate.taskId}`);
    const reason = records.reasonOccurrences.find((item) => item.decisionStepId === decisive.id)!;
    const parameters: Record<string, RecommendationValue> = { task_id: { type: "entity", value: subject } };
    if (!chosen) parameters["reason_code"] = dispatchEnum("reason_code", reason.code);
    const summary = records.describe(subject, `recommendation.summary.${chosen ? "recommended" : "deferred"}`,
      parameters, steps.map((step) => step.reasonId));
    return Object.freeze({ id: `rec:decision:task:${candidate.taskId}`, subjectTaskId: candidate.taskId,
      action: "start", classification: "ready", tier: chosen ? "recommended" : "deferred", recommendedSetMember: chosen,
      stepIds: Object.freeze(steps.map((step) => step.id)), decisiveStepId: decisive.id,
      reasonOccurrenceIds: Object.freeze(steps.map((step) => step.reasonId)),
      comparisonIds: Object.freeze(comparisons.filter((item) => item.subjectTaskId === candidate.taskId || item.alternativeTaskId === candidate.taskId)
        .map((item) => item.id)), summaryDescriptionId: summary,
      descriptionIds: Object.freeze([...steps.map((step) => step.descriptionId), summary]),
    });
  });
  for (const group of selection.boundaryGroups) {
    for (const resource of group.resources) {
      const subject = dispatchEntity("resource", resource.resourceId);
      const units = dispatchInteger(resource.allocatableUnits);
      const fact = records.fact(subject, "boundary_allocatable_units", units, { kind: "resource", resource: subject },
        [dispatchEntity("derived_set", `rank_group/${group.rankGroup}`)]);
      resultSteps.push(records.step(subject, "boundary_group_capacity", "boundary_budget", { factId: fact, expected: units }, {
        rank_group: dispatchInteger(group.rankGroup), resource_id: { type: "entity", value: subject },
        allocatable_units: units, selected_usage: dispatchInteger(resource.selectedUsage), remaining_units: dispatchInteger(resource.remainingUnits),
      }, { dependsOnStepIds: [feasible.id] }));
    }
  }
  return Object.freeze({ action: "start", algorithm: Object.freeze({ id: "perttool.dispatch.maximum-count", version: 1,
    optimal: true, optimalityScope: "task_count" }), reasonTaxonomyVersion: "2.0", explanationModelVersion: 2,
    expressionVersion: 1, descriptionRegistryVersion: 2, descriptionLocale: "en", sourceDigest: legacy.sourceDigest,
    recommendedTaskIds: selection.selectedTaskIds,
    resultDecision: Object.freeze({ id: `rec:decision:result:R:${selection.inputDigest}`, action: "start",
      recommendedTaskIds: selection.selectedTaskIds, jointFeasibilityFactId: feasibleFact,
      stepIds: Object.freeze(resultSteps.map((step) => step.id)), reasonOccurrenceIds: Object.freeze(resultSteps.map((step) => step.reasonId)),
    }), taskDecisions: Object.freeze(taskDecisions), decisionSteps: Object.freeze(records.decisionSteps), facts: Object.freeze(records.facts),
    comparisons, reasonOccurrences: Object.freeze(records.reasonOccurrences), descriptions: Object.freeze(records.descriptions),
    explanationStatus: legacy.explanationStatus, selection,
  });
}
