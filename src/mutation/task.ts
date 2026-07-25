import type { Diagnostic } from "../model/diagnostics.js";
import type {
  DeclarationNode,
  DocumentNode,
  FieldNode,
  RequirementValue,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import {
  GRAMMAR_1_DECLARATION_FIELD_ORDER,
  TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER,
} from "../model/declaration-fields.js";
import {
  canonicalizeExactDurationSourceToken,
} from "../model/exact-duration-source.js";
import { mutationDiagnostic } from "./diagnostics.js";
import type {
  TargetTaskDefinition,
  TargetTaskFieldSet,
  TargetTaskMutation,
  TargetSetTaskMutation,
} from "./target-types.js";
import type {
  AddTaskMutation,
  SetTaskMutation,
  TaskDefinition,
  TaskEstimateInput,
  TaskFieldSet,
  TaskMutation,
  TaskRequirementInput,
} from "./types.js";
import {
  appendDeclarationEdit,
  contentEndOffset,
  contentTextEndOffset,
  deleteDeclarationEdit,
  deleteFieldEdit,
  fieldInsertionOffset,
  insertionText,
  leadingCommentStart,
  lineIndexAt,
  majorLineEnding,
  serializeTags,
  serializeTextField,
  splitPhysicalLines,
} from "./source.js";
import type { TextEdit } from "./text-edits.js";

export interface TaskMutationPlan {
  readonly edits: readonly TextEdit[];
  readonly diagnostic?: Diagnostic;
}

export interface TaskMutationProfile {
  readonly fieldOrder: readonly string[];
  readonly temporalFields: boolean;
  readonly exactDurations: boolean;
}

export const ACTIVE_TASK_MUTATION_PROFILE: TaskMutationProfile = Object.freeze({
  fieldOrder: GRAMMAR_1_DECLARATION_FIELD_ORDER.task,
  temporalFields: false,
  exactDurations: false,
});

export const TARGET_GRAMMAR_2_TASK_MUTATION_PROFILE: TaskMutationProfile =
  Object.freeze({
    fieldOrder: TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER.task,
    temporalFields: true,
    exactDurations: false,
  });

export const TARGET_GRAMMAR_3_TASK_MUTATION_PROFILE: TaskMutationProfile =
  Object.freeze({
    fieldOrder: TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER.task,
    temporalFields: true,
    exactDurations: true,
});

type SupportedTaskMutation = TaskMutation | TargetTaskMutation;
type SupportedTaskDefinition = TaskDefinition | TargetTaskDefinition;
type SupportedTaskFieldSet = TaskFieldSet | TargetTaskFieldSet;
type SupportedSetTaskMutation = SetTaskMutation | TargetSetTaskMutation;

const taskStatuses = new Set(["planned", "active", "blocked", "done"]);
const activeClearableFields = [
  "description",
  "status",
  "priority",
  "owner",
  "blocked_reason",
  "source",
  "tags",
  "requires",
] as const;

function fieldRank(profile: TaskMutationProfile): ReadonlyMap<string, number> {
  return new Map(profile.fieldOrder.map((name, index) => [name, index]));
}

function validEstimate(value: unknown): value is TaskEstimateInput {
  if (value === null || typeof value !== "object") return false;
  const estimate = value as Partial<TaskEstimateInput>;
  return (
    typeof estimate.optimistic === "string" &&
    typeof estimate.mostLikely === "string" &&
    typeof estimate.pessimistic === "string"
  );
}

function validRequirement(value: unknown): value is TaskRequirementInput {
  if (value === null || typeof value !== "object") return false;
  const requirement = value as Partial<TaskRequirementInput>;
  return (
    typeof requirement.resourceId === "string" &&
    Number.isSafeInteger(requirement.units)
  );
}

function validStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function taskDefinitionError(
  value: unknown,
  profile: TaskMutationProfile,
): string | undefined {
  if (value === null || typeof value !== "object") return "task definition is not an object";
  const task = value as Record<string, unknown>;
  const knownFields = new Set([
    "title",
    "description",
    "duration",
    "estimate",
    ...(profile.temporalFields ? ["notBefore", "deadline"] : []),
    "status",
    "priority",
    "requirements",
    "owner",
    "tags",
    "blockedReason",
    "source",
  ]);
  if (Object.keys(task).some((name) => !knownFields.has(name))) {
    return "task definition contains unsupported fields";
  }
  if (typeof task["title"] !== "string") return "task title is not a string";
  if ((task["duration"] === undefined) === (task["estimate"] === undefined)) {
    return "exactly one of duration or estimate is required";
  }
  if (task["duration"] !== undefined && typeof task["duration"] !== "string") {
    return "duration is not a string";
  }
  if (task["estimate"] !== undefined && !validEstimate(task["estimate"])) {
    return "estimate requires optimistic, mostLikely, and pessimistic string fields";
  }
  for (const name of [
    "description",
    "owner",
    "blockedReason",
    "source",
    ...(profile.temporalFields ? ["notBefore", "deadline"] as const : []),
  ] as const) {
    if (task[name] !== undefined && typeof task[name] !== "string") {
      return `${name} is not a string`;
    }
  }
  if (task["status"] !== undefined && !taskStatuses.has(task["status"] as string)) {
    return "status is not a task status";
  }
  if (task["priority"] !== undefined && !Number.isSafeInteger(task["priority"])) {
    return "priority is not a safe integer";
  }
  if (task["tags"] !== undefined && !validStringArray(task["tags"])) {
    return "tags are not a string array";
  }
  if (
    task["requirements"] !== undefined &&
    (!Array.isArray(task["requirements"]) || !task["requirements"].every(validRequirement))
  ) {
    return "requirements must be an array of entries with resourceId and safe integer units";
  }
  return undefined;
}

function taskMutationRequestError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "mutation request is not an object";
  }
  const request = value as Record<string, unknown>;
  const kind = request["kind"];
  if (
    kind !== "task.add" &&
    kind !== "task.set" &&
    kind !== "task.remove" &&
    kind !== "task.finish"
  ) {
    return "mutation kind is unsupported";
  }
  if (typeof request["id"] !== "string") return "mutation id is not a string";
  const fieldsByKind: Readonly<Record<string, ReadonlySet<string>>> = {
    "task.add": new Set(["kind", "id", "from", "to", "task"]),
    "task.set": new Set([
      "kind",
      "id",
      "from",
      "to",
      "set",
      "clear",
      "addTags",
      "removeTags",
      "upsertRequirements",
      "removeRequirements",
    ]),
    "task.remove": new Set(["kind", "id"]),
    "task.finish": new Set(["kind", "id"]),
  };
  if (Object.keys(request).some((name) => !fieldsByKind[kind]!.has(name))) {
    return `${kind} request contains unsupported fields`;
  }
  return undefined;
}

function canonicalDuration(
  value: string,
  profile: TaskMutationProfile,
): string {
  if (profile.exactDurations) {
    return canonicalizeExactDurationSourceToken(value)?.token ?? value;
  }
  const match = /^(\d+)(?:\.(\d+))?([dhp])$/.exec(value);
  if (match === null) return value;
  const whole = match[1]!.replace(/^0+(?=\d)/, "");
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  return `${whole}${fraction === "" ? "" : `.${fraction}`}${match[3]}`;
}

function serializeEstimate(
  estimate: TaskEstimateInput,
  lineEnding: string,
  profile: TaskMutationProfile,
): string {
  return [
    "  estimate:",
    `    optimistic ${canonicalDuration(estimate.optimistic, profile)}`,
    `    most_likely ${canonicalDuration(estimate.mostLikely, profile)}`,
    `    pessimistic ${canonicalDuration(estimate.pessimistic, profile)}`,
  ].join(lineEnding);
}

function serializeRequirements(
  requirements: readonly TaskRequirementInput[],
  lineEnding: string,
): string {
  return [
    "  requires:",
    ...requirements.map(({ resourceId, units }) => `    ${resourceId} ${units}`),
  ].join(lineEnding);
}

function serializeField(
  name: string,
  value: unknown,
  lineEnding: string,
  profile: TaskMutationProfile,
): string {
  switch (name) {
    case "title":
    case "owner":
    case "source":
      return `  ${name} ${JSON.stringify(value)}`;
    case "description":
    case "blocked_reason":
      return serializeTextField(name, value as string, lineEnding);
    case "duration":
      return `  duration ${canonicalDuration(value as string, profile)}`;
    case "estimate":
      return serializeEstimate(value as TaskEstimateInput, lineEnding, profile);
    case "not_before":
    case "deadline":
      return `  ${name} ${value}`;
    case "status":
    case "priority":
      return `  ${name} ${value}`;
    case "tags":
      return `  tags ${serializeTags(value as readonly string[])}`;
    case "requires":
      return serializeRequirements(value as readonly TaskRequirementInput[], lineEnding);
    default:
      throw new Error(`unsupported task field ${name}`);
  }
}

function taskFields(task: SupportedTaskDefinition): ReadonlyMap<string, unknown> {
  const fields = new Map<string, unknown>([["title", task.title]]);
  if (task.description !== undefined) fields.set("description", task.description);
  if (task.duration !== undefined) fields.set("duration", task.duration);
  if (task.estimate !== undefined) fields.set("estimate", task.estimate);
  if ("notBefore" in task && task.notBefore !== undefined) {
    fields.set("not_before", task.notBefore);
  }
  if ("deadline" in task && task.deadline !== undefined) {
    fields.set("deadline", task.deadline);
  }
  if (task.status !== undefined) fields.set("status", task.status);
  if (task.priority !== undefined) fields.set("priority", task.priority);
  if (task.requirements !== undefined) fields.set("requires", task.requirements);
  if (task.owner !== undefined) fields.set("owner", task.owner);
  if (task.tags !== undefined) fields.set("tags", task.tags);
  if (task.blockedReason !== undefined) fields.set("blocked_reason", task.blockedReason);
  if (task.source !== undefined) fields.set("source", task.source);
  return fields;
}

function serializeTask(
  mutation: AddTaskMutation | TargetTaskMutation,
  lineEnding: string,
  profile: TaskMutationProfile,
): string {
  if (mutation.kind !== "task.add") {
    throw new Error("task serializer requires task.add");
  }
  const fields = taskFields(mutation.task);
  return [
    `task ${mutation.id} ${mutation.from} -> ${mutation.to}:`,
    ...profile.fieldOrder.flatMap((name) => {
      if (name === "duration" && fields.has("estimate")) return [];
      if (name === "estimate" && fields.has("duration")) return [];
      return fields.has(name)
        ? [serializeField(name, fields.get(name), lineEnding, profile)]
        : [];
    }),
  ].join(lineEnding);
}

function addTaskPlan(
  text: string,
  mutation: AddTaskMutation | Extract<TargetTaskMutation, { kind: "task.add" }>,
  profile: TaskMutationProfile,
): TaskMutationPlan {
  const task = mutation.task as SupportedTaskDefinition & {
    readonly duration?: string;
    readonly estimate?: TaskEstimateInput;
  };
  const taskError = taskDefinitionError(task, profile);
  if (
    typeof mutation.id !== "string" ||
    typeof mutation.from !== "string" ||
    typeof mutation.to !== "string" ||
    taskError !== undefined
  ) {
    return {
      edits: [],
      diagnostic: mutationDiagnostic(
        "PTMUT-301",
        `task.add request is invalid${taskError === undefined ? "" : `: ${taskError}`}`,
      ),
    };
  }
  const lineEnding = majorLineEnding(text);
  return {
    edits: [
      appendDeclarationEdit(
        text,
        serializeTask(mutation, lineEnding, profile),
        lineEnding,
      ),
    ],
  };
}

function setRequestError(
  mutation: SupportedSetTaskMutation,
  profile: TaskMutationProfile,
): string | undefined {
  const rawSet = mutation.set as unknown;
  const rawClear = mutation.clear as unknown;
  const rawAddTags = mutation.addTags as unknown;
  const rawRemoveTags = mutation.removeTags as unknown;
  const rawUpsertRequirements = mutation.upsertRequirements as unknown;
  const rawRemoveRequirements = mutation.removeRequirements as unknown;
  if (
    rawSet !== undefined &&
    (rawSet === null || typeof rawSet !== "object" || Array.isArray(rawSet))
  ) {
    return "set is not an object";
  }
  for (const [name, value] of [
    ["clear", rawClear],
    ["addTags", rawAddTags],
    ["removeTags", rawRemoveTags],
    ["upsertRequirements", rawUpsertRequirements],
    ["removeRequirements", rawRemoveRequirements],
  ] as const) {
    if (value !== undefined && !Array.isArray(value)) return `${name} is not an array`;
  }
  const set = (rawSet ?? {}) as SupportedTaskFieldSet;
  const setEntries = Object.entries(set).filter(([, value]) => value !== undefined);
  const clear = (rawClear ?? []) as readonly string[];
  const addTags = (rawAddTags ?? []) as NonNullable<SetTaskMutation["addTags"]>;
  const removeTags = (rawRemoveTags ?? []) as NonNullable<SetTaskMutation["removeTags"]>;
  const upsertRequirements = (rawUpsertRequirements ?? []) as NonNullable<SetTaskMutation["upsertRequirements"]>;
  const removeRequirements = (rawRemoveRequirements ?? []) as NonNullable<SetTaskMutation["removeRequirements"]>;
  if (
    mutation.from === undefined &&
    mutation.to === undefined &&
    setEntries.length === 0 &&
    clear.length === 0 &&
    addTags.length === 0 &&
    removeTags.length === 0 &&
    upsertRequirements.length === 0 &&
    removeRequirements.length === 0
  ) {
    return "task.set requires at least one change specification";
  }
  if (set.duration !== undefined && set.estimate !== undefined) {
    return "duration and estimate cannot both be specified in set";
  }
  if (mutation.from !== undefined && typeof mutation.from !== "string") {
    return "from is not a string";
  }
  if (mutation.to !== undefined && typeof mutation.to !== "string") {
    return "to is not a string";
  }
  const knownSetFields = new Set([
    "title",
    "description",
    "duration",
    "estimate",
    ...(profile.temporalFields ? ["notBefore", "deadline"] : []),
    "status",
    "priority",
    "owner",
    "blockedReason",
    "source",
  ]);
  if (Object.keys(set).some((name) => !knownSetFields.has(name))) {
    return "set contains unsupported fields";
  }
  for (const name of [
    "title",
    "description",
    "duration",
    "owner",
    "blockedReason",
    "source",
    ...(profile.temporalFields ? ["notBefore", "deadline"] as const : []),
  ] as const) {
    if ((set as Record<string, unknown>)[name] !== undefined &&
        typeof (set as Record<string, unknown>)[name] !== "string") {
      return `${name} is not a string`;
    }
  }
  if (set.estimate !== undefined && !validEstimate(set.estimate)) {
    return "estimate requires optimistic, mostLikely, and pessimistic string fields";
  }
  if (set.status !== undefined && !taskStatuses.has(set.status)) {
    return "status is not a task status";
  }
  if (set.priority !== undefined && !Number.isSafeInteger(set.priority)) {
    return "priority is not a safe integer";
  }
  const clearableFields = new Set([
    ...activeClearableFields,
    ...(profile.temporalFields ? ["not_before", "deadline"] : []),
  ]);
  if (!Array.isArray(clear) || clear.some((name) => !clearableFields.has(name))) {
    return "clear contains unsupported fields";
  }
  if (!validStringArray(addTags) || !validStringArray(removeTags)) {
    return "addTags and removeTags must be string arrays";
  }
  if (
    !Array.isArray(upsertRequirements) ||
    !upsertRequirements.every(validRequirement) ||
    !validStringArray(removeRequirements)
  ) {
    return "requirement change specification is invalid";
  }
  if (new Set(clear).size !== clear.length) return "clear contains duplicate fields";
  const clearNames = new Set(clear);
  const setToClear: Readonly<Record<string, string>> = {
    title: "title",
    description: "description",
    duration: "duration",
    estimate: "estimate",
    ...(profile.temporalFields
      ? { notBefore: "not_before", deadline: "deadline" }
      : {}),
    status: "status",
    priority: "priority",
    owner: "owner",
    blockedReason: "blocked_reason",
    source: "source",
  };
  for (const [name] of setEntries) {
    if (clearNames.has(setToClear[name]!)) {
      return `${setToClear[name]} cannot be specified in both set and clear`;
    }
  }
  if (clearNames.has("tags") && (addTags.length > 0 || removeTags.length > 0)) {
    return "clear tags cannot be combined with add/remove tags";
  }
  if (
    clearNames.has("requires") &&
    (upsertRequirements.length > 0 || removeRequirements.length > 0)
  ) {
    return "clear requires cannot be combined with upsert/remove requirements";
  }
  const removedTags = new Set(removeTags);
  if (addTags.some((tag) => removedTags.has(tag))) {
    return "the same tag cannot be specified in both add and remove";
  }
  const removedResources = new Set(removeRequirements);
  if (upsertRequirements.some(({ resourceId }) => removedResources.has(resourceId))) {
    return "the same resource cannot be specified in both upsert and remove";
  }
  const upsertIds = upsertRequirements.map(({ resourceId }) => resourceId);
  if (new Set(upsertIds).size !== upsertIds.length) {
    return "upsert requirements contain duplicate resources";
  }
  return undefined;
}

function currentTags(task: DeclarationNode): readonly string[] {
  const value = fieldNamed(task, "tags")?.value;
  return Array.isArray(value)
    ? value.filter((tag): tag is string => typeof tag === "string")
    : [];
}

function currentRequirements(task: DeclarationNode): readonly TaskRequirementInput[] {
  const value = fieldNamed(task, "requires")?.value;
  return Array.isArray(value)
    ? value.map(({ resourceId, units }: RequirementValue) => ({ resourceId, units }))
    : [];
}

function planSetTask(
  text: string,
  task: DeclarationNode,
  mutation: SupportedSetTaskMutation,
  profile: TaskMutationProfile,
): TaskMutationPlan {
  const error = setRequestError(mutation, profile);
  if (error !== undefined) {
    return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", error, task) };
  }
  const lines = splitPhysicalLines(text);
  const lineEnding = majorLineEnding(text);
  const edits: TextEdit[] = [];
  const deleted = new Set<string>(mutation.clear ?? []);
  const additions = new Map<number, Array<{ name: string; serialized: string }>>();
  const rank = fieldRank(profile);

  const queueAddition = (name: string, value: unknown): void => {
    const offset = fieldInsertionOffset(task, name, deleted, lines, rank);
    const entries = additions.get(offset) ?? [];
    entries.push({
      name,
      serialized: serializeField(name, value, lineEnding, profile),
    });
    additions.set(offset, entries);
  };
  const setScalar = (name: string, value: unknown, valueText: string): void => {
    const field = fieldNamed(task, name);
    if (field === undefined) queueAddition(name, value);
    else edits.push({
      startOffset: field.valueSpan.start.offset,
      endOffset: field.valueSpan.end.offset,
      replacement: valueText,
    });
  };
  const setText = (name: "description" | "blocked_reason", value: string): void => {
    const field = fieldNamed(task, name);
    if (field === undefined) {
      queueAddition(name, value);
    } else if (field.contentSpan === undefined && !value.includes("\n")) {
      edits.push({
        startOffset: field.valueSpan.start.offset,
        endOffset: field.valueSpan.end.offset,
        replacement: JSON.stringify(value),
      });
    } else {
      edits.push({
        startOffset: field.span.start.offset,
        endOffset: contentTextEndOffset(field, lines),
        replacement: serializeTextField(name, value, lineEnding),
      });
    }
  };

  if (mutation.from !== undefined) {
    edits.push({
      startOffset: task.fromSpan!.start.offset,
      endOffset: task.fromSpan!.end.offset,
      replacement: mutation.from,
    });
  }
  if (mutation.to !== undefined) {
    edits.push({
      startOffset: task.toSpan!.start.offset,
      endOffset: task.toSpan!.end.offset,
      replacement: mutation.to,
    });
  }

  const set = mutation.set ?? {};
  const targetSet = set as TargetTaskFieldSet;
  if (set.title !== undefined) setScalar("title", set.title, JSON.stringify(set.title));
  if (set.description !== undefined) setText("description", set.description);
  if (set.duration !== undefined) {
    const duration = fieldNamed(task, "duration");
    const estimate = fieldNamed(task, "estimate");
    if (duration !== undefined) {
      setScalar(
        "duration",
        set.duration,
        canonicalDuration(set.duration, profile),
      );
    } else if (estimate !== undefined) {
      edits.push({
        startOffset: estimate.span.start.offset,
        endOffset: contentTextEndOffset(estimate, lines),
        replacement: serializeField(
          "duration",
          set.duration,
          lineEnding,
          profile,
        ),
      });
    }
  }
  if (set.estimate !== undefined) {
    const estimate = fieldNamed(task, "estimate");
    const duration = fieldNamed(task, "duration");
    if (estimate !== undefined) {
      for (const [name, value] of [
        ["optimistic", set.estimate.optimistic],
        ["most_likely", set.estimate.mostLikely],
        ["pessimistic", set.estimate.pessimistic],
      ] as const) {
        const child = estimate.children!.find((candidate) => candidate.name === name)!;
        edits.push({
          startOffset: child.valueSpan.start.offset,
          endOffset: child.valueSpan.end.offset,
          replacement: canonicalDuration(value, profile),
        });
      }
    } else if (duration !== undefined) {
      edits.push({
        startOffset: duration.span.start.offset,
        endOffset: contentTextEndOffset(duration, lines),
        replacement: serializeEstimate(set.estimate, lineEnding, profile),
      });
    }
  }
  if (profile.temporalFields && targetSet.notBefore !== undefined) {
    setScalar("not_before", targetSet.notBefore, targetSet.notBefore);
  }
  if (profile.temporalFields && targetSet.deadline !== undefined) {
    setScalar("deadline", targetSet.deadline, targetSet.deadline);
  }
  if (set.status !== undefined) setScalar("status", set.status, set.status);
  if (set.priority !== undefined) setScalar("priority", set.priority, String(set.priority));
  if (set.owner !== undefined) setScalar("owner", set.owner, JSON.stringify(set.owner));
  if (set.blockedReason !== undefined) setText("blocked_reason", set.blockedReason);
  if (set.source !== undefined) setScalar("source", set.source, JSON.stringify(set.source));

  if ((mutation.clear ?? []).includes("tags")) {
    deleted.add("tags");
  } else if ((mutation.addTags?.length ?? 0) > 0 || (mutation.removeTags?.length ?? 0) > 0) {
    const removed = new Set(mutation.removeTags ?? []);
    const final = currentTags(task).filter((tag) => !removed.has(tag));
    for (const tag of mutation.addTags ?? []) {
      if (!final.includes(tag)) final.push(tag);
    }
    const tags = fieldNamed(task, "tags");
    if (final.length === 0) {
      if (tags !== undefined) deleted.add("tags");
    } else if (tags === undefined) {
      queueAddition("tags", final);
    } else {
      edits.push({
        startOffset: tags.valueSpan.start.offset,
        endOffset: tags.valueSpan.end.offset,
        replacement: serializeTags(final),
      });
    }
  }

  if ((mutation.clear ?? []).includes("requires")) {
    deleted.add("requires");
  } else if (
    (mutation.upsertRequirements?.length ?? 0) > 0 ||
    (mutation.removeRequirements?.length ?? 0) > 0
  ) {
    const removed = new Set(mutation.removeRequirements ?? []);
    const current = currentRequirements(task);
    const upserts = new Map(
      (mutation.upsertRequirements ?? []).map((requirement) => [
        requirement.resourceId,
        requirement,
      ]),
    );
    const final = current
      .filter(({ resourceId }) => !removed.has(resourceId))
      .map((requirement) => upserts.get(requirement.resourceId) ?? requirement);
    for (const requirement of mutation.upsertRequirements ?? []) {
      if (!current.some(({ resourceId }) => resourceId === requirement.resourceId)) {
        final.push(requirement);
      }
    }
    const requires = fieldNamed(task, "requires");
    if (final.length === 0) {
      if (requires !== undefined) deleted.add("requires");
    } else if (requires === undefined) {
      queueAddition("requires", final);
    } else {
      const original = requires.value as readonly RequirementValue[];
      const surviving = original.filter(({ resourceId }) => !removed.has(resourceId));
      const appended = final.filter(
        ({ resourceId }) => !original.some((candidate) => candidate.resourceId === resourceId),
      );
      if (surviving.length === 0) {
        edits.push({
          startOffset: requires.span.start.offset,
          endOffset: contentTextEndOffset(requires, lines),
          replacement: serializeRequirements(final, lineEnding),
        });
      } else {
        for (const requirement of original) {
          if (removed.has(requirement.resourceId)) {
            edits.push({
              startOffset: leadingCommentStart(lines, requirement.span.start.offset, 4),
              endOffset: lines[lineIndexAt(lines, requirement.span.end.offset)]!.endWithEnding,
              replacement: "",
            });
            continue;
          }
          const updated = upserts.get(requirement.resourceId);
          if (updated !== undefined) {
            edits.push({
              startOffset: requirement.unitsSpan.start.offset,
              endOffset: requirement.unitsSpan.end.offset,
              replacement: String(updated.units),
            });
          }
        }
        if (appended.length > 0) {
          const last = surviving[surviving.length - 1]!;
          const offset = lines[lineIndexAt(lines, last.span.end.offset)]!.endWithEnding;
          edits.push({
            startOffset: offset,
            endOffset: offset,
            replacement: insertionText(
              text,
              offset,
              appended.map(({ resourceId, units }) => `    ${resourceId} ${units}`),
              lineEnding,
            ),
          });
        }
      }
    }
  }

  for (const name of deleted) {
    const field = fieldNamed(task, name);
    if (field !== undefined) edits.push(deleteFieldEdit(field, lines));
  }
  for (const [offset, entries] of additions) {
    entries.sort(
      (left, right) => (rank.get(left.name) ?? 99) - (rank.get(right.name) ?? 99),
    );
    edits.push({
      startOffset: offset,
      endOffset: offset,
      replacement: insertionText(
        text,
        offset,
        entries.map(({ serialized }) => serialized),
        lineEnding,
      ),
    });
  }
  return { edits };
}

export function planTaskMutationEdits(
  text: string,
  document: DocumentNode,
  mutation: SupportedTaskMutation,
  profile: TaskMutationProfile = ACTIVE_TASK_MUTATION_PROFILE,
): TaskMutationPlan {
  const requestError = taskMutationRequestError(mutation);
  if (requestError !== undefined) {
    return {
      edits: [],
      diagnostic: mutationDiagnostic("PTMUT-301", requestError),
    };
  }
  const entity = document.declarations.find(({ id }) => id === mutation.id);
  if (mutation.kind === "task.add") {
    if (entity !== undefined) {
      return {
        edits: [],
        diagnostic: mutationDiagnostic(
          "PTMUT-304",
          `entity ID ${mutation.id} is already in use`,
          entity,
        ),
      };
    }
    return addTaskPlan(text, mutation, profile);
  }
  if (entity === undefined) {
    return {
      edits: [],
      diagnostic: mutationDiagnostic(
        "PTMUT-302",
        `task ${mutation.id} does not exist`,
      ),
    };
  }
  if (entity.kind !== "task") {
    return {
      edits: [],
      diagnostic: mutationDiagnostic(
        "PTMUT-303",
        `entity ${mutation.id} is not a task`,
        entity,
      ),
    };
  }
  const lines = splitPhysicalLines(text);
  if (mutation.kind === "task.remove") {
    return { edits: [deleteDeclarationEdit(entity, lines)] };
  }
  if (mutation.kind === "task.finish") {
    return planSetTask(text, entity, {
      kind: "task.set",
      id: mutation.id,
      set: { status: "done" },
      ...(fieldNamed(entity, "blocked_reason") === undefined
        ? {}
        : { clear: ["blocked_reason"] }),
    }, profile);
  }
  return planSetTask(text, entity, mutation, profile);
}
