// R: Render the registered model-2 English description templates and typed parameters.
import { renderRecommendationValue } from "./explanation-values.js";
import { validateValue } from "./explanation-validation.js";
import type { RecommendationValue } from "./explanation-types.js";
import type { RecommendationDescriptionParameter } from "./explanation-types.js";

export const dispatchDescriptionRegistry = [
  {
    "key": "recommendation.reason.assurance_eligible",
    "parameters": {
      "task_id": "task"
    },
    "template": "{task_id} is assurance-eligible."
  },
  {
    "key": "recommendation.reason.assurance_unavailable",
    "parameters": {
      "task_id": "task"
    },
    "template": "{task_id} has unavailable assurance eligibility."
  },
  {
    "key": "recommendation.reason.assurance_withheld",
    "parameters": {
      "task_id": "task"
    },
    "template": "{task_id} has withheld assurance eligibility."
  },
  {
    "key": "recommendation.reason.boundary_group_capacity",
    "parameters": {
      "resource_id": "resource",
      "allocatable_units": "integer",
      "selected_usage": "integer",
      "remaining_units": "integer",
      "rank_group": "integer"
    },
    "template": "Rank group {rank_group} has {allocatable_units} units of {resource_id} allocatable, {selected_usage} selected and {remaining_units} remaining."
  },
  {
    "key": "recommendation.reason.maximum_task_count",
    "parameters": {
      "selected_count": "integer",
      "eligible_count": "integer"
    },
    "template": "Selected {selected_count} tasks from {eligible_count} eligible ready tasks to maximize simultaneous starts."
  },
  {
    "key": "recommendation.reason.rank_group_counts",
    "parameters": {
      "counts": "integer_list"
    },
    "template": "Selected counts by semantic rank group are {counts}."
  },
  {
    "key": "recommendation.reason.ranking_rule_opposes_task",
    "parameters": {
      "task_id": "task",
      "alternative_task_id": "task",
      "rule_id": "policy_rule"
    },
    "template": "{alternative_task_id} precedes {task_id} under ranking rule {rule_id}."
  },
  {
    "key": "recommendation.reason.ranking_rule_supports_task",
    "parameters": {
      "task_id": "task",
      "alternative_task_id": "task",
      "rule_id": "policy_rule"
    },
    "template": "{task_id} precedes {alternative_task_id} under ranking rule {rule_id}."
  },
  {
    "key": "recommendation.reason.ranking_rule_tied",
    "parameters": {
      "task_id": "task",
      "alternative_task_id": "task",
      "rule_id": "policy_rule"
    },
    "template": "{task_id} and {alternative_task_id} tie under ranking rule {rule_id}."
  },
  {
    "key": "recommendation.reason.recommended_set_feasible",
    "parameters": {},
    "template": "The selected set is jointly resource-feasible."
  },
  {
    "key": "recommendation.reason.recommended_set_not_selected",
    "parameters": {
      "task_id": "task"
    },
    "template": "{task_id} is outside the selected set."
  },
  {
    "key": "recommendation.reason.recommended_set_resource_conflict",
    "parameters": {
      "task_id": "task",
      "resource_id": "resource",
      "required_units": "integer",
      "remaining_units": "integer"
    },
    "template": "{task_id} requires {required_units} units of {resource_id}, with {remaining_units} units remaining."
  },
  {
    "key": "recommendation.reason.recommended_set_selected",
    "parameters": {
      "task_id": "task"
    },
    "template": "{task_id} belongs to the selected set."
  },
  {
    "key": "recommendation.reason.task_id_tiebreak",
    "parameters": {
      "task_ids": "task_list"
    },
    "template": "The canonical selected task order is {task_ids}."
  },
  {
    "key": "recommendation.reason.task_ready",
    "parameters": {
      "task_id": "task"
    },
    "template": "{task_id} is ready."
  },
  {
    "key": "recommendation.reason.time_eligibility_unavailable",
    "parameters": {
      "task_id": "task"
    },
    "template": "{task_id} has unavailable time eligibility."
  },
  {
    "key": "recommendation.reason.time_eligible",
    "parameters": {
      "task_id": "task"
    },
    "template": "{task_id} is time-eligible."
  },
  {
    "key": "recommendation.reason.time_ineligible",
    "parameters": {
      "task_id": "task"
    },
    "template": "{task_id} is awaiting its release bound."
  },
  {
    "key": "recommendation.summary.recommended",
    "parameters": {
      "task_id": "task"
    },
    "template": "{task_id} is selected under the maximum-task-count objective."
  },
  {
    "key": "recommendation.summary.deferred",
    "parameters": {
      "task_id": "task",
      "reason_code": "enum"
    },
    "template": "{task_id} is deferred by {reason_code}."
  }
] as const;

function parameterMatches(expected: string, value: RecommendationValue): boolean {
  if (validateValue(value) !== null) return false;
  switch (expected) {
    case "integer": return value.type === "integer";
    case "enum": return value.type === "enum";
    case "integer_list": return value.type === "list" && value.itemType === "integer";
    case "task_list": return value.type === "list" && value.itemType === "entity:task";
    default: return value.type === "entity" && value.value.kind === expected;
  }
}

export function renderDispatchDescription(key: string, parameters: readonly RecommendationDescriptionParameter[]): string {
  const entry = dispatchDescriptionRegistry.find((item) => item.key === key);
  if (entry === undefined) throw new Error(`unregistered dispatch description ${key}`);
  const names = parameters.map((parameter) => parameter.name).sort();
  const expected = Object.keys(entry.parameters).sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) throw new Error(`invalid dispatch description parameters ${key}`);
  let text: string = entry.template;
  for (const parameter of parameters) {
    const expected = (entry.parameters as Readonly<Record<string, string>>)[parameter.name]!;
    if (!parameterMatches(expected, parameter.value)) throw new Error(`invalid dispatch parameter type ${parameter.name}`);
    text = text.replaceAll(`{${parameter.name}}`, renderRecommendationValue(parameter.value, null));
  }
  return text;
}
