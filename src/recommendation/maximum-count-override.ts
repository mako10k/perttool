// R: Validate a model-2 override against the exact input-bound normal result and resource snapshot.
import { sha256DigestUtf8 } from "../model/sha256.js";
import { buildResidualGraph } from "../analysis/graph.js";
import { analyzePrecedence } from "../analysis/precedence.js";
import type { DocumentNode } from "../model/syntax.js";
import { buildMaximumCountEvidence } from "./maximum-count-input.js";
import { rfc8785Json } from "../model/rfc8785.js";
import { TOOL_VERSION } from "../version.js";
import { evaluateSelectedSet, validHumanFields } from "./override.js";
import { dispatchModelToJson } from "./maximum-count-json.js";
import { validateMaximumCountAnalysis } from "./maximum-count-validation.js";
import type { OverrideDecisionV2, OverrideRequestV2, OverrideSourceV2, OverrideValidationResultV2 } from "./maximum-count-override-types.js";

function sourceError(source: OverrideSourceV2): string | null {
  try {
    const recommendation = source.recommendation;
    const authority = source.temporal?.authority;
    if (recommendation === null || authority === undefined) return "source selection and authority evidence is missing";
    const valid = [source.ok, !source.diagnosticsTruncated, authority.complete, authority.safeStopReasons.length === 0,
      source.schemaVersion === "Perttool.NextResult.v10",
      authority.policy === "max_count_dispatch_v1_plus_release_gate_plus_plan_assurance_v1",
      authority.recommendationAlgorithm.id === recommendation.algorithm.id, authority.recommendationAlgorithm.version === 1,
      validateMaximumCountAnalysis(recommendation).length === 0];
    if (!valid.every(Boolean)) return "source NextResult must contain complete model-2 selection and authority evidence";
    const same = (a: readonly string[], b: readonly string[]) => JSON.stringify(a) === JSON.stringify(b);
    const input = recommendation.selection.input;
    const sameStartSets = [same(source.groups.runnableNow, recommendation.recommendedTaskIds),
      same(authority.startableRecommendedTaskIds, recommendation.recommendedTaskIds)].every(Boolean);
    if (!sameStartSets) return "source start sets differ";
    const ready = source.tasks.filter((task) => task.classification === "ready").map((task) => task.id).sort();
    if (!same([...source.groups.ready].sort(), ready) || !same(input.candidates.map((task) => task.taskId).sort(), ready)) return "source ready frontier differs";
    const time = new Map(source.temporal!.tasks.map((task) => [task.taskId, task.timeEligibility.state]));
    for (const candidate of input.candidates) {
      const task = source.tasks.find((item) => item.id === candidate.taskId)!;
      if (time.get(candidate.taskId) !== candidate.timeEligibility ||
        (candidate.assuranceEligibility === "eligible") !== authority.assuranceEligibleTaskIds.includes(candidate.taskId) ||
        rfc8785Json(task.requirements.map(({ resourceId, units }) => ({ resourceId, units }))
          .sort((a, b) => a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0)) !== rfc8785Json(candidate.requirements)) {
        return "source candidate requirements or eligibility differ";
      }
    }
    const capacities = [...source.capacityOverrides].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([resourceId, capacity]) => ({ resourceId, capacity }));
    if (rfc8785Json(capacities) !== rfc8785Json(input.capacityOverrides)) return "source capacity overrides differ";
    if (!selectionMatchesSource(source)) return "source selection input differs from its document or active allocation";
    const resources = evaluateSelectedSet(source, recommendation.recommendedTaskIds);
    if (!resources.feasible) return "source normal selection is infeasible";
    return null;
  } catch {
    return "source model-2 evidence is malformed";
  }
}

function selectionMatchesSource(source: OverrideSourceV2): boolean {
  const selection = source.recommendation!.selection;
  const input = selection.input;
  const graph = buildResidualGraph(source.document as unknown as DocumentNode);
  const eligibility = new Map(input.candidates.map((candidate) => [candidate.taskId,
    { timeEligibility: candidate.timeEligibility, assuranceEligibility: candidate.assuranceEligibility }]));
  const expected = buildMaximumCountEvidence({ graph, precedence: analyzePrecedence(graph, 100),
    appliedCapacities: source.capacityOverrides }, source.recommendation!.sourceDigest, source.grammarVersion!, eligibility);
  if (rfc8785Json(expected) !== rfc8785Json(selection)) return false;
  const activeIds = source.tasks.filter((task) => task.classification === "active").map((task) => task.id).sort();
  if (JSON.stringify(activeIds) !== JSON.stringify(input.activeTasks.map((task) => task.taskId))) return false;
  for (const active of input.activeTasks) {
    const task = source.tasks.find((item) => item.id === active.taskId)!;
    const requirements = task.requirements.map(({ resourceId, units }) => ({ resourceId, units }))
      .sort((a, b) => a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0);
    if (rfc8785Json(requirements) !== rfc8785Json(active.requirements)) return false;
  }
  const eligible = input.candidates.filter((candidate) => candidate.timeEligibility === "eligible" && candidate.assuranceEligibility === "eligible")
    .map((candidate) => candidate.taskId).sort();
  return JSON.stringify(eligible) === JSON.stringify([...source.temporal!.authority.eligibleTaskIds].sort());
}

function validSelectedIds(source: OverrideSourceV2, ids: readonly string[]): boolean {
  return Array.isArray(ids) && ids.length > 0 && new Set(ids).size === ids.length &&
    ids.every((id) => source.temporal!.authority.eligibleTaskIds.includes(id));
}

export function validateMaximumCountOverride(source: OverrideSourceV2, request: OverrideRequestV2): OverrideValidationResultV2 {
  const failure = (code: string, message: string): OverrideValidationResultV2 => ({
    schemaVersion: "Perttool.OverrideDecision.v2", toolVersion: TOOL_VERSION, operation: "recommendation.override.validate",
    ok: false, diagnostics: [{ code, severity: "error", message }], diagnosticsTruncated: false, override: null,
  });
  const error = sourceError(source);
  if (error !== null || request.sourceSchemaVersion !== "Perttool.NextResult.v10") return failure("PTOVR-101", error ?? "override source identity differs");
  const recommendation = source.recommendation!;
  if (request.sourceDigest !== recommendation.sourceDigest || request.sourceResultDecisionId !== recommendation.resultDecision.id) {
    return failure("PTOVR-102", "override request does not match the source digest and selection decision");
  }
  if (!validSelectedIds(source, request.selectedTaskIds)) {
    return failure("PTOVR-103", "selected task must be a unique eligible ready task");
  }
  const selectedSet = new Set(request.selectedTaskIds);
  const selectedTaskIds = recommendation.taskDecisions.map((task) => task.subjectTaskId).filter((id) => selectedSet.has(id));
  const feasibility = evaluateSelectedSet(source, selectedTaskIds);
  if (!feasibility.feasible || feasibility.result === null) return failure("PTOVR-104", "selected task set exceeds applied capacity with active allocation");
  const normal = new Set(recommendation.recommendedTaskIds);
  const nonrecommended = selectedTaskIds.filter((id) => !normal.has(id));
  if (nonrecommended.length === 0) return failure("PTOVR-106", "selected task set is within normal recommendation authority");
  const human = validHumanFields(request);
  if (human === null || !Array.isArray(request.acknowledgedNegativeFactReasonIds) || request.acknowledgedNegativeFactReasonIds.length > 0) {
    return failure("PTOVR-105", "actor, decision time, reason, evidence or acknowledgements are invalid");
  }
  const payload: Omit<OverrideDecisionV2, "overrideId"> = {
    overrideContractVersion: 2,
    source: { schemaVersion: "Perttool.NextResult.v10", toolVersion: TOOL_VERSION, sourceDigest: recommendation.sourceDigest,
      recommendationInterfaceVersion: 2, selectionAlgorithm: { id: "perttool.dispatch.maximum-count", version: 1 },
      reasonTaxonomyVersion: "2.0", explanationModelVersion: 2, expressionVersion: 1, descriptionRegistryVersion: 2,
      resultDecisionId: recommendation.resultDecision.id, selectionInputDigest: recommendation.selection.inputDigest,
      recommendedTaskIds: recommendation.recommendedTaskIds, capacityOverrides: recommendation.selection.input.capacityOverrides,
    }, actor: { kind: "human", id: request.actor.id, authentication: "caller_asserted" }, decidedAt: request.decidedAt,
    reason: { code: request.reasonCode, text: request.reasonText, evidenceReferences: human.evidence },
    selection: { selectedTaskIds, retainedRecommendedTaskIds: recommendation.recommendedTaskIds.filter((id) => selectedSet.has(id)),
      displacedRecommendedTaskIds: recommendation.recommendedTaskIds.filter((id) => !selectedSet.has(id)),
      selectedNonrecommendedTaskIds: nonrecommended, triggerCodes: ["deferred_selected"],
    }, taskDecisions: selectedTaskIds.map((id) => {
      const task = recommendation.taskDecisions.find((item) => item.subjectTaskId === id)!;
      return { taskId: id, normalDecisionId: task.id, normalTier: task.tier, normalDecisiveStepId: task.decisiveStepId,
        normalReasonOccurrenceIds: task.reasonOccurrenceIds, normalComparisonIds: task.comparisonIds, overrideSelected: true,
        triggerCodes: task.tier === "deferred" ? ["deferred_selected"] : [], acknowledgedNegativeFactReasonIds: [],
      };
    }), feasibility: feasibility.result, singleUse: true,
  };
  return { schemaVersion: "Perttool.OverrideDecision.v2", toolVersion: TOOL_VERSION, operation: "recommendation.override.validate",
    ok: true, diagnostics: [], diagnosticsTruncated: false,
    override: { ...payload, overrideId: `override:${sha256DigestUtf8(rfc8785Json(dispatchModelToJson(payload)))}` },
  };
}
