import { compareStableStrings } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import type { DurationUnit } from "../model/units.js";
import type {
  RecommendationAnalysis,
  RecommendationComparison,
  RecommendationDecisionPhase,
  RecommendationDecisionRole,
  RecommendationDecisionStep,
  RecommendationDescription,
  RecommendationDescriptionParameter,
  RecommendationEntityReference,
  RecommendationExplanationBuildResult,
  RecommendationExplanationInput,
  RecommendationExplanationTaskDecision,
  RecommendationExpression,
  RecommendationFact,
  RecommendationProvenance,
  RecommendationReasonCode,
  RecommendationReasonEffect,
  RecommendationReasonOccurrence,
  RecommendationScalarValue,
  RecommendationUnit,
  RecommendationValue,
} from "./explanation-types.js";
import {
  recommendationValueKey,
  renderRecommendationDescription,
} from "./explanation-values.js";
import { explainRecommendationCandidateComparison } from "./ranking.js";
import type {
  RecommendationCandidateFacts,
  RecommendationRankingRuleId,
  RecommendationResourceFact,
  RecommendationTaskDecision,
} from "./types.js";
import { validateRecommendationAnalysis } from "./explanation-validation.js";

export const RECOMMENDATION_REASON_TAXONOMY_VERSION = "1.0" as const;
export const RECOMMENDATION_EXPLANATION_MODEL_VERSION = 1 as const;
export const RECOMMENDATION_EXPRESSION_VERSION = 1 as const;
export const RECOMMENDATION_DESCRIPTION_REGISTRY_VERSION = 1 as const;
export const RECOMMENDATION_DESCRIPTION_LOCALE = "en" as const;

const phaseRank: Readonly<Record<RecommendationDecisionPhase, number>> = {
  eligibility: 0,
  negative_fact_filter: 1,
  selection_horizon: 2,
  candidate_ranking: 3,
  resource_selection: 4,
  set_membership: 5,
  tier_classification: 6,
};

const comparisonScopeRank: Readonly<Record<RecommendationComparison["scope"], number>> = {
  ranking: 0,
  selection_horizon: 1,
  resource_selection: 2,
  tier: 3,
};

const ruleOrder: readonly string[] = [
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
];

const ruleRank = new Map(ruleOrder.map((rule, index) => [rule, index]));

function compareRules(left: string, right: string): number {
  return (
    (ruleRank.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (ruleRank.get(right) ?? Number.MAX_SAFE_INTEGER) ||
    compareStableStrings(left, right)
  );
}

function encodeRecordComponent(component: string): string {
  let encoded = "";
  for (const byte of new TextEncoder().encode(component)) {
    const character = String.fromCharCode(byte);
    if (/[A-Za-z0-9._~-]/.test(character)) {
      encoded += character;
    } else {
      encoded += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
    }
  }
  return encoded;
}

function recordId(kind: string, ...components: readonly string[]): string {
  return `rec:${kind}:${components.map(encodeRecordComponent).join(":")}`;
}

function entity(kind: RecommendationEntityReference["kind"], id: string): RecommendationEntityReference {
  return { kind, id };
}

function booleanValue(value: boolean): RecommendationScalarValue {
  return { type: "boolean", value };
}

function integerValue(value: number): RecommendationScalarValue {
  if (!Number.isSafeInteger(value)) throw new Error(`unsafe recommendation integer ${value}`);
  return { type: "integer", value: value.toString() };
}

function rationalValue(value: Rational): RecommendationScalarValue {
  return {
    type: "rational",
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
  };
}

function enumValue(enumType: string, value: string): RecommendationScalarValue {
  return { type: "enum", enumType, value };
}

function entityValue(kind: RecommendationEntityReference["kind"], id: string): RecommendationScalarValue {
  return { type: "entity", value: entity(kind, id) };
}

function setValue(
  itemType: string,
  items: readonly RecommendationScalarValue[],
): RecommendationValue {
  const unique = new Map(items.map((item) => [recommendationValueKey(item), item]));
  return {
    type: "set",
    itemType,
    items: [...unique.entries()]
      .sort(([left], [right]) => compareStableStrings(left, right))
      .map(([, item]) => item),
  };
}

function literal(value: RecommendationValue, unit: RecommendationUnit | null = null) {
  return { kind: "literal" as const, value, unit };
}

function factEquals(
  factId: string,
  value: RecommendationValue,
  unit: RecommendationUnit | null = null,
): RecommendationExpression {
  return {
    kind: "compare",
    left: { kind: "fact", factId },
    relation: "equal",
    right: literal(value, unit),
  };
}

function projectUnit(unit: DurationUnit): RecommendationUnit {
  return { kind: "duration", value: unit };
}

function resourceUnit(resourceId: string): RecommendationUnit {
  return { kind: "resource", resource: entity("resource", resourceId) };
}

function sortedReferences(
  references: readonly RecommendationEntityReference[],
): readonly RecommendationEntityReference[] {
  const unique = new Map(references.map((reference) => [`${reference.kind}:${reference.id}`, reference]));
  return [...unique.values()].sort(
    (left, right) =>
      compareStableStrings(left.kind, right.kind) || compareStableStrings(left.id, right.id),
  );
}

function provenance(
  input: RecommendationExplanationInput,
  kind: RecommendationProvenance["kind"],
  producerId: string,
  producerVersion: string,
  references: readonly RecommendationEntityReference[],
): RecommendationProvenance {
  return {
    kind,
    sourceDigest: input.sourceDigest,
    entityReferences: sortedReferences(references),
    producer: { id: producerId, version: producerVersion },
    sourceSpan: null,
  };
}

interface FactorProjection {
  readonly kind: string;
  readonly value: RecommendationScalarValue;
  readonly unit: RecommendationUnit | null;
}

function factorProjection(
  candidate: RecommendationCandidateFacts,
  rule: RecommendationRankingRuleId,
  durationUnit: DurationUnit,
): FactorProjection {
  switch (rule) {
    case "critical_class":
      return {
        kind: "precedence_critical_class",
        value: enumValue("precedence_critical_class", candidate.precedenceCriticalClass),
        unit: null,
      };
    case "lower_total_float":
      return {
        kind: "precedence_total_float",
        value: rationalValue(candidate.precedenceTotalFloat),
        unit: projectUnit(durationUnit),
      };
    case "higher_explicit_priority":
      return { kind: "explicit_priority", value: integerValue(candidate.explicitPriority), unit: null };
    case "higher_new_ready_count":
      return { kind: "new_ready_task_count", value: integerValue(candidate.newReadyTaskCount), unit: null };
    case "higher_new_gate_count":
      return {
        kind: "new_satisfied_gate_count",
        value: integerValue(candidate.newSatisfiedGateCount),
        unit: null,
      };
    case "higher_new_milestone_count":
      return {
        kind: "new_reached_milestone_count",
        value: integerValue(candidate.newReachedMilestoneCount),
        unit: null,
      };
    case "shorter_next_gate_distance":
      return {
        kind: "next_gate_task_distance",
        value: enumValue("structural_distance", String(candidate.nextGateTaskDistance)),
        unit: null,
      };
    case "shorter_finish_distance":
      return {
        kind: "finish_task_distance",
        value: integerValue(candidate.finishTaskDistance),
        unit: null,
      };
    case "longer_expected_duration":
      return {
        kind: "expected_duration",
        value: rationalValue(candidate.expectedDuration),
        unit: projectUnit(durationUnit),
      };
    case "task_id_tiebreak":
      return { kind: "task_id", value: enumValue("task_id_ascii", candidate.taskId), unit: null };
  }
}

function winnerRelation(rule: RecommendationRankingRuleId): "less_than" | "greater_than" {
  switch (rule) {
    case "higher_explicit_priority":
    case "higher_new_ready_count":
    case "higher_new_gate_count":
    case "higher_new_milestone_count":
    case "longer_expected_duration":
      return "greater_than";
    default:
      return "less_than";
  }
}

function descriptionParameters(
  parameters: readonly RecommendationDescriptionParameter[],
): readonly RecommendationDescriptionParameter[] {
  return [...parameters].sort((left, right) => compareStableStrings(left.name, right.name));
}

interface BuilderState {
  readonly input: RecommendationExplanationInput;
  readonly durationUnit: DurationUnit;
  readonly facts: RecommendationFact[];
  readonly factsBySemanticKey: Map<string, RecommendationFact>;
  readonly steps: RecommendationDecisionStep[];
  readonly comparisons: RecommendationComparison[];
  readonly reasons: RecommendationReasonOccurrence[];
  readonly descriptions: RecommendationDescription[];
  readonly descriptionTaskIds: Map<string, string>;
}

function addFact(
  state: BuilderState,
  semanticKey: string,
  fact: Omit<RecommendationFact, "id">,
): RecommendationFact {
  const existing = state.factsBySemanticKey.get(semanticKey);
  if (existing !== undefined) return existing;
  const id = recordId("fact", ...semanticKey.split(":"));
  const result = { id, ...fact };
  state.facts.push(result);
  state.factsBySemanticKey.set(semanticKey, result);
  return result;
}

function addDescription(
  state: BuilderState,
  taskId: string,
  key: string,
  parameters: readonly RecommendationDescriptionParameter[],
  sourceReasonIds: readonly string[],
  sourceComparisonIds: readonly string[],
  occurrence = 0,
): RecommendationDescription {
  const sorted = descriptionParameters(parameters);
  const description: RecommendationDescription = {
    id: recordId("description", taskId, key, occurrence.toString()),
    key,
    registryVersion: RECOMMENDATION_DESCRIPTION_REGISTRY_VERSION,
    parameters: sorted,
    sourceReasonIds,
    sourceComparisonIds,
    locale: RECOMMENDATION_DESCRIPTION_LOCALE,
    text: renderRecommendationDescription(key, sorted),
    renderStatus: "rendered",
  };
  state.descriptions.push(description);
  state.descriptionTaskIds.set(description.id, taskId);
  return description;
}

function applicationFact(
  state: BuilderState,
  taskId: string,
  ruleId: string,
  outcome: "supports" | "opposes" | "tied",
): RecommendationFact {
  return addFact(state, `${taskId}:ranking_rule_application:${ruleId}`, {
    kind: "ranking_rule_application",
    subject: entity("task", taskId),
    value: enumValue("ranking_rule_application", outcome),
    unit: null,
    provenance: provenance(
      state.input,
      "ranking_algorithm",
      state.input.ranking.algorithmId,
      state.input.ranking.algorithmVersion.toString(),
      [entity("task", taskId), entity("policy_rule", ruleId)],
    ),
  });
}

function addStepWithReason(
  state: BuilderState,
  options: {
    readonly taskId: string;
    readonly phase: RecommendationDecisionPhase;
    readonly ruleId: string;
    readonly expression: RecommendationExpression;
    readonly inputFactIds: readonly string[];
    readonly effect: RecommendationReasonEffect;
    readonly role: RecommendationDecisionRole;
    readonly dependsOnStepIds: readonly string[];
    readonly comparisonIds?: readonly string[];
    readonly reason?: {
      readonly code: RecommendationReasonCode;
      readonly subject?: RecommendationEntityReference;
      readonly factIds: readonly string[];
      readonly emissionExpression?: RecommendationExpression;
      readonly descriptionId?: string | null;
      readonly occurrence?: number;
    };
    readonly occurrence?: number;
  },
): { readonly step: RecommendationDecisionStep; readonly reason: RecommendationReasonOccurrence | null } {
  const occurrence = options.occurrence ?? 0;
  const stepId = recordId(
    "step",
    options.taskId,
    options.phase,
    options.ruleId,
    occurrence.toString(),
  );
  const comparisonIds = options.comparisonIds ?? [];
  let reason: RecommendationReasonOccurrence | null = null;
  if (options.reason !== undefined) {
    const reasonId = recordId(
      "reason",
      options.taskId,
      options.reason.code,
      options.role,
      (options.reason.occurrence ?? occurrence).toString(),
    );
    reason = {
      id: reasonId,
      code: options.reason.code,
      subject: options.reason.subject ?? entity("task", options.taskId),
      effect: options.effect,
      role: options.role,
      factIds: options.reason.factIds,
      emissionExpression: options.reason.emissionExpression ?? options.expression,
      decisionStepId: stepId,
      comparisonIds,
      descriptionId: options.reason.descriptionId ?? null,
    };
    state.reasons.push(reason);
  }
  const step: RecommendationDecisionStep = {
    id: stepId,
    phase: options.phase,
    rule: entity("policy_rule", options.ruleId),
    inputFactIds: options.inputFactIds,
    expression: options.expression,
    result: true,
    effect: options.effect,
    role: options.role,
    reasonOccurrenceIds: reason === null ? [] : [reason.id],
    comparisonIds,
    dependsOnStepIds: options.dependsOnStepIds,
  };
  state.steps.push(step);
  return { step, reason };
}

function candidateFact(
  state: BuilderState,
  candidate: RecommendationCandidateFacts,
  rule: RecommendationRankingRuleId,
): RecommendationFact {
  const projected = factorProjection(candidate, rule, state.durationUnit);
  const provenanceKind =
    projected.kind === "explicit_priority" || projected.kind === "task_id"
      ? "document"
      : projected.kind === "precedence_total_float" ||
          projected.kind === "precedence_critical_class" ||
          projected.kind === "expected_duration"
        ? "precedence_analysis"
        : "ranking_algorithm";
  return addFact(state, `${candidate.taskId}:${projected.kind}:0`, {
    kind: projected.kind,
    subject: entity("task", candidate.taskId),
    value: projected.value,
    unit: projected.unit,
    provenance: provenance(
      state.input,
      provenanceKind,
      provenanceKind === "ranking_algorithm"
        ? state.input.ranking.algorithmId
        : `perttool.${provenanceKind}`,
      provenanceKind === "ranking_algorithm"
        ? state.input.ranking.algorithmVersion.toString()
        : "1",
      [entity("task", candidate.taskId), entity("ranking_factor", projected.kind)],
    ),
  });
}

function addCandidateFacts(state: BuilderState, candidate: RecommendationCandidateFacts): void {
  for (const rule of ruleOrder.filter((candidateRule): candidateRule is RecommendationRankingRuleId =>
    [
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
    ].includes(candidateRule),
  )) {
    candidateFact(state, candidate, rule);
  }
  addFact(state, `${candidate.taskId}:requirements:0`, {
    kind: "requirements",
    subject: entity("task", candidate.taskId),
    value: {
      type: "map",
      keyType: "entity:resource",
      valueType: "integer",
      entries: candidate.requirements.map(({ resourceId, units }) => ({
        key: entityValue("resource", resourceId),
        value: integerValue(units),
      })),
    },
    unit: null,
    provenance: provenance(
      state.input,
      "document",
      "perttool.document",
      "1",
      [entity("task", candidate.taskId), ...candidate.requirements.map(({ resourceId }) => entity("resource", resourceId))],
    ),
  });
}

function addRankingComparison(
  state: BuilderState,
  winner: RecommendationCandidateFacts,
  alternative: RecommendationCandidateFacts,
  scope: RecommendationComparison["scope"],
): RecommendationComparison {
  const semantic = explainRecommendationCandidateComparison(winner, alternative);
  const relevantRules = [
    ...semantic.priorTiedRuleIds,
    semantic.decisiveRuleId,
    ...semantic.contributingRuleIds,
  ];
  const factIds: string[] = [];
  for (const rule of relevantRules) {
    factIds.push(candidateFact(state, winner, rule).id, candidateFact(state, alternative, rule).id);
  }
  const winnerFact = candidateFact(state, winner, semantic.decisiveRuleId);
  const alternativeFact = candidateFact(state, alternative, semantic.decisiveRuleId);
  const decisiveExpression: RecommendationExpression = {
    kind: "compare",
    left: { kind: "fact", factId: winnerFact.id },
    relation: winnerRelation(semantic.decisiveRuleId),
    right: { kind: "fact", factId: alternativeFact.id },
  };
  const comparison: RecommendationComparison = {
    id: recordId(
      "comparison",
      scope,
      winner.taskId,
      alternative.taskId,
      semantic.decisiveRuleId,
      "0",
    ),
    scope,
    subjectTaskId: winner.taskId,
    alternativeTaskId: alternative.taskId,
    winnerTaskId: winner.taskId,
    loserTaskId: alternative.taskId,
    decisiveRule: entity("policy_rule", semantic.decisiveRuleId),
    decisiveExpression,
    priorTiedRuleIds: semantic.priorTiedRuleIds,
    contributingRuleIds: semantic.contributingRuleIds,
    factIds: [...new Set(factIds)],
  };
  state.comparisons.push(comparison);
  return comparison;
}

interface ResourceWitness {
  readonly factIds: readonly string[];
  readonly capacityFact: RecommendationFact;
  readonly usedFact: RecommendationFact;
  readonly requiredFact: RecommendationFact;
  readonly deficitFact: RecommendationFact;
  readonly occupantFact: RecommendationFact;
}

function addResourceWitness(
  state: BuilderState,
  taskId: string,
  resource: RecommendationResourceFact,
  context: "selection" | "addition",
): ResourceWitness {
  const refs = [
    entity("task", taskId),
    entity("resource", resource.resourceId),
    ...resource.activeTaskIds.map((id) => entity("task", id)),
    ...resource.selectedTaskIds.map((id) => entity("task", id)),
  ];
  const commonProvenance = provenance(
    state.input,
    "resource_snapshot",
    "perttool.recommendation-resource-snapshot",
    "1",
    refs,
  );
  const numeric = addFact(state, `${taskId}:${resource.resourceId}:${context}:resource_capacity_witness:0`, {
    kind: "resource_capacity_witness",
    subject: entity("resource", resource.resourceId),
    value: {
      type: "map",
      keyType: "enum:resource_witness_field",
      valueType: "integer",
      entries: [
        ["active_usage", resource.activeUsage],
        ["available", resource.available],
        ["capacity", resource.capacity],
        ["deficit", resource.deficit],
        ["required", resource.required],
        ["selected_usage", resource.selectedUsage],
      ].map(([name, value]) => ({
        key: enumValue("resource_witness_field", String(name)),
        value: integerValue(value as number),
      })),
    },
    unit: resourceUnit(resource.resourceId),
    provenance: commonProvenance,
  });
  const numericFields = {
    resource_capacity: resource.capacity,
    resource_active_usage: resource.activeUsage,
    resource_selected_usage: resource.selectedUsage,
    resource_used: resource.activeUsage + resource.selectedUsage,
    resource_required: resource.required,
    resource_available: resource.available,
    resource_deficit: resource.deficit,
  } as const;
  const scalarFacts = Object.fromEntries(
    Object.entries(numericFields).map(([kind, value]) => [
      kind,
      addFact(state, `${taskId}:${resource.resourceId}:${context}:${kind}:0`, {
        kind,
        subject: entity("resource", resource.resourceId),
        value: integerValue(value),
        unit: resourceUnit(resource.resourceId),
        provenance: commonProvenance,
      }),
    ]),
  ) as Readonly<Record<keyof typeof numericFields, RecommendationFact>>;
  const active = addFact(state, `${taskId}:${resource.resourceId}:${context}:resource_active_occupants:0`, {
    kind: "resource_active_occupants",
    subject: entity("resource", resource.resourceId),
    value: setValue(
      "entity:task",
      resource.activeTaskIds.map((id) => entityValue("task", id)),
    ),
    unit: null,
    provenance: commonProvenance,
  });
  const selected = addFact(state, `${taskId}:${resource.resourceId}:${context}:resource_selected_occupants:0`, {
    kind: "resource_selected_occupants",
    subject: entity("resource", resource.resourceId),
    value: setValue(
      "entity:task",
      resource.selectedTaskIds.map((id) => entityValue("task", id)),
    ),
    unit: null,
    provenance: commonProvenance,
  });
  const occupants = addFact(state, `${taskId}:${resource.resourceId}:${context}:resource_occupants:0`, {
    kind: "resource_occupants",
    subject: entity("resource", resource.resourceId),
    value: setValue(
      "entity:task",
      [...resource.activeTaskIds, ...resource.selectedTaskIds].map((id) =>
        entityValue("task", id),
      ),
    ),
    unit: null,
    provenance: commonProvenance,
  });
  return {
    factIds: [
      numeric.id,
      ...Object.values(scalarFacts).map(({ id }) => id),
      active.id,
      selected.id,
      occupants.id,
    ],
    capacityFact: scalarFacts.resource_capacity,
    usedFact: scalarFacts.resource_used,
    requiredFact: scalarFacts.resource_required,
    deficitFact: scalarFacts.resource_deficit,
    occupantFact: occupants,
  };
}

function addComparisonDescription(
  state: BuilderState,
  taskId: string,
  comparison: RecommendationComparison,
  reasonId: string,
): RecommendationDescription {
  const [winnerFactId, alternativeFactId] = comparison.factIds.filter((factId) => {
    const fact = state.facts.find(({ id }) => id === factId);
    return fact?.kind === factorProjection(
      state.input.ranking.candidates.find(({ taskId: id }) => id === comparison.winnerTaskId)!,
      comparison.decisiveRule.id as RecommendationRankingRuleId,
      state.durationUnit,
    ).kind;
  });
  const winnerFact = state.facts.find(({ id }) => id === winnerFactId)!;
  const alternativeFact = state.facts.find(({ id }) => id === alternativeFactId)!;
  return addDescription(
    state,
    taskId,
    "recommendation.reason.ranking_comparison",
    [
      { name: "winner_task_id", value: entityValue("task", comparison.winnerTaskId!), unit: null },
      { name: "alternative_task_id", value: entityValue("task", comparison.alternativeTaskId!), unit: null },
      { name: "rule_id", value: entityValue("policy_rule", comparison.decisiveRule.id), unit: null },
      { name: "winner_value", value: winnerFact.value, unit: winnerFact.unit },
      { name: "alternative_value", value: alternativeFact.value, unit: alternativeFact.unit },
      {
        name: "relation",
        value: enumValue(
          "recommendation_relation",
          comparison.decisiveExpression.kind === "compare"
            ? comparison.decisiveExpression.relation
            : "equal",
        ),
        unit: null,
      },
    ],
    [reasonId],
    [comparison.id],
  );
}

function buildTaskDecision(
  state: BuilderState,
  rankingDecision: RecommendationTaskDecision,
  horizonFirst: RecommendationCandidateFacts | undefined,
): RecommendationExplanationTaskDecision {
  const taskId = rankingDecision.facts.taskId;
  const stepIds: string[] = [];
  const reasonIds: string[] = [];
  const comparisonIds: string[] = [];
  const descriptionIds: string[] = [];

  const readyFact = addFact(state, `${taskId}:task_classification:0`, {
    kind: "task_classification",
    subject: entity("task", taskId),
    value: enumValue("task_classification", "ready"),
    unit: null,
    provenance: provenance(
      state.input,
      "recommendation_model",
      "perttool.recommendation-model",
      "1",
      [entity("task", taskId)],
    ),
  });
  const ready = addStepWithReason(state, {
    taskId,
    phase: "eligibility",
    ruleId: "task_ready",
    expression: factEquals(readyFact.id, enumValue("task_classification", "ready")),
    inputFactIds: [readyFact.id],
    effect: "neutral",
    role: "context",
    dependsOnStepIds: [],
    reason: { code: "task_ready", factIds: [readyFact.id] },
  });
  stepIds.push(ready.step.id);
  reasonIds.push(ready.reason!.id);

  const horizonFact = addFact(state, `${taskId}:selection_horizon_membership:0`, {
    kind: "selection_horizon_membership",
    subject: entity("task", taskId),
    value: booleanValue(rankingDecision.horizonMember),
    unit: null,
    provenance: provenance(
      state.input,
      "ranking_algorithm",
      state.input.ranking.algorithmId,
      state.input.ranking.algorithmVersion.toString(),
      [entity("task", taskId), entity("derived_set", "H"), entity("policy_rule", "selection_horizon")],
    ),
  });
  const horizonApplication = applicationFact(
    state,
    taskId,
    "selection_horizon",
    rankingDecision.horizonMember ? "supports" : "opposes",
  );
  const horizonExpression = factEquals(
    horizonFact.id,
    booleanValue(rankingDecision.horizonMember),
  );
  const horizonStep = addStepWithReason(state, {
    taskId,
    phase: "selection_horizon",
    ruleId: "selection_horizon",
    expression: horizonExpression,
    inputFactIds: [horizonFact.id, horizonApplication.id],
    effect: rankingDecision.horizonMember ? "supporting" : "opposing",
    role: rankingDecision.recommendedSetMember ? "decisive" : "contributing",
    dependsOnStepIds: [ready.step.id],
    ...(rankingDecision.horizonMember
      ? {
          reason: {
            code: "ranking_rule_supports_task" as const,
            factIds: [horizonApplication.id, horizonFact.id],
            emissionExpression: factEquals(
              horizonApplication.id,
              enumValue("ranking_rule_application", "supports"),
            ),
          },
        }
      : {}),
  });
  stepIds.push(horizonStep.step.id);
  if (horizonStep.reason !== null) reasonIds.push(horizonStep.reason.id);
  let priorStepId = horizonStep.step.id;
  let rankingComparison: RecommendationComparison | null = null;
  let rankingReason: RecommendationReasonOccurrence | null = null;

  if (!rankingDecision.horizonMember && horizonFirst !== undefined) {
    rankingComparison = addRankingComparison(
      state,
      horizonFirst,
      rankingDecision.facts,
      "selection_horizon",
    );
    comparisonIds.push(rankingComparison.id);
    const application = applicationFact(
      state,
      taskId,
      rankingComparison.decisiveRule.id,
      "opposes",
    );
    const rankStep = addStepWithReason(state, {
      taskId,
      phase: "candidate_ranking",
      ruleId: rankingComparison.decisiveRule.id,
      expression: rankingComparison.decisiveExpression,
      inputFactIds: [...rankingComparison.factIds, application.id],
      effect: "opposing",
      role: "decisive",
      dependsOnStepIds: [priorStepId],
      comparisonIds: [rankingComparison.id],
      reason: {
        code: "ranking_rule_opposes_task",
        factIds: [application.id, ...rankingComparison.factIds],
        emissionExpression: factEquals(
          application.id,
          enumValue("ranking_rule_application", "opposes"),
        ),
      },
    });
    stepIds.push(rankStep.step.id);
    reasonIds.push(rankStep.reason!.id);
    priorStepId = rankStep.step.id;
    const emittedRankingReason = rankStep.reason!;
    rankingReason = emittedRankingReason;
    const comparisonDescription = addComparisonDescription(
      state,
      taskId,
      rankingComparison,
      emittedRankingReason.id,
    );
    rankingReason = {
      ...emittedRankingReason,
      descriptionId: comparisonDescription.id,
    };
    state.reasons[
      state.reasons.findIndex(({ id }) => id === emittedRankingReason.id)
    ] = rankingReason;
    descriptionIds.push(comparisonDescription.id);
  }

  const selectionContext = rankingDecision.selection.evaluated
    ? "selection"
    : "addition";
  const selectionFeasibility =
    rankingDecision.selection.feasibility ?? rankingDecision.tierFeasibility;
  const selectionFeasibilityFact = addFact(
    state,
    `${taskId}:set_start_feasibility:${selectionContext}`,
    {
      kind: "set_start_feasibility",
      subject: entity("task", taskId),
      value: booleanValue(selectionFeasibility.feasible),
      unit: null,
      provenance: provenance(
        state.input,
        "resource_snapshot",
        "perttool.recommendation-resource-snapshot",
        "1",
        [
          entity("task", taskId),
          entity("derived_set", "R"),
          ...selectionFeasibility.resources.map(({ resourceId }) =>
            entity("resource", resourceId),
          ),
        ],
      ),
    },
  );
  const selectionViolated = selectionFeasibility.resources.filter(
    ({ deficit }) => deficit > 0,
  );
  const selectionWitnesses = selectionViolated.map((resource) => ({
    resource,
    witness: addResourceWitness(state, taskId, resource, selectionContext),
  }));
  const tierFeasibility = rankingDecision.recommendedSetMember
    ? selectionFeasibility
    : rankingDecision.tierFeasibility;
  const tierContext = rankingDecision.recommendedSetMember
    ? selectionContext
    : "addition";
  const tierFeasibilityFact =
    tierContext === selectionContext
      ? selectionFeasibilityFact
      : addFact(state, `${taskId}:set_start_feasibility:${tierContext}`, {
          kind: "set_start_feasibility",
          subject: entity("task", taskId),
          value: booleanValue(tierFeasibility.feasible),
          unit: null,
          provenance: provenance(
            state.input,
            "resource_snapshot",
            "perttool.recommendation-resource-snapshot",
            "1",
            [
              entity("task", taskId),
              entity("derived_set", "R"),
              ...tierFeasibility.resources.map(({ resourceId }) =>
                entity("resource", resourceId),
              ),
            ],
          ),
        });
  const tierViolated = tierFeasibility.resources.filter(({ deficit }) => deficit > 0);
  const tierWitnesses =
    tierContext === selectionContext
      ? selectionWitnesses
      : tierViolated.map((resource) => ({
          resource,
          witness: addResourceWitness(state, taskId, resource, tierContext),
        }));
  let resourceComparison: RecommendationComparison | null = null;
  if (!selectionFeasibility.feasible) {
    const resourceWinner =
      selectionWitnesses.flatMap(({ resource }) => resource.selectedTaskIds)[0] ?? null;
    resourceComparison = {
      id: recordId(
        "comparison",
        "resource_selection",
        taskId,
        resourceWinner ?? "-",
        "joint_resource_feasibility",
        "0",
      ),
      scope: "resource_selection",
      subjectTaskId: taskId,
      alternativeTaskId: resourceWinner,
      winnerTaskId: resourceWinner,
      loserTaskId: resourceWinner === null ? null : taskId,
      decisiveRule: entity("policy_rule", "joint_resource_feasibility"),
      decisiveExpression: factEquals(
        selectionFeasibilityFact.id,
        booleanValue(false),
      ),
      priorTiedRuleIds: [],
      contributingRuleIds: [],
      factIds: [
        selectionFeasibilityFact.id,
        ...selectionWitnesses.flatMap(({ witness }) => witness.factIds),
      ],
    };
    state.comparisons.push(resourceComparison);
    comparisonIds.push(resourceComparison.id);
  }
  const resourceStep = addStepWithReason(state, {
    taskId,
    phase: "resource_selection",
    ruleId: "joint_resource_feasibility",
    expression: factEquals(
      selectionFeasibilityFact.id,
      booleanValue(selectionFeasibility.feasible),
    ),
    inputFactIds: [
      selectionFeasibilityFact.id,
      ...selectionWitnesses.flatMap(({ witness }) => witness.factIds),
    ],
    effect: selectionFeasibility.feasible ? "supporting" : "blocking",
    role: "contributing",
    dependsOnStepIds: [priorStepId],
    comparisonIds: resourceComparison === null ? [] : [resourceComparison.id],
  });
  stepIds.push(resourceStep.step.id);
  priorStepId = resourceStep.step.id;

  const membershipFact = addFact(state, `${taskId}:recommendation_set_membership:0`, {
    kind: "recommendation_set_membership",
    subject: entity("task", taskId),
    value: booleanValue(rankingDecision.recommendedSetMember),
    unit: null,
    provenance: provenance(
      state.input,
      "recommendation_model",
      "perttool.recommendation-model",
      "1",
      [entity("task", taskId), entity("derived_set", "R")],
    ),
  });
  const membership = addStepWithReason(state, {
    taskId,
    phase: "set_membership",
    ruleId: "recommended_set_membership",
    expression: factEquals(membershipFact.id, booleanValue(rankingDecision.recommendedSetMember)),
    inputFactIds: [membershipFact.id],
    effect: rankingDecision.recommendedSetMember ? "supporting" : "opposing",
    role: "decisive",
    dependsOnStepIds: [priorStepId],
    reason: {
      code: rankingDecision.recommendedSetMember
        ? "recommended_set_selected"
        : "recommended_set_not_selected",
      factIds: [membershipFact.id],
    },
  });
  stepIds.push(membership.step.id);
  reasonIds.push(membership.reason!.id);
  priorStepId = membership.step.id;

  const tierFact = addFact(state, `${taskId}:recommendation_tier:0`, {
    kind: "recommendation_tier",
    subject: entity("task", taskId),
    value: enumValue("recommendation_tier", rankingDecision.tier),
    unit: null,
    provenance: provenance(
      state.input,
      "recommendation_model",
      "perttool.recommendation-model",
      "1",
      [entity("task", taskId), entity("derived_set", "R")],
    ),
  });
  let decisiveStepId = membership.step.id;
  let tierReasonIds: string[] = [];
  if (rankingDecision.tier === "allowed") {
    const tierStep = addStepWithReason(state, {
      taskId,
      phase: "tier_classification",
      ruleId: "recommendation_tier",
      expression: {
        kind: "all",
        children: [
          factEquals(tierFeasibilityFact.id, booleanValue(true)),
          factEquals(tierFact.id, enumValue("recommendation_tier", "allowed")),
        ],
      },
      inputFactIds: [tierFeasibilityFact.id, tierFact.id],
      effect: "supporting",
      role: "decisive",
      dependsOnStepIds: [priorStepId],
      reason: {
        code: "recommended_set_addition_feasible",
        factIds: [tierFeasibilityFact.id],
        emissionExpression: factEquals(tierFeasibilityFact.id, booleanValue(true)),
      },
    });
    stepIds.push(tierStep.step.id);
    reasonIds.push(tierStep.reason!.id);
    tierReasonIds = [tierStep.reason!.id];
    decisiveStepId = tierStep.step.id;
  } else if (rankingDecision.tier === "deferred") {
    const resourceReasonIds: string[] = [];
    for (const [index, { resource, witness }] of tierWitnesses.entries()) {
      const resourceDescription = addDescription(
        state,
        taskId,
        "recommendation.reason.resource_conflict",
        [
          { name: "task_id", value: entityValue("task", taskId), unit: null },
          { name: "resource_id", value: entityValue("resource", resource.resourceId), unit: null },
          {
            name: "capacity",
            value: witness.capacityFact.value,
            unit: witness.capacityFact.unit,
          },
          {
            name: "used",
            value: witness.usedFact.value,
            unit: witness.usedFact.unit,
          },
          {
            name: "required",
            value: witness.requiredFact.value,
            unit: witness.requiredFact.unit,
          },
          {
            name: "deficit",
            value: witness.deficitFact.value,
            unit: witness.deficitFact.unit,
          },
          {
            name: "occupant_task_ids",
            value: witness.occupantFact.value,
            unit: witness.occupantFact.unit,
          },
        ],
        [],
        resourceComparison === null ? [] : [resourceComparison.id],
        index,
      );
      const reasonId = recordId(
        "reason",
        taskId,
        "recommended_set_resource_conflict",
        index === 0 ? "decisive" : "contributing",
        index.toString(),
      );
      const emission: RecommendationExpression = {
        kind: "all",
        children: [
          factEquals(tierFeasibilityFact.id, booleanValue(false)),
          {
            kind: "compare",
            left: { kind: "fact", factId: witness.deficitFact.id },
            relation: "greater_than",
            right: literal(integerValue(0), resourceUnit(resource.resourceId)),
          },
        ],
      };
      const reason: RecommendationReasonOccurrence = {
        id: reasonId,
        code: "recommended_set_resource_conflict",
        subject: entity("task", taskId),
        effect: "blocking",
        role: index === 0 ? "decisive" : "contributing",
        factIds: [tierFeasibilityFact.id, ...witness.factIds],
        emissionExpression: emission,
        decisionStepId: recordId("step", taskId, "tier_classification", "joint_resource_feasibility", "0"),
        comparisonIds: resourceComparison === null ? [] : [resourceComparison.id],
        descriptionId: resourceDescription.id,
      };
      state.reasons.push(reason);
      resourceReasonIds.push(reason.id);
      state.descriptions[state.descriptions.findIndex(({ id }) => id === resourceDescription.id)] = {
        ...resourceDescription,
        sourceReasonIds: [reason.id],
      };
      descriptionIds.push(resourceDescription.id);
    }
    const tierExpression: RecommendationExpression = {
      kind: "all",
      children: [
        factEquals(tierFeasibilityFact.id, booleanValue(false)),
        factEquals(tierFact.id, enumValue("recommendation_tier", "deferred")),
      ],
    };
    const tierStep: RecommendationDecisionStep = {
      id: recordId("step", taskId, "tier_classification", "joint_resource_feasibility", "0"),
      phase: "tier_classification",
      rule: entity("policy_rule", "joint_resource_feasibility"),
      inputFactIds: [
        tierFeasibilityFact.id,
        tierFact.id,
        ...tierWitnesses.flatMap(({ witness }) => witness.factIds),
      ],
      expression: tierExpression,
      result: true,
      effect: "blocking",
      role: "decisive",
      reasonOccurrenceIds: resourceReasonIds,
      comparisonIds: resourceComparison === null ? [] : [resourceComparison.id],
      dependsOnStepIds: [priorStepId],
    };
    state.steps.push(tierStep);
    stepIds.push(tierStep.id);
    reasonIds.push(...resourceReasonIds);
    tierReasonIds = resourceReasonIds;
    decisiveStepId = tierStep.id;
  } else {
    const tierStep = addStepWithReason(state, {
      taskId,
      phase: "tier_classification",
      ruleId: "recommendation_tier",
      expression: {
        kind: "all",
        children: [
          factEquals(membershipFact.id, booleanValue(true)),
          factEquals(tierFact.id, enumValue("recommendation_tier", "recommended")),
        ],
      },
      inputFactIds: [membershipFact.id, tierFact.id],
      effect: "supporting",
      role: "context",
      dependsOnStepIds: [priorStepId],
    });
    stepIds.push(tierStep.step.id);
  }

  let summary: RecommendationDescription;
  if (rankingDecision.tier === "recommended") {
    const decisiveRule = rankingDecision.selection.scanIndex === 0
      ? "selection_horizon"
      : "joint_resource_feasibility";
    summary = addDescription(
      state,
      taskId,
      "recommendation.summary.recommended",
      [
        { name: "task_id", value: entityValue("task", taskId), unit: null },
        { name: "decisive_rule_id", value: entityValue("policy_rule", decisiveRule), unit: null },
      ],
      [horizonStep.reason!.id, membership.reason!.id],
      [],
    );
  } else if (rankingDecision.tier === "allowed") {
    summary = addDescription(
      state,
      taskId,
      "recommendation.summary.allowed",
      [
        { name: "task_id", value: entityValue("task", taskId), unit: null },
        {
          name: "higher_priority_task_id",
          value: entityValue("task", rankingDecision.primaryHigherPriorityTaskId!),
          unit: null,
        },
        {
          name: "decisive_rule_id",
          value: entityValue("policy_rule", rankingComparison!.decisiveRule.id),
          unit: null,
        },
      ],
      [rankingReason!.id, ...tierReasonIds],
      [rankingComparison!.id],
    );
  } else {
    summary = addDescription(
      state,
      taskId,
      "recommendation.summary.deferred_resource",
      [
        { name: "task_id", value: entityValue("task", taskId), unit: null },
        {
          name: "resource_ids",
          value: setValue(
            "entity:resource",
            tierViolated.map(({ resourceId }) => entityValue("resource", resourceId)),
          ),
          unit: null,
        },
        {
          name: "higher_priority_task_ids",
          value: setValue("entity:task", rankingDecision.selectedBlockerTaskIds.map((id) => entityValue("task", id))),
          unit: null,
        },
        {
          name: "active_blocker_task_ids",
          value: setValue("entity:task", rankingDecision.activeBlockerTaskIds.map((id) => entityValue("task", id))),
          unit: null,
        },
      ],
      tierReasonIds,
      resourceComparison === null ? [] : [resourceComparison.id],
    );
  }
  descriptionIds.push(summary.id);

  return {
    id: recordId("decision", "task", taskId),
    subjectTaskId: taskId,
    action: "start",
    classification: "ready",
    tier: rankingDecision.tier,
    recommendedSetMember: rankingDecision.recommendedSetMember,
    stepIds,
    decisiveStepId,
    reasonOccurrenceIds: reasonIds,
    comparisonIds,
    primaryHigherPriorityTaskId: rankingDecision.primaryHigherPriorityTaskId,
    summaryDescriptionId: summary.id,
    descriptionIds,
  };
}

function buildRecommendationExplanationUnchecked(
  input: RecommendationExplanationInput,
): RecommendationExplanationBuildResult {
  const state: BuilderState = {
    input,
    durationUnit: input.graph.durationUnit,
    facts: [],
    factsBySemanticKey: new Map(),
    steps: [],
    comparisons: [],
    reasons: [],
    descriptions: [],
    descriptionTaskIds: new Map(),
  };
  for (const candidate of input.ranking.candidates) addCandidateFacts(state, candidate);

  const jointFact = addFact(state, "R:set_start_feasibility:0", {
    kind: "set_start_feasibility",
    subject: entity("derived_set", "R"),
    value: booleanValue(input.ranking.jointFeasibility.feasible),
    unit: null,
    provenance: provenance(
      input,
      "resource_snapshot",
      "perttool.recommendation-resource-snapshot",
      "1",
      [entity("derived_set", "R"), ...input.ranking.jointFeasibility.resources.map(({ resourceId }) => entity("resource", resourceId))],
    ),
  });
  const resultTrace = addStepWithReason(state, {
    taskId: "R",
    phase: "resource_selection",
    ruleId: "joint_resource_feasibility",
    expression: factEquals(jointFact.id, booleanValue(true)),
    inputFactIds: [jointFact.id],
    effect: "neutral",
    role: "context",
    dependsOnStepIds: [],
    reason: {
      code: "recommended_set_feasible",
      subject: entity("derived_set", "R"),
      factIds: [jointFact.id],
    },
  });

  const horizonFirst = input.ranking.candidates.find(({ taskId }) =>
    input.ranking.horizonTaskIds.includes(taskId),
  );
  const taskDecisions = input.ranking.taskDecisions.map((decision) =>
    buildTaskDecision(state, decision, horizonFirst),
  );
  const taskOrder = new Map(taskDecisions.map(({ subjectTaskId }, index) => [subjectTaskId, index]));
  state.steps.sort(
    (left, right) =>
      phaseRank[left.phase] - phaseRank[right.phase] ||
      compareRules(left.rule.id, right.rule.id) ||
      compareStableStrings(left.id, right.id),
  );
  state.comparisons.sort(
    (left, right) =>
      comparisonScopeRank[left.scope] - comparisonScopeRank[right.scope] ||
      compareStableStrings(left.subjectTaskId, right.subjectTaskId) ||
      compareStableStrings(left.alternativeTaskId ?? "", right.alternativeTaskId ?? "") ||
      compareRules(left.decisiveRule.id, right.decisiveRule.id) ||
      compareStableStrings(left.id, right.id),
  );
  state.facts.sort(
    (left, right) =>
      compareStableStrings(left.kind, right.kind) ||
      compareStableStrings(left.subject.kind, right.subject.kind) ||
      compareStableStrings(left.subject.id, right.subject.id) ||
      compareStableStrings(left.id, right.id),
  );
  const stepById = new Map(state.steps.map((step) => [step.id, step]));
  const comparisonById = new Map(
    state.comparisons.map((comparison) => [comparison.id, comparison]),
  );
  state.reasons.sort((left, right) => {
    const leftStep = stepById.get(left.decisionStepId)!;
    const rightStep = stepById.get(right.decisionStepId)!;
    const leftAlternative = left.comparisonIds
      .map((id) => comparisonById.get(id)?.alternativeTaskId)
      .find((id) => id !== undefined && id !== null) ?? "";
    const rightAlternative = right.comparisonIds
      .map((id) => comparisonById.get(id)?.alternativeTaskId)
      .find((id) => id !== undefined && id !== null) ?? "";
    return (
      phaseRank[leftStep.phase] - phaseRank[rightStep.phase] ||
      compareRules(leftStep.rule.id, rightStep.rule.id) ||
      compareStableStrings(left.subject.kind, right.subject.kind) ||
      compareStableStrings(left.subject.id, right.subject.id) ||
      compareStableStrings(leftAlternative, rightAlternative) ||
      compareStableStrings(left.code, right.code) ||
      compareStableStrings(left.id, right.id)
    );
  });
  state.descriptions.sort(
    (left, right) =>
      (taskOrder.get(state.descriptionTaskIds.get(left.id)!) ?? Number.MAX_SAFE_INTEGER) -
        (taskOrder.get(state.descriptionTaskIds.get(right.id)!) ?? Number.MAX_SAFE_INTEGER) ||
      compareStableStrings(left.key, right.key) ||
      compareStableStrings(left.id, right.id),
  );

  const analysis: RecommendationAnalysis = {
    action: "start",
    algorithm: {
      id: input.ranking.algorithmId,
      version: input.ranking.algorithmVersion,
      optimal: input.ranking.optimal,
    },
    reasonTaxonomyVersion: RECOMMENDATION_REASON_TAXONOMY_VERSION,
    explanationModelVersion: RECOMMENDATION_EXPLANATION_MODEL_VERSION,
    expressionVersion: RECOMMENDATION_EXPRESSION_VERSION,
    descriptionRegistryVersion: RECOMMENDATION_DESCRIPTION_REGISTRY_VERSION,
    descriptionLocale: RECOMMENDATION_DESCRIPTION_LOCALE,
    sourceDigest: input.sourceDigest,
    recommendedTaskIds: input.ranking.recommendedTaskIds,
    resultDecision: {
      id: recordId("decision", "result", "R"),
      action: "start",
      recommendedTaskIds: input.ranking.recommendedTaskIds,
      jointFeasibilityFactId: jointFact.id,
      stepIds: [resultTrace.step.id],
      reasonOccurrenceIds: [resultTrace.reason!.id],
    },
    taskDecisions,
    decisionSteps: state.steps,
    facts: state.facts,
    comparisons: state.comparisons,
    reasonOccurrences: state.reasons,
    descriptions: state.descriptions,
    explanationStatus: {
      level: "full",
      complete: true,
      decisiveChainComplete: true,
      truncated: false,
      omittedCounts: {
        decisionSteps: 0,
        facts: 0,
        comparisons: 0,
        reasonOccurrences: 0,
        descriptions: 0,
      },
    },
  };
  const diagnostics = validateRecommendationAnalysis(analysis);
  return diagnostics.length === 0
    ? { ok: true, analysis, diagnostics: [] }
    : { ok: false, analysis: null, diagnostics };
}

export function buildRecommendationExplanation(
  input: RecommendationExplanationInput,
): RecommendationExplanationBuildResult {
  try {
    return buildRecommendationExplanationUnchecked(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = message.includes("description")
      ? "PTREC-303"
      : message.includes("unknown") || message.includes("registered")
        ? "PTREC-302"
        : "PTREC-301";
    return {
      ok: false,
      analysis: null,
      diagnostics: [
        {
          code,
          severity: "error",
          message: `recommendation explanation invariant failure: ${message}`,
        },
      ],
    };
  }
}
