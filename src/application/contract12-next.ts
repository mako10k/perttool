// R: Compose count-first selection after source, temporal and assurance evaluation for all supported grammars.
import { validateDispatchCapacityOverrides } from "../analysis/service.js";
import { limitDiagnostics, normalizeMaxDiagnostics, sortDiagnostics } from "../model/diagnostics.js";
import { buildResidualGraph } from "../analysis/graph.js";
import { analyzePrecedence } from "../analysis/precedence.js";
import type { DocumentNode } from "../model/syntax.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { rankRecommendationCandidates } from "../recommendation/ranking.js";
import { buildMaximumCountEvidence } from "../recommendation/maximum-count-input.js";
import { validateMaximumCountAnalysis } from "../recommendation/maximum-count-validation.js";
import { buildMaximumCountExplanation } from "../recommendation/maximum-count-explanation.js";
import type { DispatchEligibility, RecommendationAnalysisV2, MaximumCountStartAuthority } from "../recommendation/maximum-count-contract.js";
import { selectNextTasks as selectContract11NextTasks, type Contract11NextResult } from "./contract11-runtime.js";

type LegacyTemporal = NonNullable<Contract11NextResult["temporal"]>;
type LegacyAuthority = LegacyTemporal["authority"];
export type NextTaskV10 = Omit<Contract11NextResult["tasks"][number], "scheduleCritical"> & {
  readonly scheduleCritical: boolean | null;
};
export type NextGroupsV10 = Contract11NextResult["groups"];
export type NextResultV10 = Omit<Contract11NextResult, "schemaVersion" | "recommendation" | "temporal" | "tasks"> & {
  readonly schemaVersion: "Perttool.NextResult.v10";
  readonly recommendation: RecommendationAnalysisV2 | null;
  readonly tasks: readonly NextTaskV10[];
  readonly temporal: (Omit<LegacyTemporal, "authority"> & { readonly authority: MaximumCountStartAuthority }) | null;
};

function readDispatchContext(text: string, options: Parameters<typeof selectContract11NextTasks>[1] = {}) {
  const original = selectContract11NextTasks(text, options);
  if (!original.diagnostics.some((item) => item.code === "PTSEM-208")) return { base: original, resourceForecastAvailable: true };
  const { capacityOverrides, ...sourceOptions } = options;
  const source = selectContract11NextTasks(text, sourceOptions);
  if (!source.ok) return { base: original, resourceForecastAvailable: false };
  const graph = buildResidualGraph(source.document as unknown as DocumentNode);
  const overrides = capacityOverrides ?? new Map<string, number>();
  const capacityDiagnostics = validateDispatchCapacityOverrides(graph, overrides);
  const limited = limitDiagnostics(sortDiagnostics([...source.diagnostics, ...capacityDiagnostics]), normalizeMaxDiagnostics(options.maxDiagnostics));
  return {
    base: Object.freeze({ ...source, capacityOverrides: overrides,
      ok: !capacityDiagnostics.some((item) => item.severity === "error"), diagnostics: Object.freeze(limited.diagnostics),
      diagnosticsTruncated: source.diagnosticsTruncated || limited.truncated,
    }), resourceForecastAvailable: false,
  };
}

function readyEligibility(base: Contract11NextResult): ReadonlyMap<string, DispatchEligibility> {
  const time = new Map(base.temporal?.tasks.map((task) => [task.taskId, task.timeEligibility.state]));
  const assurance = new Map(base.assurance?.taskResults.map((task) => [task.taskId, task.status]));
  return new Map(base.groups.ready.map((id) => {
    const status = assurance.get(id);
    const assuranceEligibility = status === "not_applicable" || status === "conditional" || status === "verified"
      ? "eligible" : status === undefined || status === "unavailable" ? "unavailable" : "withheld";
    const timeState = time.get(id);
    const timeEligibility = timeState === "eligible" || timeState === "not_yet_eligible" ? timeState : "unavailable";
    return [id, Object.freeze({ timeEligibility, assuranceEligibility })];
  }));
}

function authorityProjection(base: LegacyAuthority, eligibility: ReadonlyMap<string, DispatchEligibility>,
  selected: readonly string[], complete: boolean): MaximumCountStartAuthority {
  const ids = [...eligibility.keys()];
  return Object.freeze({
    policy: "max_count_dispatch_v1_plus_release_gate_plus_plan_assurance_v1",
    recommendationAlgorithm: Object.freeze({ id: "perttool.dispatch.maximum-count", version: 1 }),
    deadlineFactsUsedForRanking: false, complete, safeStopReasons: base.safeStopReasons,
    timeEligibleTaskIds: base.timeEligibleTaskIds, timeIneligibleTaskIds: base.timeIneligibleTaskIds,
    timeEligibilityUnavailableTaskIds: base.timeEligibilityUnavailableTaskIds, assuranceEligibleTaskIds: base.assuranceEligibleTaskIds,
    eligibleTaskIds: Object.freeze(ids.filter((id) => eligibility.get(id)!.timeEligibility === "eligible" && eligibility.get(id)!.assuranceEligibility === "eligible")),
    timeWithheldTaskIds: Object.freeze(ids.filter((id) => eligibility.get(id)!.timeEligibility === "not_yet_eligible")),
    assuranceWithheldTaskIds: Object.freeze(ids.filter((id) => eligibility.get(id)!.assuranceEligibility === "withheld")),
    unavailableTaskIds: Object.freeze(ids.filter((id) => eligibility.get(id)!.timeEligibility === "unavailable" || eligibility.get(id)!.assuranceEligibility === "unavailable")),
    startableRecommendedTaskIds: selected,
  });
}

function selectedTasks(base: Contract11NextResult, recommendation: RecommendationAnalysisV2 | null) {
  const selection = recommendation?.selection;
  const chosen = new Set(selection?.selectedTaskIds);
  const candidates = new Map(selection?.input.candidates.map((candidate) => [candidate.taskId, candidate]));
  return Object.freeze(base.tasks.map((task) => {
    const candidate = candidates.get(task.id);
    const resourceRejections = candidate === undefined || chosen.has(task.id) ? [] : candidate.requirements.flatMap((requirement) => {
      const resource = selection!.resources.find((item) => item.resourceId === requirement.resourceId)!;
      if (requirement.units <= resource.remainingUnits) return [];
      return [Object.freeze({ resourceId: resource.resourceId, capacity: resource.capacity, activeUsage: resource.activeUsage,
        earlierSelectedUsage: resource.selectedUsage, usedBeforeDecision: resource.activeUsage + resource.selectedUsage,
        required: requirement.units, available: resource.remainingUnits, deficit: requirement.units - resource.remainingUnits,
        activeTaskIds: selection!.input.resources.find((item) => item.resourceId === resource.resourceId)!.activeTaskIds,
        earlierSelectedTaskIds: Object.freeze(selection!.selectedTaskIds.filter((id) =>
          candidates.get(id)!.requirements.some((item) => item.resourceId === resource.resourceId))),
      })];
    });
    return Object.freeze({ ...task, runnableNow: chosen.has(task.id), resourceRejections: Object.freeze(resourceRejections) });
  }));
}

export function selectNextTasks(text: string, options: Parameters<typeof selectContract11NextTasks>[1] = {}): NextResultV10 {
  const sourceDigest = options.sourceDigest ?? sha256DigestUtf8(text);
  const context = readDispatchContext(text, { ...options, sourceDigest });
  const base = context.base;
  const eligibility = readyEligibility(base);
  const complete = [base.ok, !base.diagnosticsTruncated, base.temporal?.authority.complete === true, base.recommendation !== null].every(Boolean);
  let recommendation: RecommendationAnalysisV2 | null = null;
  if (complete) {
    const graph = buildResidualGraph(base.document as unknown as DocumentNode);
    const rankingInput = { graph, precedence: analyzePrecedence(graph, options.maxPaths ?? 100), appliedCapacities: base.capacityOverrides };
    const selection = buildMaximumCountEvidence(rankingInput, sourceDigest, base.grammarVersion!, eligibility);
    recommendation = buildMaximumCountExplanation(selection, rankRecommendationCandidates(rankingInput).candidates, base.recommendation!);
  }
  const invariantDiagnostics = recommendation === null ? [] : validateMaximumCountAnalysis(recommendation);
  if (invariantDiagnostics.length > 0) recommendation = null;
  const selected = recommendation?.recommendedTaskIds ?? Object.freeze([]);
  return Object.freeze({ ...base, schemaVersion: "Perttool.NextResult.v10", recommendation,
    ok: complete && invariantDiagnostics.length === 0,
    diagnostics: Object.freeze([...base.diagnostics, ...invariantDiagnostics]),
    groups: Object.freeze({ ...base.groups, runnableNow: selected }),
    tasks: Object.freeze(selectedTasks(base, recommendation).map((task) => Object.freeze({ ...task,
      scheduleCritical: context.resourceForecastAvailable ? task.scheduleCritical : null,
    }))),
    scheduleAlerts: context.resourceForecastAvailable ? base.scheduleAlerts : null,
    temporal: base.temporal === null ? null : Object.freeze({ ...base.temporal,
      authority: authorityProjection(base.temporal.authority, eligibility, selected, complete && invariantDiagnostics.length === 0),
    }),
  });
}
