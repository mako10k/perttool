import type { DeclarationNode, DocumentNode } from "../model/syntax.js";
import { EntityEditor } from "./entity-editor.js";
import { mutationDiagnostic, type MutationEditPlan } from "./diagnostics.js";
import { appendDeclarationEdit, deleteDeclarationEdit, majorLineEnding, serializeTextField, splitPhysicalLines } from "./source.js";
import type {
  AddResourceMutation,
  ResourceDefinition,
  ResourceFieldSet,
  ResourceMutation,
  SetResourceMutation,
} from "./types.js";

const fieldOrder = ["title", "description", "capacity", "tags"] as const;

function requestShapeError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "resource mutation request is not an object";
  }
  const request = value as Record<string, unknown>;
  const kind = request["kind"];
  if (kind !== "resource.add" && kind !== "resource.set" && kind !== "resource.remove") {
    return "resource mutation kind is unsupported";
  }
  if (typeof request["id"] !== "string") return "resource id is not a string";
  const fieldsByKind: Readonly<Record<string, ReadonlySet<string>>> = {
    "resource.add": new Set(["kind", "id", "resource"]),
    "resource.set": new Set(["kind", "id", "set", "clear"]),
    "resource.remove": new Set(["kind", "id"]),
  };
  if (Object.keys(request).some((name) => !fieldsByKind[kind]!.has(name))) {
    return `${kind} request contains unsupported fields`;
  }
  return undefined;
}

function definitionError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "resource definition is not an object";
  }
  const resource = value as Record<string, unknown>;
  if (Object.keys(resource).some((name) => !["title", "description", "capacity"].includes(name))) {
    return "resource definition contains unsupported fields";
  }
  if (typeof resource["title"] !== "string") return "resource title is not a string";
  if (!Number.isSafeInteger(resource["capacity"])) {
    return "resource capacity is not a safe integer";
  }
  if (resource["description"] !== undefined && typeof resource["description"] !== "string") {
    return "resource description is not a string";
  }
  return undefined;
}

function serializeResource(
  mutation: AddResourceMutation,
  lineEnding: string,
): string {
  const definition = mutation.resource;
  return [
    `resource ${mutation.id}:`,
    `  title ${JSON.stringify(definition.title)}`,
    ...(definition.description === undefined
      ? []
      : [serializeTextField("description", definition.description, lineEnding)]),
    `  capacity ${definition.capacity}`,
  ].join(lineEnding);
}

function setRequestError(mutation: SetResourceMutation): string | undefined {
  const rawSet = mutation.set as unknown;
  const rawClear = mutation.clear as unknown;
  if (
    rawSet !== undefined &&
    (rawSet === null || typeof rawSet !== "object" || Array.isArray(rawSet))
  ) {
    return "resource set is not an object";
  }
  if (rawClear !== undefined && !Array.isArray(rawClear)) return "clear is not an array";
  const set = (rawSet ?? {}) as ResourceFieldSet;
  const clear = (rawClear ?? []) as NonNullable<SetResourceMutation["clear"]>;
  const setEntries = Object.entries(set).filter(([, item]) => item !== undefined);
  if (setEntries.length === 0 && clear.length === 0) {
    return "resource.set requires at least one change specification";
  }
  if (Object.keys(set).some((name) => !["title", "description", "capacity"].includes(name))) {
    return "resource set contains unsupported fields";
  }
  if (set.title !== undefined && typeof set.title !== "string") return "title is not a string";
  if (set.description !== undefined && typeof set.description !== "string") {
    return "description is not a string";
  }
  if (set.capacity !== undefined && !Number.isSafeInteger(set.capacity)) {
    return "capacity is not a safe integer";
  }
  if (!Array.isArray(clear) || clear.some((name) => name !== "description")) {
    return "clear contains unsupported fields";
  }
  if (new Set(clear).size !== clear.length) return "clear contains duplicate fields";
  if (set.description !== undefined && clear.includes("description")) {
    return "description cannot be specified in both set and clear";
  }
  return undefined;
}

function planSet(
  text: string,
  declaration: DeclarationNode,
  mutation: SetResourceMutation,
): MutationEditPlan {
  const error = setRequestError(mutation);
  if (error !== undefined) {
    return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", error, declaration) };
  }
  const editor = new EntityEditor(text, declaration, fieldOrder, mutation.clear ?? []);
  const set = mutation.set ?? {};
  if (set.title !== undefined) editor.setScalar("title", JSON.stringify(set.title));
  if (set.description !== undefined) editor.setText("description", set.description);
  if (set.capacity !== undefined) editor.setScalar("capacity", String(set.capacity));
  return { edits: editor.finish() };
}

export function planResourceMutationEdits(
  text: string,
  document: DocumentNode,
  mutation: ResourceMutation,
): MutationEditPlan {
  const requestError = requestShapeError(mutation);
  if (requestError !== undefined) {
    return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", requestError) };
  }
  const entity = document.declarations.find(({ id }) => id === mutation.id);
  if (mutation.kind === "resource.add") {
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
    const error = definitionError(mutation.resource);
    if (error !== undefined) {
      return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", error) };
    }
    const lineEnding = majorLineEnding(text);
    return {
      edits: [appendDeclarationEdit(text, serializeResource(mutation, lineEnding), lineEnding)],
    };
  }
  if (entity === undefined) {
    return {
      edits: [],
      diagnostic: mutationDiagnostic("PTMUT-302", `resource ${mutation.id} does not exist`),
    };
  }
  if (entity.kind !== "resource") {
    return {
      edits: [],
      diagnostic: mutationDiagnostic(
        "PTMUT-303",
        `entity ${mutation.id} is not a resource`,
        entity,
      ),
    };
  }
  if (mutation.kind === "resource.remove") {
    return { edits: [deleteDeclarationEdit(entity, splitPhysicalLines(text))] };
  }
  return planSet(text, entity, mutation);
}
