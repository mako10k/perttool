import { compareStableStrings } from "../model/diagnostics.js";
import { durationSuffix } from "../model/units.js";
import type {
  RecommendationDescriptionParameter,
  RecommendationExpression,
  RecommendationExpressionTerm,
  RecommendationFact,
  RecommendationScalarValue,
  RecommendationUnit,
  RecommendationValue,
} from "./explanation-types.js";

const descriptionTemplates = {
  "recommendation.summary.recommended":
    "{task_id} is recommended by rule {decisive_rule_id}.",
  "recommendation.summary.allowed":
    "{task_id} is allowed as additional work, but {higher_priority_task_id} ranks higher by rule {decisive_rule_id}.",
  "recommendation.summary.deferred_resource":
    "{task_id} is deferred because resources {resource_ids} cannot fit it with the recommended set; selected blockers: {higher_priority_task_ids}; active blockers: {active_blocker_task_ids}.",
  "recommendation.summary.deferred_policy":
    "{task_id} is deferred by rule {decisive_rule_id}.",
  "recommendation.summary.discouraged":
    "{task_id} is discouraged because {negative_fact_kind} applies under rule {decisive_rule_id}.",
  "recommendation.reason.ranking_comparison":
    "{winner_task_id} ranks above {alternative_task_id} by rule {rule_id}: {winner_value} {relation} {alternative_value}.",
  "recommendation.reason.resource_conflict":
    "{task_id} cannot be added on {resource_id}: capacity {capacity}, used {used}, required {required}, deficit {deficit}, occupants {occupant_task_ids}.",
  "recommendation.reason.policy_deferral":
    "{task_id} is deferred by policy rule {rule_id}.",
  "recommendation.reason.negative_fact":
    "{task_id} is discouraged because {negative_fact_kind} applies under rule {rule_id}.",
} as const;

const requiredParameters: Readonly<Record<keyof typeof descriptionTemplates, readonly string[]>> = {
  "recommendation.summary.recommended": ["decisive_rule_id", "task_id"],
  "recommendation.summary.allowed": [
    "decisive_rule_id",
    "higher_priority_task_id",
    "task_id",
  ],
  "recommendation.summary.deferred_resource": [
    "active_blocker_task_ids",
    "higher_priority_task_ids",
    "resource_ids",
    "task_id",
  ],
  "recommendation.summary.deferred_policy": ["decisive_rule_id", "task_id"],
  "recommendation.summary.discouraged": [
    "decisive_rule_id",
    "negative_fact_kind",
    "task_id",
  ],
  "recommendation.reason.ranking_comparison": [
    "alternative_task_id",
    "alternative_value",
    "relation",
    "rule_id",
    "winner_task_id",
    "winner_value",
  ],
  "recommendation.reason.resource_conflict": [
    "capacity",
    "deficit",
    "occupant_task_ids",
    "required",
    "resource_id",
    "task_id",
    "used",
  ],
  "recommendation.reason.policy_deferral": ["rule_id", "task_id"],
  "recommendation.reason.negative_fact": [
    "negative_fact_kind",
    "rule_id",
    "task_id",
  ],
};

export const recommendationDescriptionKeys = Object.keys(descriptionTemplates).sort(
  compareStableStrings,
);

function unitKey(unit: RecommendationUnit | null): string {
  if (unit === null) return "-";
  if (unit.kind === "duration") return `duration:${unit.value}`;
  if (unit.kind === "resource") {
    return `resource:${unit.resource.kind}:${unit.resource.id}`;
  }
  return "ratio";
}

function scalarKey(value: RecommendationScalarValue): string {
  switch (value.type) {
    case "boolean":
      return `boolean:${value.value ? "true" : "false"}`;
    case "integer":
      return `integer:${BigInt(value.value).toString()}`;
    case "rational":
      return `rational:${BigInt(value.numerator).toString()}/${BigInt(value.denominator).toString()}`;
    case "enum":
      return `enum:${value.enumType}:${value.value}`;
    case "entity":
      return `entity:${value.value.kind}:${value.value.id}`;
  }
}

export function recommendationValueKey(value: RecommendationValue): string {
  if (value.type !== "list" && value.type !== "set" && value.type !== "map") {
    return scalarKey(value);
  }
  if (value.type === "map") {
    return `map:${value.keyType}:${value.valueType}:${value.entries
      .map(({ key, value: item }) => `${scalarKey(key)}=${scalarKey(item)}`)
      .join(",")}`;
  }
  return `${value.type}:${value.itemType}:${value.items.map(scalarKey).join(",")}`;
}

function sameUnit(left: RecommendationUnit | null, right: RecommendationUnit | null): boolean {
  return unitKey(left) === unitKey(right);
}

function scalarType(value: RecommendationScalarValue): string {
  return value.type === "enum" ? `enum:${value.enumType}` : value.type;
}

function orderedEnumRank(value: Extract<RecommendationScalarValue, { type: "enum" }>): bigint | string {
  switch (value.enumType) {
    case "precedence_critical_class": {
      const ranks: Readonly<Record<string, bigint>> = {
        driving: 0n,
        near_critical: 1n,
        non_critical: 2n,
      };
      const rank = ranks[value.value];
      if (rank === undefined) throw new Error(`unknown critical class ${value.value}`);
      return rank;
    }
    case "structural_distance":
      return value.value === "infinity" ? "infinity" : BigInt(value.value);
    case "task_id_ascii":
      return value.value;
    default:
      throw new Error(`enum ${value.enumType} is not ordered`);
  }
}

function compareScalar(
  left: RecommendationScalarValue,
  right: RecommendationScalarValue,
): number {
  if (scalarType(left) !== scalarType(right)) {
    throw new Error("expression scalar type mismatch");
  }
  switch (left.type) {
    case "boolean":
      return left.value === (right as typeof left).value ? 0 : left.value ? 1 : -1;
    case "integer": {
      const difference = BigInt(left.value) - BigInt((right as typeof left).value);
      return difference < 0n ? -1 : difference > 0n ? 1 : 0;
    }
    case "rational": {
      const other = right as typeof left;
      const difference =
        BigInt(left.numerator) * BigInt(other.denominator) -
        BigInt(other.numerator) * BigInt(left.denominator);
      return difference < 0n ? -1 : difference > 0n ? 1 : 0;
    }
    case "enum": {
      const other = right as typeof left;
      if (left.value === other.value) return 0;
      const leftRank = orderedEnumRank(left);
      const rightRank = orderedEnumRank(other);
      if (leftRank === "infinity") return 1;
      if (rightRank === "infinity") return -1;
      return leftRank < rightRank ? -1 : 1;
    }
    case "entity": {
      const other = right as typeof left;
      if (left.value.kind !== other.value.kind) {
        throw new Error("expression entity kind mismatch");
      }
      return compareStableStrings(left.value.id, other.value.id);
    }
  }
}

function resolveTerm(
  term: RecommendationExpressionTerm,
  facts: ReadonlyMap<string, RecommendationFact>,
): { readonly value: RecommendationValue; readonly unit: RecommendationUnit | null } {
  if (term.kind === "literal") return term;
  const fact = facts.get(term.factId);
  if (fact === undefined) throw new Error(`expression fact ${term.factId} does not exist`);
  return { value: fact.value, unit: fact.unit };
}

function collectionContains(collection: RecommendationValue, item: RecommendationValue): boolean {
  if (collection.type === "set") {
    if (item.type === "list" || item.type === "set" || item.type === "map") {
      throw new Error("collection contains requires a scalar item");
    }
    return collection.items.some((candidate) => scalarKey(candidate) === scalarKey(item));
  }
  if (collection.type === "map") {
    if (item.type === "list" || item.type === "set" || item.type === "map") {
      throw new Error("map contains requires a scalar key");
    }
    return collection.entries.some(({ key }) => scalarKey(key) === scalarKey(item));
  }
  throw new Error("contains requires a set or map on the left");
}

export function evaluateRecommendationExpression(
  expression: RecommendationExpression,
  facts: ReadonlyMap<string, RecommendationFact>,
  depth = 1,
): boolean {
  if (depth > 8) throw new Error("expression exceeds maximum depth 8");
  if (expression.kind === "all" || expression.kind === "any") {
    if (expression.children.length === 0) throw new Error(`${expression.kind} is empty`);
    const values = expression.children.map((child) =>
      evaluateRecommendationExpression(child, facts, depth + 1),
    );
    return expression.kind === "all" ? values.every(Boolean) : values.some(Boolean);
  }
  const left = resolveTerm(expression.left, facts);
  const right = resolveTerm(expression.right, facts);
  if (expression.relation === "contains") {
    if (left.unit !== null || right.unit !== null) {
      throw new Error("contains terms must be unitless");
    }
    return collectionContains(left.value, right.value);
  }
  if (!sameUnit(left.unit, right.unit)) throw new Error("expression unit mismatch");
  if (expression.relation === "equal" || expression.relation === "not_equal") {
    const equal = recommendationValueKey(left.value) === recommendationValueKey(right.value);
    return expression.relation === "equal" ? equal : !equal;
  }
  if (
    left.value.type === "list" ||
    left.value.type === "set" ||
    left.value.type === "map" ||
    right.value.type === "list" ||
    right.value.type === "set" ||
    right.value.type === "map"
  ) {
    throw new Error("ordered relation requires scalar values");
  }
  const ordering = compareScalar(left.value, right.value);
  switch (expression.relation) {
    case "less_than":
      return ordering < 0;
    case "less_or_equal":
      return ordering <= 0;
    case "greater_than":
      return ordering > 0;
    case "greater_or_equal":
      return ordering >= 0;
  }
}

function renderScalar(value: RecommendationScalarValue): string {
  switch (value.type) {
    case "boolean":
      return value.value ? "true" : "false";
    case "integer":
      return BigInt(value.value).toString();
    case "rational": {
      const numerator = BigInt(value.numerator).toString();
      const denominator = BigInt(value.denominator).toString();
      return denominator === "1" ? numerator : `${numerator}/${denominator}`;
    }
    case "enum":
      return value.value;
    case "entity":
      return value.value.id;
  }
}

export function renderRecommendationValue(
  value: RecommendationValue,
  unit: RecommendationUnit | null,
): string {
  let rendered: string;
  if (value.type === "map") {
    rendered = `[${value.entries
      .map(({ key, value: item }) => `${renderScalar(key)}=${renderScalar(item)}`)
      .join(", ")}]`;
  } else if (value.type === "list" || value.type === "set") {
    rendered = `[${value.items.map(renderScalar).join(", ")}]`;
  } else {
    rendered = renderScalar(value);
  }
  if (unit === null) return rendered;
  if (unit.kind === "duration") return `${rendered}${durationSuffix(unit.value)}`;
  if (unit.kind === "resource") return `${rendered} ${unit.resource.id}-units`;
  return `${rendered} ratio`;
}

export function renderRecommendationDescription(
  key: string,
  parameters: readonly RecommendationDescriptionParameter[],
): string {
  if (!(key in descriptionTemplates)) throw new Error(`unknown description key ${key}`);
  const typedKey = key as keyof typeof descriptionTemplates;
  const names = parameters.map(({ name }) => name);
  const canonicalNames = [...names].sort(compareStableStrings);
  if (new Set(names).size !== names.length || names.some((name, index) => name !== canonicalNames[index])) {
    throw new Error(`description ${key} parameters are not unique and sorted`);
  }
  const required = requiredParameters[typedKey];
  if (required.length !== names.length || required.some((name, index) => name !== names[index])) {
    throw new Error(`description ${key} parameter contract mismatch`);
  }
  const values = new Map(
    parameters.map(({ name, value, unit }) => [name, renderRecommendationValue(value, unit)]),
  );
  return descriptionTemplates[typedKey].replace(/\{([a-z_]+)\}/g, (_match, name: string) => {
    const value = values.get(name);
    if (value === undefined) throw new Error(`description ${key} is missing ${name}`);
    return value;
  });
}
