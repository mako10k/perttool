import type { DeclarationNode, DocumentNode } from "../model/syntax.js";
import {
  GRAMMAR_1_DECLARATION_FIELD_ORDER,
  TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER,
} from "../model/declaration-fields.js";
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
import type {
  TargetMilestoneDefinition,
  TargetMilestoneFieldSet,
  TargetMilestoneMutation,
  TargetSetMilestoneMutation,
} from "./target-types.js";

export interface MilestoneMutationProfile {
  readonly fieldOrder: readonly string[];
  readonly temporalFields: boolean;
}

export const ACTIVE_MILESTONE_MUTATION_PROFILE: MilestoneMutationProfile =
  Object.freeze({
    fieldOrder: GRAMMAR_1_DECLARATION_FIELD_ORDER.milestone,
    temporalFields: false,
  });

export const TARGET_MILESTONE_MUTATION_PROFILE: MilestoneMutationProfile =
  Object.freeze({
    fieldOrder: TARGET_GRAMMAR_2_DECLARATION_FIELD_ORDER.milestone,
    temporalFields: true,
  });

type SupportedMilestoneMutation = MilestoneMutation | TargetMilestoneMutation;
type SupportedMilestoneDefinition =
  | MilestoneDefinition
  | TargetMilestoneDefinition;
type SupportedMilestoneFieldSet =
  | MilestoneFieldSet
  | TargetMilestoneFieldSet;
type SupportedSetMilestoneMutation =
  | SetMilestoneMutation
  | TargetSetMilestoneMutation;

const states = new Set(["planned", "reached"]);

function validStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function requestShapeError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "milestone mutation request is not an object";
  }
  const request = value as Record<string, unknown>;
  const kind = request["kind"];
  if (kind !== "milestone.add" && kind !== "milestone.set" && kind !== "milestone.remove") {
    return "milestone mutation kind is unsupported";
  }
  if (typeof request["id"] !== "string") return "milestone id is not a string";
  const fieldsByKind: Readonly<Record<string, ReadonlySet<string>>> = {
    "milestone.add": new Set(["kind", "id", "milestone"]),
    "milestone.set": new Set(["kind", "id", "set", "clear", "addTags", "removeTags"]),
    "milestone.remove": new Set(["kind", "id"]),
  };
  if (Object.keys(request).some((name) => !fieldsByKind[kind]!.has(name))) {
    return `${kind} request contains unsupported fields`;
  }
  return undefined;
}

function definitionError(
  value: unknown,
  profile: MilestoneMutationProfile,
): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "milestone definition is not an object";
  }
  const milestone = value as Record<string, unknown>;
  const knownFields = new Set([
    "title",
    "description",
    "state",
    "tags",
    ...(profile.temporalFields ? ["deadline"] : []),
  ]);
  if (Object.keys(milestone).some((name) => !knownFields.has(name))) {
    return "milestone definition contains unsupported fields";
  }
  if (typeof milestone["title"] !== "string") return "milestone title is not a string";
  if (milestone["description"] !== undefined && typeof milestone["description"] !== "string") {
    return "milestone description is not a string";
  }
  if (milestone["state"] !== undefined && !states.has(milestone["state"] as string)) {
    return "milestone state must be planned or reached";
  }
  if (milestone["tags"] !== undefined && !validStringArray(milestone["tags"])) {
    return "milestone tags are not a string array";
  }
  if (profile.temporalFields &&
      milestone["deadline"] !== undefined &&
      typeof milestone["deadline"] !== "string") {
    return "milestone deadline is not a string";
  }
  return undefined;
}

function serializeMilestone(
  mutation:
    | AddMilestoneMutation
    | Extract<TargetMilestoneMutation, { kind: "milestone.add" }>,
  lineEnding: string,
  profile: MilestoneMutationProfile,
): string {
  const definition = mutation.milestone as SupportedMilestoneDefinition;
  const serialized = new Map<string, string>([
    ["title", `  title ${JSON.stringify(definition.title)}`],
  ]);
  if (definition.description !== undefined) {
    serialized.set(
      "description",
      serializeTextField("description", definition.description, lineEnding),
    );
  }
  if (definition.state !== undefined) {
    serialized.set("state", `  state ${definition.state}`);
  }
  if ("deadline" in definition && definition.deadline !== undefined) {
    serialized.set("deadline", `  deadline ${definition.deadline}`);
  }
  if (definition.tags !== undefined) {
    serialized.set("tags", `  tags ${serializeTags(definition.tags)}`);
  }
  return [
    `milestone ${mutation.id}:`,
    ...profile.fieldOrder.flatMap((name) =>
      serialized.has(name) ? [serialized.get(name)!] : []),
  ].join(lineEnding);
}

function setRequestError(
  mutation: SupportedSetMilestoneMutation,
  profile: MilestoneMutationProfile,
): string | undefined {
  const rawSet = mutation.set as unknown;
  const rawClear = mutation.clear as unknown;
  const rawAddTags = mutation.addTags as unknown;
  const rawRemoveTags = mutation.removeTags as unknown;
  if (
    rawSet !== undefined &&
    (rawSet === null || typeof rawSet !== "object" || Array.isArray(rawSet))
  ) {
    return "milestone set is not an object";
  }
  for (const [name, value] of [
    ["clear", rawClear],
    ["addTags", rawAddTags],
    ["removeTags", rawRemoveTags],
  ] as const) {
    if (value !== undefined && !Array.isArray(value)) return `${name} is not an array`;
  }
  const set = (rawSet ?? {}) as SupportedMilestoneFieldSet;
  const clear = (rawClear ?? []) as readonly string[];
  const addTags = (rawAddTags ?? []) as NonNullable<SetMilestoneMutation["addTags"]>;
  const removeTags = (rawRemoveTags ?? []) as NonNullable<SetMilestoneMutation["removeTags"]>;
  const setEntries = Object.entries(set).filter(([, item]) => item !== undefined);
  if (
    setEntries.length === 0 &&
    clear.length === 0 &&
    addTags.length === 0 &&
    removeTags.length === 0
  ) {
    return "milestone.set requires at least one change specification";
  }
  const knownSetFields = new Set([
    "title",
    "description",
    "state",
    ...(profile.temporalFields ? ["deadline"] : []),
  ]);
  if (Object.keys(set).some((name) => !knownSetFields.has(name))) {
    return "milestone set contains unsupported fields";
  }
  if (set.title !== undefined && typeof set.title !== "string") return "title is not a string";
  if (set.description !== undefined && typeof set.description !== "string") {
    return "description is not a string";
  }
  if (set.state !== undefined && !states.has(set.state)) {
    return "state must be planned or reached";
  }
  if ("deadline" in set &&
      set.deadline !== undefined &&
      typeof set.deadline !== "string") {
    return "deadline is not a string";
  }
  const clearableFields = new Set([
    "description",
    "state",
    "tags",
    ...(profile.temporalFields ? ["deadline"] : []),
  ]);
  if (!Array.isArray(clear) || clear.some((name) => !clearableFields.has(name))) {
    return "clear contains unsupported fields";
  }
  if (new Set(clear).size !== clear.length) return "clear contains duplicate fields";
  const clearNames = new Set(clear);
  for (const [setName, clearName] of [
    ["description", "description"],
    ["state", "state"],
    ...(profile.temporalFields
      ? [["deadline", "deadline"] as const]
      : []),
  ] as const) {
    if ((set as Record<string, unknown>)[setName] !== undefined &&
        clearNames.has(clearName)) {
      return `${clearName} cannot be specified in both set and clear`;
    }
  }
  if (!validStringArray(addTags) || !validStringArray(removeTags)) {
    return "addTags and removeTags must be string arrays";
  }
  if (clearNames.has("tags") && (addTags.length > 0 || removeTags.length > 0)) {
    return "clear tags cannot be combined with add/remove tags";
  }
  const removed = new Set(removeTags);
  if (addTags.some((tag) => removed.has(tag))) {
    return "the same tag cannot be specified in both add and remove";
  }
  return undefined;
}

function planSet(
  text: string,
  declaration: DeclarationNode,
  mutation: SupportedSetMilestoneMutation,
  profile: MilestoneMutationProfile,
): MutationEditPlan {
  const error = setRequestError(mutation, profile);
  if (error !== undefined) {
    return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", error, declaration) };
  }
  const editor = new EntityEditor(
    text,
    declaration,
    profile.fieldOrder,
    mutation.clear ?? [],
  );
  const set = mutation.set ?? {};
  const targetSet = set as TargetMilestoneFieldSet;
  if (set.title !== undefined) editor.setScalar("title", JSON.stringify(set.title));
  if (set.description !== undefined) editor.setText("description", set.description);
  if (set.state !== undefined) editor.setScalar("state", set.state);
  if (profile.temporalFields && targetSet.deadline !== undefined) {
    editor.setScalar("deadline", targetSet.deadline);
  }
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
  mutation: SupportedMilestoneMutation,
  profile: MilestoneMutationProfile = ACTIVE_MILESTONE_MUTATION_PROFILE,
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
          `entity ID ${mutation.id} is already in use`,
          entity,
        ),
      };
    }
    const error = definitionError(mutation.milestone, profile);
    if (error !== undefined) {
      return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", error) };
    }
    const lineEnding = majorLineEnding(text);
    return {
      edits: [
        appendDeclarationEdit(
          text,
          serializeMilestone(mutation, lineEnding, profile),
          lineEnding,
        ),
      ],
    };
  }
  if (entity === undefined) {
    return {
      edits: [],
      diagnostic: mutationDiagnostic("PTMUT-302", `milestone ${mutation.id} does not exist`),
    };
  }
  if (entity.kind !== "milestone") {
    return {
      edits: [],
      diagnostic: mutationDiagnostic(
        "PTMUT-303",
        `entity ${mutation.id} is not a milestone`,
        entity,
      ),
    };
  }
  if (mutation.kind === "milestone.remove") {
    return { edits: [deleteDeclarationEdit(entity, splitPhysicalLines(text))] };
  }
  return planSet(text, entity, mutation, profile);
}
