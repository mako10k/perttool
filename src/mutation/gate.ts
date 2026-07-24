import type { DeclarationNode, DocumentNode } from "../model/syntax.js";
import { EntityEditor } from "./entity-editor.js";
import { mutationDiagnostic, type MutationEditPlan } from "./diagnostics.js";
import {
  appendDeclarationEdit,
  deleteDeclarationEdit,
  majorLineEnding,
  serializeTextField,
  splitPhysicalLines,
} from "./source.js";
import type {
  AddGateMutation,
  GateFieldSet,
  GateMutation,
  SetGateMutation,
} from "./types.js";

const fieldOrder = ["reason"] as const;

function requestShapeError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "gate mutation request is not an object";
  }
  const request = value as Record<string, unknown>;
  const kind = request["kind"];
  if (kind !== "gate.add" && kind !== "gate.set" && kind !== "gate.remove") {
    return "gate mutation kind is unsupported";
  }
  if (typeof request["id"] !== "string") return "gate id is not a string";
  const fieldsByKind: Readonly<Record<string, ReadonlySet<string>>> = {
    "gate.add": new Set(["kind", "id", "from", "to", "gate"]),
    "gate.set": new Set(["kind", "id", "from", "to", "set"]),
    "gate.remove": new Set(["kind", "id"]),
  };
  if (Object.keys(request).some((name) => !fieldsByKind[kind]!.has(name))) {
    return `${kind} request contains unsupported fields`;
  }
  return undefined;
}

function definitionError(mutation: AddGateMutation): string | undefined {
  if (typeof mutation.from !== "string") return "gate from is not a string";
  if (typeof mutation.to !== "string") return "gate to is not a string";
  const value = mutation.gate as unknown;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "gate definition is not an object";
  }
  const gate = value as Record<string, unknown>;
  if (Object.keys(gate).some((name) => name !== "reason")) {
    return "gate definition contains unsupported fields";
  }
  if (typeof gate["reason"] !== "string") return "gate reason is not a string";
  return undefined;
}

function setRequestError(mutation: SetGateMutation): string | undefined {
  const rawSet = mutation.set as unknown;
  if (
    rawSet !== undefined
    && (rawSet === null || typeof rawSet !== "object" || Array.isArray(rawSet))
  ) {
    return "gate set is not an object";
  }
  const set = (rawSet ?? {}) as GateFieldSet;
  if (
    mutation.from === undefined
    && mutation.to === undefined
    && set.reason === undefined
  ) {
    return "gate.set requires at least one change specification";
  }
  if (mutation.from !== undefined && typeof mutation.from !== "string") {
    return "from is not a string";
  }
  if (mutation.to !== undefined && typeof mutation.to !== "string") {
    return "to is not a string";
  }
  if (Object.keys(set).some((name) => name !== "reason")) {
    return "gate set contains unsupported fields";
  }
  if (set.reason !== undefined && typeof set.reason !== "string") {
    return "reason is not a string";
  }
  return undefined;
}

function serializeGate(
  mutation: AddGateMutation,
  lineEnding: string,
): string {
  return [
    `gate ${mutation.id} ${mutation.from} -> ${mutation.to}:`,
    serializeTextField("reason", mutation.gate.reason, lineEnding),
  ].join(lineEnding);
}

function planSet(
  text: string,
  declaration: DeclarationNode,
  mutation: SetGateMutation,
): MutationEditPlan {
  const error = setRequestError(mutation);
  if (error !== undefined) {
    return {
      edits: [],
      diagnostic: mutationDiagnostic("PTMUT-301", error, declaration),
    };
  }
  if (declaration.fromSpan === undefined || declaration.toSpan === undefined) {
    throw new Error("gate endpoint span invariant failed");
  }
  const editor = new EntityEditor(text, declaration, fieldOrder);
  if (mutation.set?.reason !== undefined) {
    editor.setText("reason", mutation.set.reason);
  }
  const edits = [...editor.finish()];
  if (mutation.from !== undefined) {
    edits.push({
      startOffset: declaration.fromSpan.start.offset,
      endOffset: declaration.fromSpan.end.offset,
      replacement: mutation.from,
    });
  }
  if (mutation.to !== undefined) {
    edits.push({
      startOffset: declaration.toSpan.start.offset,
      endOffset: declaration.toSpan.end.offset,
      replacement: mutation.to,
    });
  }
  return { edits };
}

export function planGateMutationEdits(
  text: string,
  document: DocumentNode,
  mutation: GateMutation,
): MutationEditPlan {
  const requestError = requestShapeError(mutation);
  if (requestError !== undefined) {
    return {
      edits: [],
      diagnostic: mutationDiagnostic("PTMUT-301", requestError),
    };
  }
  const entity = document.declarations.find(({ id }) => id === mutation.id);
  if (mutation.kind === "gate.add") {
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
    const error = definitionError(mutation);
    if (error !== undefined) {
      return {
        edits: [],
        diagnostic: mutationDiagnostic("PTMUT-301", error),
      };
    }
    const lineEnding = majorLineEnding(text);
    return {
      edits: [
        appendDeclarationEdit(
          text,
          serializeGate(mutation, lineEnding),
          lineEnding,
        ),
      ],
    };
  }
  if (entity === undefined) {
    return {
      edits: [],
      diagnostic: mutationDiagnostic("PTMUT-302", `gate ${mutation.id} does not exist`),
    };
  }
  if (entity.kind !== "gate") {
    return {
      edits: [],
      diagnostic: mutationDiagnostic(
        "PTMUT-303",
        `entity ${mutation.id} is not a gate`,
        entity,
      ),
    };
  }
  if (mutation.kind === "gate.remove") {
    return {
      edits: [deleteDeclarationEdit(entity, splitPhysicalLines(text))],
    };
  }
  return planSet(text, entity, mutation);
}
