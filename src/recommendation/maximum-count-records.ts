// R: Build source-bound model-2 facts, reason steps and registered descriptions.
import type {
  RecommendationEntityReference, RecommendationExpression, RecommendationFact,
  RecommendationValue, RecommendationUnit,
} from "./explanation-types.js";
import type {
  DispatchDecisionStep, DispatchDescription, DispatchReasonCode, DispatchReasonOccurrence,
} from "./maximum-count-contract.js";
import { renderDispatchDescription } from "./maximum-count-descriptions.js";

export const dispatchEntity = (kind: RecommendationEntityReference["kind"], id: string): RecommendationEntityReference => ({ kind, id });
export const dispatchInteger = (value: number): RecommendationValue => ({ type: "integer", value: String(value) });
export const dispatchEnum = (enumType: string, value: string): RecommendationValue => ({ type: "enum", enumType, value });
export const dispatchTaskList = (ids: readonly string[]): RecommendationValue => ({
  type: "list", itemType: "entity:task", items: ids.map((id) => ({ type: "entity", value: dispatchEntity("task", id) })),
});

export function createDispatchRecords(sourceDigest: string, initialFacts: readonly RecommendationFact[]) {
  const facts: RecommendationFact[] = [...initialFacts];
  const decisionSteps: DispatchDecisionStep[] = [];
  const reasonOccurrences: DispatchReasonOccurrence[] = [];
  const descriptions: DispatchDescription[] = [];
  const ownerId = (owner: RecommendationEntityReference) => encodeURIComponent(`${owner.kind}/${owner.id}`);

  function fact(owner: RecommendationEntityReference, kind: string, value: RecommendationValue,
    unit: RecommendationUnit | null = null, references: readonly RecommendationEntityReference[] = []) {
    const occurrence = facts.filter((item) => item.subject.kind === owner.kind && item.subject.id === owner.id && item.kind === kind).length;
    const id = `rec:fact:${ownerId(owner)}:${kind}:${occurrence}`;
    facts.push(Object.freeze({ id, kind, subject: owner, value, unit,
      provenance: Object.freeze({ kind: "recommendation_model", sourceDigest,
        entityReferences: Object.freeze([owner, ...references]),
        producer: Object.freeze({ id: "perttool.dispatch.maximum-count", version: "1" }), sourceSpan: null,
      }),
    }));
    return id;
  }

  function describe(owner: RecommendationEntityReference, key: string, values: Readonly<Record<string, RecommendationValue>>,
    sourceReasonIds: readonly string[] = [], sourceComparisonIds: readonly string[] = []) {
    const resource = values["resource_id"];
    const parameters = Object.entries(values).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([name, value]) => ({ name, value,
        unit: resource?.type === "entity" && ["allocatable_units", "selected_usage", "remaining_units", "required_units"].includes(name)
          ? { kind: "resource" as const, resource: resource.value } : null,
      }));
    const id = `rec:description:${ownerId(owner)}:${encodeURIComponent(key)}:${descriptions.length}`;
    descriptions.push(Object.freeze({ id, key, registryVersion: 2, parameters: Object.freeze(parameters),
      sourceReasonIds, sourceComparisonIds, locale: "en", text: renderDispatchDescription(key, parameters), renderStatus: "rendered",
    }));
    return id;
  }

  function step(owner: RecommendationEntityReference, code: DispatchReasonCode, phase: DispatchDecisionStep["phase"],
    condition: { readonly factId: string; readonly expected: RecommendationValue }, parameters: Readonly<Record<string, RecommendationValue>>,
    options: { readonly dependsOnStepIds?: readonly string[]; readonly extraFacts?: readonly string[]; readonly expression?: RecommendationExpression } = {}) {
    const { factId, expected } = condition;
    const id = `rec:step:${ownerId(owner)}:${code}:${decisionSteps.length}`;
    const reasonId = `rec:reason:${ownerId(owner)}:${code}:${reasonOccurrences.length}`;
    const factIds = Object.freeze([factId, ...options.extraFacts ?? []]);
    const sourceFact = facts.find((item) => item.id === factId)!;
    const test: RecommendationExpression = options.expression ?? {
      kind: "compare", left: { kind: "fact", factId }, relation: "equal",
      right: { kind: "literal", value: expected, unit: sourceFact.unit },
    };
    const role = ["maximum_task_count", "rank_group_counts", "task_id_tiebreak", "recommended_set_selected",
      "recommended_set_resource_conflict", "time_ineligible", "time_eligibility_unavailable",
      "assurance_withheld", "assurance_unavailable"].includes(code) ? "decisive" : "context";
    const effect = ["time_ineligible", "time_eligibility_unavailable", "assurance_withheld",
      "assurance_unavailable", "recommended_set_resource_conflict"].includes(code) ? "blocking" : "supporting";
    const descriptionId = describe(owner, `recommendation.reason.${code}`, parameters, [reasonId]);
    reasonOccurrences.push(Object.freeze({ id: reasonId, code, subject: owner, effect, role, factIds,
      emissionExpression: test, decisionStepId: id, comparisonIds: Object.freeze([]), descriptionId,
    }));
    decisionSteps.push(Object.freeze({ id, phase, rule: dispatchEntity("policy_rule", code), inputFactIds: factIds,
      expression: test, result: true, effect, role, reasonOccurrenceIds: Object.freeze([reasonId]),
      comparisonIds: Object.freeze([]), dependsOnStepIds: options.dependsOnStepIds ?? Object.freeze([]),
    }));
    return Object.freeze({ id, reasonId, descriptionId, role });
  }
  return { facts, decisionSteps, reasonOccurrences, descriptions, fact, describe, step };
}
export type DispatchRecords = ReturnType<typeof createDispatchRecords>;
