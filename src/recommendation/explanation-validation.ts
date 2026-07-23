import type { Diagnostic } from "../model/diagnostics.js";
import { compareStableStrings } from "../model/diagnostics.js";
import type {
  RecommendationAnalysis,
  RecommendationComparison,
  RecommendationDecisionPhase,
  RecommendationDecisionRole,
  RecommendationDescription,
  RecommendationEntityReference,
  RecommendationExpression,
  RecommendationFact,
  RecommendationReasonCode,
  RecommendationReasonEffect,
  RecommendationReasonOccurrence,
  RecommendationScalarValue,
  RecommendationUnit,
  RecommendationValue,
} from "./explanation-types.js";
import {
  evaluateRecommendationExpression,
  recommendationDescriptionKeys,
  recommendationValueKey,
  renderRecommendationDescription,
} from "./explanation-values.js";

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

const ruleOrder = [...knownRules];
const ruleRank = new Map(ruleOrder.map((rule, index) => [rule, index]));

function compareRules(left: string, right: string): number {
  return (
    (ruleRank.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (ruleRank.get(right) ?? Number.MAX_SAFE_INTEGER) ||
    compareStableStrings(left, right)
  );
}

const comparisonScopeRank: Readonly<Record<RecommendationComparison["scope"], number>> = {
  ranking: 0,
  selection_horizon: 1,
  resource_selection: 2,
  tier: 3,
};

const knownFactKinds = new Set([
  "task_classification",
  "recommendation_set_membership",
  "set_start_feasibility",
  "resource_capacity_witness",
  "resource_active_occupants",
  "resource_selected_occupants",
  "resource_occupants",
  "resource_capacity",
  "resource_active_usage",
  "resource_selected_usage",
  "resource_used",
  "resource_required",
  "resource_available",
  "resource_deficit",
  "ranking_rule_application",
  "selection_horizon_membership",
  "recommendation_tier",
  "precedence_total_float",
  "precedence_critical_class",
  "explicit_priority",
  "new_ready_task_count",
  "new_satisfied_gate_count",
  "new_reached_milestone_count",
  "next_gate_task_distance",
  "finish_task_distance",
  "expected_duration",
  "task_id",
  "requirements",
]);

const reasonContract: Readonly<
  Record<
    RecommendationReasonCode,
    {
      readonly effect: RecommendationReasonEffect;
      readonly roles: readonly RecommendationDecisionRole[];
      readonly requiredFactKinds: readonly string[];
    }
  >
> = {
  task_ready: { effect: "neutral", roles: ["context"], requiredFactKinds: ["task_classification"] },
  recommended_set_selected: {
    effect: "supporting",
    roles: ["decisive"],
    requiredFactKinds: ["recommendation_set_membership"],
  },
  recommended_set_not_selected: {
    effect: "opposing",
    roles: ["decisive"],
    requiredFactKinds: ["recommendation_set_membership"],
  },
  recommended_set_feasible: {
    effect: "neutral",
    roles: ["context"],
    requiredFactKinds: ["set_start_feasibility"],
  },
  ranking_rule_supports_task: {
    effect: "supporting",
    roles: ["decisive", "contributing"],
    requiredFactKinds: ["ranking_rule_application"],
  },
  ranking_rule_opposes_task: {
    effect: "opposing",
    roles: ["decisive", "contributing"],
    requiredFactKinds: ["ranking_rule_application"],
  },
  ranking_rule_tied: {
    effect: "neutral",
    roles: ["context"],
    requiredFactKinds: ["ranking_rule_application"],
  },
  recommended_set_addition_feasible: {
    effect: "supporting",
    roles: ["decisive", "contributing"],
    requiredFactKinds: ["set_start_feasibility"],
  },
  recommended_set_resource_conflict: {
    effect: "blocking",
    roles: ["decisive", "contributing"],
    requiredFactKinds: ["set_start_feasibility", "resource_capacity_witness"],
  },
  policy_defers_start: {
    effect: "blocking",
    roles: ["decisive", "contributing"],
    requiredFactKinds: ["ranking_rule_application"],
  },
  modeled_negative_fact_applies: {
    effect: "blocking",
    roles: ["decisive"],
    requiredFactKinds: ["modeled_negative_fact"],
  },
};

const phaseRank: Readonly<Record<RecommendationDecisionPhase, number>> = {
  eligibility: 0,
  negative_fact_filter: 1,
  selection_horizon: 2,
  candidate_ranking: 3,
  resource_selection: 4,
  set_membership: 5,
  tier_classification: 6,
};

function diagnostic(code: "PTREC-301" | "PTREC-302" | "PTREC-303", message: string): Diagnostic {
  return { code, severity: "error", message };
}

function addOnce(diagnostics: Diagnostic[], item: Diagnostic): void {
  if (!diagnostics.some(({ code, message }) => code === item.code && message === item.message)) {
    diagnostics.push(item);
  }
}

function unitKey(unit: RecommendationUnit | null): string {
  if (unit === null) return "-";
  if (unit.kind === "duration") return `duration:${unit.value}`;
  if (unit.kind === "resource") return `resource:${unit.resource.kind}:${unit.resource.id}`;
  return "ratio";
}

function scalarType(value: RecommendationScalarValue): string {
  if (value.type === "enum") return `enum:${value.enumType}`;
  if (value.type === "entity") return `entity:${value.value.kind}`;
  return value.type;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let current = left < 0n ? -left : left;
  let remainder = right < 0n ? -right : right;
  while (remainder !== 0n) {
    [current, remainder] = [remainder, current % remainder];
  }
  return current;
}

function validateScalar(value: RecommendationScalarValue): string | null {
  try {
    switch (value.type) {
      case "boolean":
        return typeof value.value === "boolean" ? null : "boolean value is invalid";
      case "integer":
        return BigInt(value.value).toString() === value.value
          ? null
          : "integer value is not canonical";
      case "rational": {
        const numerator = BigInt(value.numerator);
        const denominator = BigInt(value.denominator);
        if (denominator <= 0n) return "rational denominator is not positive";
        if (numerator.toString() !== value.numerator || denominator.toString() !== value.denominator) {
          return "rational value is not canonical";
        }
        if (greatestCommonDivisor(numerator, denominator) !== 1n) {
          return "rational value is not reduced";
        }
        return null;
      }
      case "enum":
        return value.enumType.length > 0 && value.value.length > 0 ? null : "enum is incomplete";
      case "entity":
        return value.value.id.length > 0 ? null : "entity reference is incomplete";
      default:
        return "unknown scalar value type";
    }
  } catch {
    return "numeric value is invalid";
  }
}

function validateValue(value: RecommendationValue): string | null {
  if (value.type !== "list" && value.type !== "set" && value.type !== "map") {
    return validateScalar(value);
  }
  if (value.type === "map") {
    const keySet = new Set<string>();
    const keys: string[] = [];
    for (const entry of value.entries) {
      const keyIssue = validateScalar(entry.key);
      const valueIssue = validateScalar(entry.value);
      if (keyIssue !== null || valueIssue !== null) return keyIssue ?? valueIssue;
      if (scalarType(entry.key) !== value.keyType || scalarType(entry.value) !== value.valueType) {
        return "map entry type does not match its declaration";
      }
      const key = recommendationValueKey(entry.key);
      if (keySet.has(key)) return "map contains duplicate keys";
      keySet.add(key);
      keys.push(key);
    }
    const sortedKeys = [...keys].sort(compareStableStrings);
    if (keys.some((key, index) => key !== sortedKeys[index])) {
      return "map entries are not in canonical key order";
    }
    return null;
  }
  const itemKeys = new Set<string>();
  for (const item of value.items) {
    const issue = validateScalar(item);
    if (issue !== null) return issue;
    if (scalarType(item) !== value.itemType) return `${value.type} item type does not match its declaration`;
    const key = recommendationValueKey(item);
    if (value.type === "set" && itemKeys.has(key)) return "set contains duplicate items";
    itemKeys.add(key);
  }
  if (value.type === "set") {
    const keys = value.items.map((item) => recommendationValueKey(item));
    const sortedKeys = [...keys].sort(compareStableStrings);
    if (keys.some((key, index) => key !== sortedKeys[index])) {
      return "set items are not in canonical order";
    }
  }
  return null;
}

function expressionKinds(
  expression: RecommendationExpression,
  diagnostics: Diagnostic[],
  depth = 1,
): void {
  if (depth > 8) {
    addOnce(diagnostics, diagnostic("PTREC-302", "expression exceeds version 1 maximum depth"));
    return;
  }
  const kind = (expression as { readonly kind?: string }).kind;
  if (kind !== "compare" && kind !== "all" && kind !== "any") {
    addOnce(diagnostics, diagnostic("PTREC-302", `expression node ${kind ?? "<missing>"} is not registered`));
    return;
  }
  if (kind === "all" || kind === "any") {
    const children = (expression as Extract<RecommendationExpression, { kind: "all" | "any" }>).children;
    if (!Array.isArray(children) || children.length === 0) {
      addOnce(diagnostics, diagnostic("PTREC-301", `${kind} expression has no children`));
      return;
    }
    for (const child of children) expressionKinds(child, diagnostics, depth + 1);
    return;
  }
  const relation = (expression as Extract<RecommendationExpression, { kind: "compare" }>).relation;
  if (
    ![
      "equal",
      "not_equal",
      "less_than",
      "less_or_equal",
      "greater_than",
      "greater_or_equal",
      "contains",
    ].includes(relation)
  ) {
    addOnce(diagnostics, diagnostic("PTREC-302", `expression relation ${String(relation)} is not registered`));
  }
}

function validateExpression(
  expression: RecommendationExpression,
  facts: ReadonlyMap<string, RecommendationFact>,
  diagnostics: Diagnostic[],
  context: string,
): boolean | null {
  const before = diagnostics.length;
  expressionKinds(expression, diagnostics);
  if (diagnostics.length > before && diagnostics.at(-1)?.code === "PTREC-302") return null;
  try {
    return evaluateRecommendationExpression(expression, facts);
  } catch (error) {
    addOnce(
      diagnostics,
      diagnostic(
        "PTREC-301",
        `${context} expression is not type-correct: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    return null;
  }
}

function entityParameterMatches(name: string, value: RecommendationValue): boolean {
  const singularKinds: Readonly<Record<string, RecommendationEntityReference["kind"]>> = {
    task_id: "task",
    higher_priority_task_id: "task",
    winner_task_id: "task",
    alternative_task_id: "task",
    resource_id: "resource",
    rule_id: "policy_rule",
    decisive_rule_id: "policy_rule",
    negative_fact_kind: "negative_fact_kind",
  };
  const pluralKinds: Readonly<Record<string, RecommendationEntityReference["kind"]>> = {
    resource_ids: "resource",
    higher_priority_task_ids: "task",
    active_blocker_task_ids: "task",
    occupant_task_ids: "task",
  };
  const singular = singularKinds[name];
  if (singular !== undefined) {
    return value.type === "entity" && value.value.kind === singular;
  }
  const plural = pluralKinds[name];
  if (plural !== undefined) {
    return (
      value.type === "set" &&
      value.items.every((item) => item.type === "entity" && item.value.kind === plural)
    );
  }
  return true;
}

function validateDescription(
  description: RecommendationDescription,
  diagnostics: Diagnostic[],
): void {
  if (!recommendationDescriptionKeys.includes(description.key)) {
    addOnce(diagnostics, diagnostic("PTREC-303", `description ${description.id} has unknown key ${description.key}`));
    return;
  }
  if (description.registryVersion !== 1 || description.locale !== "en") {
    addOnce(diagnostics, diagnostic("PTREC-303", `description ${description.id} has an unsupported registry or locale`));
  }
  for (const parameter of description.parameters) {
    if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(parameter.name)) {
      addOnce(diagnostics, diagnostic("PTREC-303", `description ${description.id} has invalid parameter ${parameter.name}`));
    }
    if (!entityParameterMatches(parameter.name, parameter.value)) {
      addOnce(diagnostics, diagnostic("PTREC-303", `description ${description.id} parameter ${parameter.name} has the wrong entity kind`));
    }
  }
  try {
    const rendered = renderRecommendationDescription(description.key, description.parameters);
    if (rendered !== description.text) {
      addOnce(diagnostics, diagnostic("PTREC-303", `description ${description.id} text does not match its typed parameters`));
    }
  } catch (error) {
    addOnce(
      diagnostics,
      diagnostic(
        "PTREC-303",
        `description ${description.id} is invalid: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }
}

function descriptionParameter(
  description: RecommendationDescription,
  name: string,
): RecommendationDescription["parameters"][number] | undefined {
  return description.parameters.find((parameter) => parameter.name === name);
}

function typedParameterMatchesFact(
  description: RecommendationDescription,
  parameterName: string,
  fact: RecommendationFact | undefined,
): boolean {
  const parameter = descriptionParameter(description, parameterName);
  return (
    parameter !== undefined &&
    fact !== undefined &&
    recommendationValueKey(parameter.value) === recommendationValueKey(fact.value) &&
    unitKey(parameter.unit) === unitKey(fact.unit)
  );
}

function entityParameterId(
  description: RecommendationDescription,
  name: string,
): string | null {
  const value = descriptionParameter(description, name)?.value;
  return value?.type === "entity" ? value.value.id : null;
}

function validateDescriptionSources(
  description: RecommendationDescription,
  facts: ReadonlyMap<string, RecommendationFact>,
  comparisons: ReadonlyMap<string, RecommendationComparison>,
  reasons: ReadonlyMap<string, RecommendationReasonOccurrence>,
  diagnostics: Diagnostic[],
): void {
  const sourceReasons = description.sourceReasonIds
    .map((id) => reasons.get(id))
    .filter((reason): reason is RecommendationReasonOccurrence => reason !== undefined);
  const taskSubject = sourceReasons.find(({ subject }) => subject.kind === "task")?.subject.id;
  if (
    taskSubject !== undefined &&
    descriptionParameter(description, "task_id") !== undefined &&
    entityParameterId(description, "task_id") !== taskSubject
  ) {
    addOnce(
      diagnostics,
      diagnostic(
        "PTREC-303",
        `description ${description.id} task_id does not match its source reason`,
      ),
    );
  }
  if (description.key === "recommendation.reason.ranking_comparison") {
    const comparison = description.sourceComparisonIds
      .map((id) => comparisons.get(id))
      .find((candidate) => candidate !== undefined);
    if (
      comparison === undefined ||
      entityParameterId(description, "winner_task_id") !== comparison.winnerTaskId ||
      entityParameterId(description, "alternative_task_id") !==
        comparison.alternativeTaskId ||
      entityParameterId(description, "rule_id") !== comparison.decisiveRule.id ||
      comparison.decisiveExpression.kind !== "compare" ||
      comparison.decisiveExpression.left.kind !== "fact" ||
      comparison.decisiveExpression.right.kind !== "fact"
    ) {
      addOnce(
        diagnostics,
        diagnostic(
          "PTREC-303",
          `description ${description.id} does not match its source comparison`,
        ),
      );
      return;
    }
    const relation = descriptionParameter(description, "relation")?.value;
    if (
      relation?.type !== "enum" ||
      relation.value !== comparison.decisiveExpression.relation ||
      !typedParameterMatchesFact(
        description,
        "winner_value",
        facts.get(comparison.decisiveExpression.left.factId),
      ) ||
      !typedParameterMatchesFact(
        description,
        "alternative_value",
        facts.get(comparison.decisiveExpression.right.factId),
      )
    ) {
      addOnce(
        diagnostics,
        diagnostic(
          "PTREC-303",
          `description ${description.id} values do not match its source comparison facts`,
        ),
      );
    }
  }
  if (description.key === "recommendation.reason.resource_conflict") {
    const reason = sourceReasons[0];
    const resourceId = entityParameterId(description, "resource_id");
    const sourceFacts = (reason?.factIds ?? [])
      .map((id) => facts.get(id))
      .filter(
        (fact): fact is RecommendationFact =>
          fact !== undefined && fact.subject.kind === "resource" && fact.subject.id === resourceId,
      );
    const expectedKinds: Readonly<Record<string, string>> = {
      capacity: "resource_capacity",
      used: "resource_used",
      required: "resource_required",
      deficit: "resource_deficit",
      occupant_task_ids: "resource_occupants",
    };
    if (
      reason === undefined ||
      resourceId === null ||
      Object.entries(expectedKinds).some(
        ([parameterName, factKind]) =>
          !typedParameterMatchesFact(
            description,
            parameterName,
            sourceFacts.find(({ kind }) => kind === factKind),
          ),
      )
    ) {
      addOnce(
        diagnostics,
        diagnostic(
          "PTREC-303",
          `description ${description.id} does not match its resource witness facts`,
        ),
      );
    }
  }
}

function reasonCodes(reasons: readonly RecommendationReasonOccurrence[]): Set<string> {
  return new Set(reasons.map(({ code }) => code));
}

function validateTier(
  decision: RecommendationAnalysis["taskDecisions"][number],
  reasons: readonly RecommendationReasonOccurrence[],
  diagnostics: Diagnostic[],
): void {
  const codes = reasonCodes(reasons);
  const require = (...required: readonly string[]) => {
    for (const code of required) {
      if (!codes.has(code)) {
        addOnce(diagnostics, diagnostic("PTREC-301", `task ${decision.subjectTaskId} tier ${decision.tier} is missing reason ${code}`));
      }
    }
  };
  const forbid = (...forbidden: readonly string[]) => {
    for (const code of forbidden) {
      if (codes.has(code)) {
        addOnce(diagnostics, diagnostic("PTREC-301", `task ${decision.subjectTaskId} tier ${decision.tier} forbids reason ${code}`));
      }
    }
  };
  require("task_ready");
  switch (decision.tier) {
    case "recommended":
      require("recommended_set_selected", "ranking_rule_supports_task");
      forbid("recommended_set_not_selected", "policy_defers_start", "modeled_negative_fact_applies");
      break;
    case "allowed":
      require(
        "recommended_set_not_selected",
        "recommended_set_addition_feasible",
        "ranking_rule_opposes_task",
      );
      forbid("policy_defers_start", "modeled_negative_fact_applies", "recommended_set_resource_conflict");
      break;
    case "deferred":
      require("recommended_set_not_selected");
      if (!codes.has("policy_defers_start") && !codes.has("recommended_set_resource_conflict")) {
        addOnce(diagnostics, diagnostic("PTREC-301", `task ${decision.subjectTaskId} deferred tier has no blocking reason`));
      }
      break;
    case "discouraged":
      require("recommended_set_not_selected", "modeled_negative_fact_applies");
      addOnce(diagnostics, diagnostic("PTREC-302", "reason taxonomy 1.0 cannot produce discouraged tasks"));
      break;
  }
}

export function validateRecommendationAnalysis(
  analysis: RecommendationAnalysis,
): readonly Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (
    analysis.algorithm.id !== "perttool.recommendation-ranking.lexicographic-frontier" ||
    analysis.algorithm.version !== 1 ||
    analysis.algorithm.optimal !== false ||
    analysis.reasonTaxonomyVersion !== "1.0" ||
    analysis.explanationModelVersion !== 1 ||
    analysis.expressionVersion !== 1 ||
    analysis.descriptionRegistryVersion !== 1 ||
    analysis.descriptionLocale !== "en"
  ) {
    addOnce(diagnostics, diagnostic("PTREC-302", "recommendation version identity is not registered"));
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(analysis.sourceDigest)) {
    addOnce(diagnostics, diagnostic("PTREC-301", "recommendation source digest is invalid"));
  }

  const collections: readonly [string, readonly { readonly id: string }[]][] = [
    ["decision step", analysis.decisionSteps],
    ["fact", analysis.facts],
    ["comparison", analysis.comparisons],
    ["reason", analysis.reasonOccurrences],
    ["description", analysis.descriptions],
    ["task decision", analysis.taskDecisions],
  ];
  const allRecordIds = new Set<string>();
  allRecordIds.add(analysis.resultDecision.id);
  for (const [label, records] of collections) {
    for (const record of records) {
      if (!/^rec:(decision|step|fact|comparison|reason|description):/.test(record.id)) {
        addOnce(diagnostics, diagnostic("PTREC-301", `${label} ${record.id} has an invalid record ID`));
      }
      if (allRecordIds.has(record.id)) {
        addOnce(diagnostics, diagnostic("PTREC-301", `record ID ${record.id} is duplicated`));
      }
      allRecordIds.add(record.id);
    }
  }

  const facts = new Map(analysis.facts.map((fact) => [fact.id, fact]));
  const steps = new Map(analysis.decisionSteps.map((step) => [step.id, step]));
  const comparisons = new Map(analysis.comparisons.map((comparison) => [comparison.id, comparison]));
  const reasons = new Map(analysis.reasonOccurrences.map((reason) => [reason.id, reason]));
  const descriptions = new Map(analysis.descriptions.map((description) => [description.id, description]));

  for (const fact of analysis.facts) {
    if (!knownFactKinds.has(fact.kind)) {
      addOnce(diagnostics, diagnostic("PTREC-302", `fact kind ${fact.kind} is not registered`));
    }
    const valueIssue = validateValue(fact.value);
    if (valueIssue !== null) {
      addOnce(diagnostics, diagnostic("PTREC-301", `fact ${fact.id} is invalid: ${valueIssue}`));
    }
    if (fact.provenance.sourceDigest !== analysis.sourceDigest) {
      addOnce(diagnostics, diagnostic("PTREC-301", `fact ${fact.id} provenance digest differs from the result`));
    }
    if (fact.unit !== null && fact.value.type !== "integer" && fact.value.type !== "rational" && fact.value.type !== "map") {
      addOnce(diagnostics, diagnostic("PTREC-301", `fact ${fact.id} uses a unit with a nonnumeric value`));
    }
  }

  const stepIndex = new Map(analysis.decisionSteps.map(({ id }, index) => [id, index]));
  for (const step of analysis.decisionSteps) {
    if (step.rule.kind !== "policy_rule" || !knownRules.has(step.rule.id)) {
      addOnce(diagnostics, diagnostic("PTREC-302", `step ${step.id} uses unregistered rule ${step.rule.id}`));
    }
    for (const factId of step.inputFactIds) {
      if (!facts.has(factId)) addOnce(diagnostics, diagnostic("PTREC-301", `step ${step.id} references missing fact ${factId}`));
    }
    for (const reasonId of step.reasonOccurrenceIds) {
      if (!reasons.has(reasonId)) addOnce(diagnostics, diagnostic("PTREC-301", `step ${step.id} references missing reason ${reasonId}`));
    }
    for (const comparisonId of step.comparisonIds) {
      if (!comparisons.has(comparisonId)) addOnce(diagnostics, diagnostic("PTREC-301", `step ${step.id} references missing comparison ${comparisonId}`));
    }
    for (const dependencyId of step.dependsOnStepIds) {
      const dependencyIndex = stepIndex.get(dependencyId);
      if (dependencyIndex === undefined || dependencyIndex >= stepIndex.get(step.id)!) {
        addOnce(diagnostics, diagnostic("PTREC-301", `step ${step.id} has a missing or non-forward dependency ${dependencyId}`));
      }
    }
    const result = validateExpression(step.expression, facts, diagnostics, `step ${step.id}`);
    if (result !== null && result !== step.result) {
      addOnce(diagnostics, diagnostic("PTREC-301", `step ${step.id} result differs from expression evaluation`));
    }
  }

  for (const comparison of analysis.comparisons) {
    if (comparison.decisiveRule.kind !== "policy_rule" || !knownRules.has(comparison.decisiveRule.id)) {
      addOnce(diagnostics, diagnostic("PTREC-302", `comparison ${comparison.id} uses unregistered rule ${comparison.decisiveRule.id}`));
    }
    for (const factId of comparison.factIds) {
      if (!facts.has(factId)) addOnce(diagnostics, diagnostic("PTREC-301", `comparison ${comparison.id} references missing fact ${factId}`));
    }
    const result = validateExpression(
      comparison.decisiveExpression,
      facts,
      diagnostics,
      `comparison ${comparison.id}`,
    );
    if (result === false) {
      addOnce(diagnostics, diagnostic("PTREC-301", `comparison ${comparison.id} decisive expression is false`));
    }
    if (comparison.winnerTaskId === null && comparison.loserTaskId !== null) {
      addOnce(diagnostics, diagnostic("PTREC-301", `comparison ${comparison.id} has a loser without a winner`));
    }
  }

  for (const reason of analysis.reasonOccurrences) {
    const contract = reasonContract[reason.code];
    if (contract === undefined) {
      addOnce(diagnostics, diagnostic("PTREC-302", `reason code ${String(reason.code)} is not registered`));
      continue;
    }
    if (reason.effect !== contract.effect || !contract.roles.includes(reason.role)) {
      addOnce(diagnostics, diagnostic("PTREC-301", `reason ${reason.id} effect or role violates its taxonomy`));
    }
    const step = steps.get(reason.decisionStepId);
    if (step === undefined || !step.reasonOccurrenceIds.includes(reason.id)) {
      addOnce(diagnostics, diagnostic("PTREC-301", `reason ${reason.id} is not closed through its decision step`));
    }
    const reasonFacts = reason.factIds.map((id) => facts.get(id)).filter((fact): fact is RecommendationFact => fact !== undefined);
    for (const factId of reason.factIds) {
      if (!facts.has(factId)) addOnce(diagnostics, diagnostic("PTREC-301", `reason ${reason.id} references missing fact ${factId}`));
    }
    for (const requiredKind of contract.requiredFactKinds) {
      if (!reasonFacts.some(({ kind }) => kind === requiredKind)) {
        addOnce(diagnostics, diagnostic("PTREC-301", `reason ${reason.id} is missing required fact kind ${requiredKind}`));
      }
    }
    for (const comparisonId of reason.comparisonIds) {
      if (!comparisons.has(comparisonId)) addOnce(diagnostics, diagnostic("PTREC-301", `reason ${reason.id} references missing comparison ${comparisonId}`));
    }
    const result = validateExpression(
      reason.emissionExpression,
      facts,
      diagnostics,
      `reason ${reason.id}`,
    );
    if (result === false) addOnce(diagnostics, diagnostic("PTREC-301", `reason ${reason.id} emission expression is false`));
    if (reason.descriptionId !== null && !descriptions.has(reason.descriptionId)) {
      addOnce(diagnostics, diagnostic("PTREC-301", `reason ${reason.id} references missing description ${reason.descriptionId}`));
    }
  }

  for (const description of analysis.descriptions) {
    validateDescription(description, diagnostics);
    if (
      description.sourceReasonIds.length === 0 &&
      description.sourceComparisonIds.length === 0
    ) {
      addOnce(
        diagnostics,
        diagnostic("PTREC-301", `description ${description.id} has no semantic source`),
      );
    }
    for (const reasonId of description.sourceReasonIds) {
      if (!reasons.has(reasonId)) addOnce(diagnostics, diagnostic("PTREC-301", `description ${description.id} references missing reason ${reasonId}`));
    }
    for (const comparisonId of description.sourceComparisonIds) {
      if (!comparisons.has(comparisonId)) addOnce(diagnostics, diagnostic("PTREC-301", `description ${description.id} references missing comparison ${comparisonId}`));
    }
    validateDescriptionSources(description, facts, comparisons, reasons, diagnostics);
  }

  const resultJointFact = facts.get(analysis.resultDecision.jointFeasibilityFactId);
  if (
    resultJointFact?.kind !== "set_start_feasibility" ||
    resultJointFact.value.type !== "boolean" ||
    resultJointFact.value.value !== true
  ) {
    addOnce(diagnostics, diagnostic("PTREC-301", "result decision does not reference a true recommended-set feasibility fact"));
  }
  for (const id of analysis.resultDecision.stepIds) {
    if (!steps.has(id)) addOnce(diagnostics, diagnostic("PTREC-301", `result decision references missing step ${id}`));
  }
  for (const id of analysis.resultDecision.reasonOccurrenceIds) {
    if (!reasons.has(id)) addOnce(diagnostics, diagnostic("PTREC-301", `result decision references missing reason ${id}`));
  }
  const resultReasons = analysis.resultDecision.reasonOccurrenceIds
    .map((id) => reasons.get(id))
    .filter((reason): reason is RecommendationReasonOccurrence => reason !== undefined);
  if (!resultReasons.some(({ code }) => code === "recommended_set_feasible")) {
    addOnce(diagnostics, diagnostic("PTREC-301", "result decision is missing recommended_set_feasible"));
  }

  const taskIds = new Set<string>();
  const selectedTaskIds: string[] = [];
  for (const decision of analysis.taskDecisions) {
    if (taskIds.has(decision.subjectTaskId)) {
      addOnce(diagnostics, diagnostic("PTREC-301", `task ${decision.subjectTaskId} has multiple decisions`));
    }
    taskIds.add(decision.subjectTaskId);
    if ((decision.tier === "recommended") !== decision.recommendedSetMember) {
      addOnce(diagnostics, diagnostic("PTREC-301", `task ${decision.subjectTaskId} tier and set membership disagree`));
    }
    if (decision.recommendedSetMember) selectedTaskIds.push(decision.subjectTaskId);
    const taskSteps = decision.stepIds.map((id) => steps.get(id));
    if (taskSteps.some((step) => step === undefined) || !decision.stepIds.includes(decision.decisiveStepId)) {
      addOnce(diagnostics, diagnostic("PTREC-301", `task ${decision.subjectTaskId} decision step closure is incomplete`));
    }
    const phases = taskSteps
      .filter((step): step is NonNullable<typeof step> => step !== undefined)
      .map(({ phase }) => phaseRank[phase]);
    if (phases.some((phase, index) => index > 0 && phase < phases[index - 1]!)) {
      addOnce(diagnostics, diagnostic("PTREC-301", `task ${decision.subjectTaskId} decision steps are not phase ordered`));
    }
    const taskReasons = decision.reasonOccurrenceIds
      .map((id) => reasons.get(id))
      .filter((reason): reason is RecommendationReasonOccurrence => reason !== undefined);
    if (taskReasons.length !== decision.reasonOccurrenceIds.length) {
      addOnce(diagnostics, diagnostic("PTREC-301", `task ${decision.subjectTaskId} reason closure is incomplete`));
    }
    for (const comparisonId of decision.comparisonIds) {
      if (!comparisons.has(comparisonId)) addOnce(diagnostics, diagnostic("PTREC-301", `task ${decision.subjectTaskId} references missing comparison ${comparisonId}`));
    }
    const summaryDescription = descriptions.get(decision.summaryDescriptionId);
    if (summaryDescription === undefined) {
      addOnce(diagnostics, diagnostic("PTREC-301", `task ${decision.subjectTaskId} has no summary description`));
    } else {
      const expectedSummaryKey =
        decision.tier === "recommended"
          ? "recommendation.summary.recommended"
          : decision.tier === "allowed"
            ? "recommendation.summary.allowed"
            : decision.tier === "deferred"
              ? "recommendation.summary.deferred_resource"
              : "recommendation.summary.discouraged";
      if (
        summaryDescription.key !== expectedSummaryKey ||
        entityParameterId(summaryDescription, "task_id") !== decision.subjectTaskId
      ) {
        addOnce(
          diagnostics,
          diagnostic(
            "PTREC-303",
            `task ${decision.subjectTaskId} summary does not match its tier or subject`,
          ),
        );
      }
      if (
        decision.tier === "allowed" &&
        entityParameterId(summaryDescription, "higher_priority_task_id") !==
          decision.primaryHigherPriorityTaskId
      ) {
        addOnce(
          diagnostics,
          diagnostic(
            "PTREC-303",
            `task ${decision.subjectTaskId} summary has the wrong higher-priority task`,
          ),
        );
      }
    }
    for (const descriptionId of decision.descriptionIds) {
      if (!descriptions.has(descriptionId)) addOnce(diagnostics, diagnostic("PTREC-301", `task ${decision.subjectTaskId} references missing description ${descriptionId}`));
    }
    validateTier(decision, taskReasons, diagnostics);
  }
  if (
    selectedTaskIds.length !== analysis.recommendedTaskIds.length ||
    selectedTaskIds.some((id, index) => id !== analysis.recommendedTaskIds[index]) ||
    analysis.resultDecision.recommendedTaskIds.some((id, index) => id !== analysis.recommendedTaskIds[index])
  ) {
    addOnce(diagnostics, diagnostic("PTREC-301", "recommended task IDs disagree with task decisions"));
  }

  const factOrder = [...analysis.facts].sort(
    (left, right) =>
      compareStableStrings(left.kind, right.kind) ||
      compareStableStrings(left.subject.kind, right.subject.kind) ||
      compareStableStrings(left.subject.id, right.subject.id) ||
      compareStableStrings(left.id, right.id),
  );
  if (factOrder.some(({ id }, index) => id !== analysis.facts[index]?.id)) {
    addOnce(diagnostics, diagnostic("PTREC-301", "facts are not in canonical order"));
  }
  const stepOrder = [...analysis.decisionSteps].sort(
    (left, right) =>
      phaseRank[left.phase] - phaseRank[right.phase] ||
      compareRules(left.rule.id, right.rule.id) ||
      compareStableStrings(left.id, right.id),
  );
  if (stepOrder.some(({ id }, index) => id !== analysis.decisionSteps[index]?.id)) {
    addOnce(diagnostics, diagnostic("PTREC-301", "decision steps are not in canonical order"));
  }
  const comparisonOrder = [...analysis.comparisons].sort(
    (left, right) =>
      comparisonScopeRank[left.scope] - comparisonScopeRank[right.scope] ||
      compareStableStrings(left.subjectTaskId, right.subjectTaskId) ||
      compareStableStrings(left.alternativeTaskId ?? "", right.alternativeTaskId ?? "") ||
      compareRules(left.decisiveRule.id, right.decisiveRule.id) ||
      compareStableStrings(left.id, right.id),
  );
  if (
    comparisonOrder.some(({ id }, index) => id !== analysis.comparisons[index]?.id)
  ) {
    addOnce(diagnostics, diagnostic("PTREC-301", "comparisons are not in canonical order"));
  }
  const alternativeForReason = (reason: RecommendationReasonOccurrence): string =>
    reason.comparisonIds
      .map((id) => comparisons.get(id)?.alternativeTaskId)
      .find((id) => id !== undefined && id !== null) ?? "";
  const reasonOrder = [...analysis.reasonOccurrences].sort((left, right) => {
    const leftStep = steps.get(left.decisionStepId);
    const rightStep = steps.get(right.decisionStepId);
    return (
      (leftStep === undefined ? Number.MAX_SAFE_INTEGER : phaseRank[leftStep.phase]) -
        (rightStep === undefined ? Number.MAX_SAFE_INTEGER : phaseRank[rightStep.phase]) ||
      compareRules(leftStep?.rule.id ?? "", rightStep?.rule.id ?? "") ||
      compareStableStrings(left.subject.kind, right.subject.kind) ||
      compareStableStrings(left.subject.id, right.subject.id) ||
      compareStableStrings(alternativeForReason(left), alternativeForReason(right)) ||
      compareStableStrings(left.code, right.code) ||
      compareStableStrings(left.id, right.id)
    );
  });
  if (
    reasonOrder.some(({ id }, index) => id !== analysis.reasonOccurrences[index]?.id)
  ) {
    addOnce(
      diagnostics,
      diagnostic("PTREC-301", "reason occurrences are not in canonical order"),
    );
  }
  const taskOrder = new Map(
    analysis.taskDecisions.map(({ subjectTaskId }, index) => [subjectTaskId, index]),
  );
  const descriptionTaskRank = (description: RecommendationDescription): number => {
    for (const reasonId of description.sourceReasonIds) {
      const subject = reasons.get(reasonId)?.subject;
      if (subject?.kind === "task") {
        return taskOrder.get(subject.id) ?? Number.MAX_SAFE_INTEGER;
      }
    }
    return Number.MAX_SAFE_INTEGER;
  };
  const descriptionOrder = [...analysis.descriptions].sort(
    (left, right) =>
      descriptionTaskRank(left) - descriptionTaskRank(right) ||
      compareStableStrings(left.key, right.key) ||
      compareStableStrings(left.id, right.id),
  );
  if (
    descriptionOrder.some(({ id }, index) => id !== analysis.descriptions[index]?.id)
  ) {
    addOnce(diagnostics, diagnostic("PTREC-303", "descriptions are not in canonical order"));
  }
  for (const description of analysis.descriptions) {
    const sortedNames = description.parameters.map(({ name }) => name).sort(compareStableStrings);
    if (sortedNames.some((name, index) => name !== description.parameters[index]?.name)) {
      addOnce(diagnostics, diagnostic("PTREC-303", `description ${description.id} parameters are not canonical`));
    }
  }

  return diagnostics.sort(
    (left, right) => compareStableStrings(left.code, right.code) || compareStableStrings(left.message, right.message),
  );
}
