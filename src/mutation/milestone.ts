import type { DeclarationNode, DocumentNode } from "../model/syntax.js";
import { EntityEditor, stringList } from "./entity-editor.js";
import { mutationDiagnostic, type MutationEditPlan } from "./diagnostics.js";
import { appendDeclarationEdit, deleteDeclarationEdit, majorLineEnding, serializeTags, serializeTextField, splitPhysicalLines } from "./source.js";
import type {
  AddMilestoneMutation,
  MilestoneDefinition,
  MilestoneFieldSet,
  MilestoneMutation,
  SetMilestoneMutation,
} from "./types.js";

const fieldOrder = ["title", "description", "state", "tags"] as const;
const states = new Set(["planned", "reached"]);
const clearableFields = new Set(["description", "state", "tags"]);

function validStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function requestShapeError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "milestone mutation requestがobjectではありません";
  }
  const request = value as Record<string, unknown>;
  const kind = request["kind"];
  if (kind !== "milestone.add" && kind !== "milestone.set" && kind !== "milestone.remove") {
    return "milestone mutation kindが未対応です";
  }
  if (typeof request["id"] !== "string") return "milestone idがstringではありません";
  const fieldsByKind: Readonly<Record<string, ReadonlySet<string>>> = {
    "milestone.add": new Set(["kind", "id", "milestone"]),
    "milestone.set": new Set(["kind", "id", "set", "clear", "addTags", "removeTags"]),
    "milestone.remove": new Set(["kind", "id"]),
  };
  if (Object.keys(request).some((name) => !fieldsByKind[kind]!.has(name))) {
    return `${kind} requestに未対応fieldが含まれています`;
  }
  return undefined;
}

function definitionError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "milestone definitionがobjectではありません";
  }
  const milestone = value as Record<string, unknown>;
  if (Object.keys(milestone).some((name) => !fieldOrder.includes(name as never))) {
    return "milestone definitionに未対応fieldが含まれています";
  }
  if (typeof milestone["title"] !== "string") return "milestone titleがstringではありません";
  if (milestone["description"] !== undefined && typeof milestone["description"] !== "string") {
    return "milestone descriptionがstringではありません";
  }
  if (milestone["state"] !== undefined && !states.has(milestone["state"] as string)) {
    return "milestone stateがplanned/reachedではありません";
  }
  if (milestone["tags"] !== undefined && !validStringArray(milestone["tags"])) {
    return "milestone tagsがstring arrayではありません";
  }
  return undefined;
}

function serializeMilestone(
  mutation: AddMilestoneMutation,
  lineEnding: string,
): string {
  const definition = mutation.milestone;
  return [
    `milestone ${mutation.id}:`,
    `  title ${JSON.stringify(definition.title)}`,
    ...(definition.description === undefined
      ? []
      : [serializeTextField("description", definition.description, lineEnding)]),
    ...(definition.state === undefined ? [] : [`  state ${definition.state}`]),
    ...(definition.tags === undefined ? [] : [`  tags ${serializeTags(definition.tags)}`]),
  ].join(lineEnding);
}

function setRequestError(mutation: SetMilestoneMutation): string | undefined {
  const rawSet = mutation.set as unknown;
  const rawClear = mutation.clear as unknown;
  const rawAddTags = mutation.addTags as unknown;
  const rawRemoveTags = mutation.removeTags as unknown;
  if (
    rawSet !== undefined &&
    (rawSet === null || typeof rawSet !== "object" || Array.isArray(rawSet))
  ) {
    return "milestone setがobjectではありません";
  }
  for (const [name, value] of [
    ["clear", rawClear],
    ["addTags", rawAddTags],
    ["removeTags", rawRemoveTags],
  ] as const) {
    if (value !== undefined && !Array.isArray(value)) return `${name}がarrayではありません`;
  }
  const set = (rawSet ?? {}) as MilestoneFieldSet;
  const clear = (rawClear ?? []) as NonNullable<SetMilestoneMutation["clear"]>;
  const addTags = (rawAddTags ?? []) as NonNullable<SetMilestoneMutation["addTags"]>;
  const removeTags = (rawRemoveTags ?? []) as NonNullable<SetMilestoneMutation["removeTags"]>;
  const setEntries = Object.entries(set).filter(([, item]) => item !== undefined);
  if (
    setEntries.length === 0 &&
    clear.length === 0 &&
    addTags.length === 0 &&
    removeTags.length === 0
  ) {
    return "milestone.setは少なくとも1つの変更指定を必要とします";
  }
  if (Object.keys(set).some((name) => !["title", "description", "state"].includes(name))) {
    return "milestone setに未対応fieldが含まれています";
  }
  if (set.title !== undefined && typeof set.title !== "string") return "titleがstringではありません";
  if (set.description !== undefined && typeof set.description !== "string") {
    return "descriptionがstringではありません";
  }
  if (set.state !== undefined && !states.has(set.state)) {
    return "stateがplanned/reachedではありません";
  }
  if (!Array.isArray(clear) || clear.some((name) => !clearableFields.has(name))) {
    return "clearに未対応fieldが含まれています";
  }
  if (new Set(clear).size !== clear.length) return "clear fieldが重複しています";
  const clearNames = new Set(clear);
  for (const [setName, clearName] of [
    ["description", "description"],
    ["state", "state"],
  ] as const) {
    if (set[setName] !== undefined && clearNames.has(clearName)) {
      return `${clearName}をsetとclearへ同時指定できません`;
    }
  }
  if (!validStringArray(addTags) || !validStringArray(removeTags)) {
    return "addTagsとremoveTagsはstring arrayである必要があります";
  }
  if (clearNames.has("tags") && (addTags.length > 0 || removeTags.length > 0)) {
    return "clear tagsとadd/remove tagは併用できません";
  }
  const removed = new Set(removeTags);
  if (addTags.some((tag) => removed.has(tag))) {
    return "同じtagをaddとremoveへ同時指定できません";
  }
  return undefined;
}

function planSet(
  text: string,
  declaration: DeclarationNode,
  mutation: SetMilestoneMutation,
): MutationEditPlan {
  const error = setRequestError(mutation);
  if (error !== undefined) {
    return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", error, declaration) };
  }
  const editor = new EntityEditor(text, declaration, fieldOrder, mutation.clear ?? []);
  const set = mutation.set ?? {};
  if (set.title !== undefined) editor.setScalar("title", JSON.stringify(set.title));
  if (set.description !== undefined) editor.setText("description", set.description);
  if (set.state !== undefined) editor.setScalar("state", set.state);
  if (!(mutation.clear ?? []).includes("tags")) {
    const removed = new Set(mutation.removeTags ?? []);
    const tags = stringList(editor.fieldValue("tags")).filter((tag) => !removed.has(tag));
    for (const tag of mutation.addTags ?? []) {
      if (!tags.includes(tag)) tags.push(tag);
    }
    if ((mutation.addTags?.length ?? 0) > 0 || (mutation.removeTags?.length ?? 0) > 0) {
      editor.setTags(tags);
    }
  }
  return { edits: editor.finish() };
}

export function planMilestoneMutationEdits(
  text: string,
  document: DocumentNode,
  mutation: MilestoneMutation,
): MutationEditPlan {
  const requestError = requestShapeError(mutation);
  if (requestError !== undefined) {
    return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", requestError) };
  }
  const entity = document.declarations.find(({ id }) => id === mutation.id);
  if (mutation.kind === "milestone.add") {
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
    const error = definitionError(mutation.milestone);
    if (error !== undefined) {
      return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", error) };
    }
    const lineEnding = majorLineEnding(text);
    return {
      edits: [appendDeclarationEdit(text, serializeMilestone(mutation, lineEnding), lineEnding)],
    };
  }
  if (entity === undefined) {
    return {
      edits: [],
      diagnostic: mutationDiagnostic("PTMUT-302", `milestone ${mutation.id}が存在しません`),
    };
  }
  if (entity.kind !== "milestone") {
    return {
      edits: [],
      diagnostic: mutationDiagnostic(
        "PTMUT-303",
        `entity ${mutation.id}はmilestoneではありません`,
        entity,
      ),
    };
  }
  if (mutation.kind === "milestone.remove") {
    return { edits: [deleteDeclarationEdit(entity, splitPhysicalLines(text))] };
  }
  return planSet(text, entity, mutation);
}
