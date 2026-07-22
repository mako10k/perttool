import type { Diagnostic } from "../model/diagnostics.js";
import type {
  DeclarationNode,
  DocumentNode,
  FieldNode,
  RequirementValue,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type {
  AddTaskMutation,
  SetTaskMutation,
  TaskDefinition,
  TaskEstimateInput,
  TaskFieldSet,
  TaskMutation,
  TaskRequirementInput,
} from "./types.js";
import type { TextEdit } from "./text-edits.js";

export interface TaskMutationPlan {
  readonly edits: readonly TextEdit[];
  readonly diagnostic?: Diagnostic;
}

interface PhysicalLine {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly endWithEnding: number;
}

const fieldOrder = [
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
] as const;

const fieldRank = new Map<string, number>(
  fieldOrder.map((name, index) => [name, name === "estimate" ? 2 : index]),
);
fieldRank.set("duration", 2);

const bareTagPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const taskStatuses = new Set(["planned", "active", "blocked", "done"]);
const clearableFields = new Set([
  "description",
  "status",
  "priority",
  "owner",
  "blocked_reason",
  "source",
  "tags",
  "requires",
]);

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

function taskDefinitionError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object") return "task definitionがobjectではありません";
  const task = value as Record<string, unknown>;
  const knownFields = new Set([
    "title",
    "description",
    "duration",
    "estimate",
    "status",
    "priority",
    "requirements",
    "owner",
    "tags",
    "blockedReason",
    "source",
  ]);
  if (Object.keys(task).some((name) => !knownFields.has(name))) {
    return "task definitionに未対応fieldが含まれています";
  }
  if (typeof task["title"] !== "string") return "task titleがstringではありません";
  if ((task["duration"] === undefined) === (task["estimate"] === undefined)) {
    return "durationまたはestimateのexactly oneを必要とします";
  }
  if (task["duration"] !== undefined && typeof task["duration"] !== "string") {
    return "durationがstringではありません";
  }
  if (task["estimate"] !== undefined && !validEstimate(task["estimate"])) {
    return "estimateはoptimistic、mostLikely、pessimisticのstringを必要とします";
  }
  for (const name of ["description", "owner", "blockedReason", "source"] as const) {
    if (task[name] !== undefined && typeof task[name] !== "string") {
      return `${name}がstringではありません`;
    }
  }
  if (task["status"] !== undefined && !taskStatuses.has(task["status"] as string)) {
    return "statusがtask statusではありません";
  }
  if (task["priority"] !== undefined && !Number.isSafeInteger(task["priority"])) {
    return "priorityがsafe integerではありません";
  }
  if (task["tags"] !== undefined && !validStringArray(task["tags"])) {
    return "tagsがstring arrayではありません";
  }
  if (
    task["requirements"] !== undefined &&
    (!Array.isArray(task["requirements"]) || !task["requirements"].every(validRequirement))
  ) {
    return "requirementsがresourceIdとsafe integer unitsのarrayではありません";
  }
  return undefined;
}

function mutationDiagnostic(
  code: "PTMUT-301" | "PTMUT-302" | "PTMUT-303" | "PTMUT-304",
  message: string,
  entity?: DeclarationNode,
): Diagnostic {
  return {
    code,
    severity: "error",
    message,
    helpTopic: "editing",
    ...(entity === undefined ? {} : { entityId: entity.id, span: entity.idSpan }),
  };
}

function taskMutationRequestError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "mutation requestがobjectではありません";
  }
  const request = value as Record<string, unknown>;
  const kind = request["kind"];
  if (
    kind !== "task.add" &&
    kind !== "task.set" &&
    kind !== "task.remove" &&
    kind !== "task.finish"
  ) {
    return "mutation kindが未対応です";
  }
  if (typeof request["id"] !== "string") return "mutation idがstringではありません";
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
    return `${kind} requestに未対応fieldが含まれています`;
  }
  return undefined;
}

function splitPhysicalLines(text: string): readonly PhysicalLine[] {
  if (text.length === 0) return [];
  const lines: PhysicalLine[] = [];
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf("\n", start);
    if (newline === -1) {
      lines.push({ text: text.slice(start), start, end: text.length, endWithEnding: text.length });
      break;
    }
    const end = newline > start && text[newline - 1] === "\r" ? newline - 1 : newline;
    lines.push({ text: text.slice(start, end), start, end, endWithEnding: newline + 1 });
    start = newline + 1;
  }
  return lines;
}

function majorLineEnding(text: string): "\n" | "\r\n" {
  let lf = 0;
  let crlf = 0;
  let first: "\n" | "\r\n" | undefined;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "\n") continue;
    const ending = index > 0 && text[index - 1] === "\r" ? "\r\n" : "\n";
    first ??= ending;
    if (ending === "\r\n") crlf += 1;
    else lf += 1;
  }
  if (lf === crlf) return first ?? "\n";
  return crlf > lf ? "\r\n" : "\n";
}

function lineIndexAt(lines: readonly PhysicalLine[], offset: number): number {
  const index = lines.findIndex(
    (line, lineIndex) =>
      offset >= line.start &&
      (offset < line.endWithEnding ||
        (lineIndex === lines.length - 1 && offset === line.endWithEnding)),
  );
  if (index === -1) throw new Error("mutation span does not resolve to a physical line");
  return index;
}

function contentEndOffset(
  field: FieldNode,
  lines: readonly PhysicalLine[],
): number {
  let offset = field.span.end.offset;
  if (field.children !== undefined && field.children.length > 0) {
    offset = field.children[field.children.length - 1]!.span.end.offset;
  } else if (field.name === "requires" && Array.isArray(field.value) && field.value.length > 0) {
    offset = (field.value[field.value.length - 1] as RequirementValue).span.end.offset;
  } else if (field.contentSpan !== undefined) {
    offset = field.contentSpan.end.offset;
  }
  return lines[lineIndexAt(lines, offset)]!.endWithEnding;
}

function contentTextEndOffset(
  field: FieldNode,
  lines: readonly PhysicalLine[],
): number {
  let offset = field.span.end.offset;
  if (field.children !== undefined && field.children.length > 0) {
    offset = field.children[field.children.length - 1]!.span.end.offset;
  } else if (field.name === "requires" && Array.isArray(field.value) && field.value.length > 0) {
    offset = (field.value[field.value.length - 1] as RequirementValue).span.end.offset;
  } else if (field.contentSpan !== undefined) {
    offset = field.contentSpan.end.offset;
  }
  return lines[lineIndexAt(lines, offset)]!.end;
}

function declarationContentEndOffset(
  declaration: DeclarationNode,
  lines: readonly PhysicalLine[],
): number {
  const lastField = declaration.fields[declaration.fields.length - 1];
  const offset = lastField?.span.end.offset ?? declaration.headerSpan.end.offset;
  return lastField === undefined
    ? lines[lineIndexAt(lines, offset)]!.endWithEnding
    : contentEndOffset(lastField, lines);
}

function leadingCommentStart(
  lines: readonly PhysicalLine[],
  elementStart: number,
  indentation: number,
): number {
  let index = lineIndexAt(lines, elementStart) - 1;
  let start = elementStart;
  while (index >= 0) {
    const line = lines[index]!;
    const match = /^( *)(#.*)$/.exec(line.text);
    if (match === null || match[1]!.length !== indentation) break;
    start = line.start;
    index -= 1;
  }
  return start;
}

function deleteFieldEdit(
  field: FieldNode,
  lines: readonly PhysicalLine[],
): TextEdit {
  return {
    startOffset: leadingCommentStart(lines, field.span.start.offset, 2),
    endOffset: contentEndOffset(field, lines),
    replacement: "",
  };
}

function deleteDeclarationEdit(
  declaration: DeclarationNode,
  lines: readonly PhysicalLine[],
): TextEdit {
  return {
    startOffset: leadingCommentStart(lines, declaration.headerSpan.start.offset, 0),
    endOffset: declarationContentEndOffset(declaration, lines),
    replacement: "",
  };
}

function canonicalDuration(value: string): string {
  const match = /^(\d+)(?:\.(\d+))?([dhp])$/.exec(value);
  if (match === null) return value;
  const whole = match[1]!.replace(/^0+(?=\d)/, "");
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  return `${whole}${fraction === "" ? "" : `.${fraction}`}${match[3]}`;
}

function serializeTag(tag: string): string {
  return bareTagPattern.test(tag) ? tag : JSON.stringify(tag);
}

function serializeTags(tags: readonly string[]): string {
  return `[${tags.map(serializeTag).join(", ")}]`;
}

function serializeTextField(name: string, value: string, lineEnding: string): string {
  if (
    !value.includes("\n") ||
    value.includes("\r") ||
    value.startsWith("\n") ||
    value.endsWith("\n")
  ) {
    return `  ${name} ${JSON.stringify(value)}`;
  }
  return [
    `  ${name} |`,
    ...value.split("\n").map((line) => (line === "" ? "" : `    ${line}`)),
  ].join(lineEnding);
}

function serializeEstimate(estimate: TaskEstimateInput, lineEnding: string): string {
  return [
    "  estimate:",
    `    optimistic ${canonicalDuration(estimate.optimistic)}`,
    `    most_likely ${canonicalDuration(estimate.mostLikely)}`,
    `    pessimistic ${canonicalDuration(estimate.pessimistic)}`,
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
      return `  duration ${canonicalDuration(value as string)}`;
    case "estimate":
      return serializeEstimate(value as TaskEstimateInput, lineEnding);
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

function taskFields(task: TaskDefinition): ReadonlyMap<string, unknown> {
  const fields = new Map<string, unknown>([["title", task.title]]);
  if (task.description !== undefined) fields.set("description", task.description);
  if (task.duration !== undefined) fields.set("duration", task.duration);
  if (task.estimate !== undefined) fields.set("estimate", task.estimate);
  if (task.status !== undefined) fields.set("status", task.status);
  if (task.priority !== undefined) fields.set("priority", task.priority);
  if (task.requirements !== undefined) fields.set("requires", task.requirements);
  if (task.owner !== undefined) fields.set("owner", task.owner);
  if (task.tags !== undefined) fields.set("tags", task.tags);
  if (task.blockedReason !== undefined) fields.set("blocked_reason", task.blockedReason);
  if (task.source !== undefined) fields.set("source", task.source);
  return fields;
}

function serializeTask(mutation: AddTaskMutation, lineEnding: string): string {
  const fields = taskFields(mutation.task);
  return [
    `task ${mutation.id} ${mutation.from} -> ${mutation.to}:`,
    ...fieldOrder.flatMap((name) => {
      if (name === "duration" && fields.has("estimate")) return [];
      if (name === "estimate" && fields.has("duration")) return [];
      return fields.has(name) ? [serializeField(name, fields.get(name), lineEnding)] : [];
    }),
  ].join(lineEnding);
}

function addTaskPlan(text: string, mutation: AddTaskMutation): TaskMutationPlan {
  const task = mutation.task as TaskDefinition & {
    readonly duration?: string;
    readonly estimate?: TaskEstimateInput;
  };
  const taskError = taskDefinitionError(task);
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
        `task.add requestが不正です${taskError === undefined ? "" : `: ${taskError}`}`,
      ),
    };
  }
  const lineEnding = majorLineEnding(text);
  const lines = splitPhysicalLines(text);
  const trailingBlank =
    text.endsWith("\n") && lines.length > 0 && lines[lines.length - 1]!.text.trim() === "";
  const prefix = text.length === 0
    ? ""
    : trailingBlank
      ? ""
      : text.endsWith("\n")
        ? lineEnding
        : `${lineEnding}${lineEnding}`;
  return {
    edits: [{
      startOffset: text.length,
      endOffset: text.length,
      replacement: `${prefix}${serializeTask(mutation, lineEnding)}${lineEnding}`,
    }],
  };
}

function setRequestError(mutation: SetTaskMutation): string | undefined {
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
    return "setがobjectではありません";
  }
  for (const [name, value] of [
    ["clear", rawClear],
    ["addTags", rawAddTags],
    ["removeTags", rawRemoveTags],
    ["upsertRequirements", rawUpsertRequirements],
    ["removeRequirements", rawRemoveRequirements],
  ] as const) {
    if (value !== undefined && !Array.isArray(value)) return `${name}がarrayではありません`;
  }
  const set = (rawSet ?? {}) as TaskFieldSet;
  const setEntries = Object.entries(set).filter(([, value]) => value !== undefined);
  const clear = (rawClear ?? []) as NonNullable<SetTaskMutation["clear"]>;
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
    return "task.setは少なくとも1つの変更指定を必要とします";
  }
  if (set.duration !== undefined && set.estimate !== undefined) {
    return "durationとestimateは同時にsetできません";
  }
  if (mutation.from !== undefined && typeof mutation.from !== "string") {
    return "fromがstringではありません";
  }
  if (mutation.to !== undefined && typeof mutation.to !== "string") {
    return "toがstringではありません";
  }
  const knownSetFields = new Set([
    "title",
    "description",
    "duration",
    "estimate",
    "status",
    "priority",
    "owner",
    "blockedReason",
    "source",
  ]);
  if (Object.keys(set).some((name) => !knownSetFields.has(name))) {
    return "setに未対応fieldが含まれています";
  }
  for (const name of ["title", "description", "duration", "owner", "blockedReason", "source"] as const) {
    if (set[name] !== undefined && typeof set[name] !== "string") {
      return `${name}がstringではありません`;
    }
  }
  if (set.estimate !== undefined && !validEstimate(set.estimate)) {
    return "estimateはoptimistic、mostLikely、pessimisticのstringを必要とします";
  }
  if (set.status !== undefined && !taskStatuses.has(set.status)) {
    return "statusがtask statusではありません";
  }
  if (set.priority !== undefined && !Number.isSafeInteger(set.priority)) {
    return "priorityがsafe integerではありません";
  }
  if (!Array.isArray(clear) || clear.some((name) => !clearableFields.has(name))) {
    return "clearに未対応fieldが含まれています";
  }
  if (!validStringArray(addTags) || !validStringArray(removeTags)) {
    return "addTagsとremoveTagsはstring arrayである必要があります";
  }
  if (
    !Array.isArray(upsertRequirements) ||
    !upsertRequirements.every(validRequirement) ||
    !validStringArray(removeRequirements)
  ) {
    return "requirement変更指定が不正です";
  }
  if (new Set(clear).size !== clear.length) return "clear fieldが重複しています";
  const clearNames = new Set(clear);
  const setToClear: Readonly<Record<keyof TaskFieldSet, string>> = {
    title: "title",
    description: "description",
    duration: "duration",
    estimate: "estimate",
    status: "status",
    priority: "priority",
    owner: "owner",
    blockedReason: "blocked_reason",
    source: "source",
  };
  for (const [name] of setEntries) {
    if (clearNames.has(setToClear[name as keyof TaskFieldSet] as never)) {
      return `${setToClear[name as keyof TaskFieldSet]}をsetとclearへ同時指定できません`;
    }
  }
  if (clearNames.has("tags") && (addTags.length > 0 || removeTags.length > 0)) {
    return "clear tagsとadd/remove tagは併用できません";
  }
  if (
    clearNames.has("requires") &&
    (upsertRequirements.length > 0 || removeRequirements.length > 0)
  ) {
    return "clear requiresとupsert/remove requirementは併用できません";
  }
  const removedTags = new Set(removeTags);
  if (addTags.some((tag) => removedTags.has(tag))) {
    return "同じtagをaddとremoveへ同時指定できません";
  }
  const removedResources = new Set(removeRequirements);
  if (upsertRequirements.some(({ resourceId }) => removedResources.has(resourceId))) {
    return "同じresourceをupsertとremoveへ同時指定できません";
  }
  const upsertIds = upsertRequirements.map(({ resourceId }) => resourceId);
  if (new Set(upsertIds).size !== upsertIds.length) {
    return "upsert requirementのresourceが重複しています";
  }
  return undefined;
}

function fieldInsertionOffset(
  declaration: DeclarationNode,
  name: string,
  deleted: ReadonlySet<string>,
  lines: readonly PhysicalLine[],
): number {
  const rank = fieldRank.get(name)!;
  const later = declaration.fields.find(
    (field) => !deleted.has(field.name) && (fieldRank.get(field.name) ?? 99) > rank,
  );
  if (later !== undefined) {
    return leadingCommentStart(lines, later.span.start.offset, 2);
  }
  const surviving = declaration.fields.filter((field) => !deleted.has(field.name)).at(-1);
  if (surviving === undefined) throw new Error("task mutation removed every field");
  return contentEndOffset(surviving, lines);
}

function insertionText(
  text: string,
  offset: number,
  serializedFields: readonly string[],
  lineEnding: string,
): string {
  const prefix = offset > 0 && text[offset - 1] !== "\n" ? lineEnding : "";
  const suffix = offset < text.length || text.endsWith("\n") ? lineEnding : "";
  return `${prefix}${serializedFields.join(lineEnding)}${suffix}`;
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
  mutation: SetTaskMutation,
): TaskMutationPlan {
  const error = setRequestError(mutation);
  if (error !== undefined) {
    return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", error, task) };
  }
  const lines = splitPhysicalLines(text);
  const lineEnding = majorLineEnding(text);
  const edits: TextEdit[] = [];
  const deleted = new Set<string>(mutation.clear ?? []);
  const additions = new Map<number, Array<{ name: string; serialized: string }>>();

  const queueAddition = (name: string, value: unknown): void => {
    const offset = fieldInsertionOffset(task, name, deleted, lines);
    const entries = additions.get(offset) ?? [];
    entries.push({ name, serialized: serializeField(name, value, lineEnding) });
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
  if (set.title !== undefined) setScalar("title", set.title, JSON.stringify(set.title));
  if (set.description !== undefined) setText("description", set.description);
  if (set.duration !== undefined) {
    const duration = fieldNamed(task, "duration");
    const estimate = fieldNamed(task, "estimate");
    if (duration !== undefined) {
      setScalar("duration", set.duration, canonicalDuration(set.duration));
    } else if (estimate !== undefined) {
      edits.push({
        startOffset: estimate.span.start.offset,
        endOffset: contentTextEndOffset(estimate, lines),
        replacement: serializeField("duration", set.duration, lineEnding),
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
          replacement: canonicalDuration(value),
        });
      }
    } else if (duration !== undefined) {
      edits.push({
        startOffset: duration.span.start.offset,
        endOffset: contentTextEndOffset(duration, lines),
        replacement: serializeEstimate(set.estimate, lineEnding),
      });
    }
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
      (left, right) => (fieldRank.get(left.name) ?? 99) - (fieldRank.get(right.name) ?? 99),
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
  mutation: TaskMutation,
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
          `entity ID ${mutation.id}はすでに使用されています`,
          entity,
        ),
      };
    }
    return addTaskPlan(text, mutation);
  }
  if (entity === undefined) {
    return {
      edits: [],
      diagnostic: mutationDiagnostic(
        "PTMUT-302",
        `task ${mutation.id}が存在しません`,
      ),
    };
  }
  if (entity.kind !== "task") {
    return {
      edits: [],
      diagnostic: mutationDiagnostic(
        "PTMUT-303",
        `entity ${mutation.id}はtaskではありません`,
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
    });
  }
  return planSetTask(text, entity, mutation);
}
