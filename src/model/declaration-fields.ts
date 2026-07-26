import type { DeclarationKind } from "./syntax.js";

function freezeFieldOrder<
  const T extends Readonly<Record<DeclarationKind, readonly string[]>>,
>(fieldOrder: T): T {
  for (const fields of Object.values(fieldOrder)) Object.freeze(fields);
  return Object.freeze(fieldOrder);
}

export const GRAMMAR_1_DECLARATION_FIELD_ORDER = freezeFieldOrder({
  project: [
    "version",
    "title",
    "description",
    "as_of",
    "duration_unit",
    "velocity",
    "finish",
    "critical_epsilon",
    "target_duration",
  ],
  resource: ["title", "description", "capacity", "tags"],
  milestone: ["title", "description", "state", "tags"],
  task: [
    "title",
    "description",
    "duration",
    "estimate",
    "status",
    "priority",
    "requires",
    "owner",
    "tags",
    "blocked_reason",
    "source",
  ],
  gate: ["reason"],
} as const satisfies Readonly<Record<DeclarationKind, readonly string[]>>);

export const TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER = freezeFieldOrder({
  ...GRAMMAR_1_DECLARATION_FIELD_ORDER,
  milestone: ["title", "description", "state", "deadline", "tags"],
  task: [
    "title",
    "description",
    "duration",
    "estimate",
    "not_before",
    "deadline",
    "status",
    "priority",
    "requires",
    "owner",
    "tags",
    "blocked_reason",
    "source",
  ],
} as const satisfies Readonly<Record<DeclarationKind, readonly string[]>>);

export const TARGET_GRAMMAR_4_DECLARATION_FIELD_ORDER = freezeFieldOrder({
  ...TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER,
  project: [
    "version",
    "title",
    "description",
    "as_of",
    "duration_unit",
    "velocity",
    "finish",
    "goal_owner",
    "goal_delegates",
    "dag_owner",
    "dag_delegates",
    "critical_epsilon",
    "target_duration",
  ],
} as const satisfies Readonly<Record<DeclarationKind, readonly string[]>>);
