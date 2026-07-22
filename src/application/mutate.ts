import { createHash } from "node:crypto";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import type { Diagnostic } from "../model/diagnostics.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
} from "../model/diagnostics.js";
import { applyTextEdits, normalizeTextEdits } from "../mutation/text-edits.js";
import type { TextEdit } from "../mutation/text-edits.js";
import { mutationDiagnostic, type MutationEditPlan } from "../mutation/diagnostics.js";
import { planMilestoneMutationEdits } from "../mutation/milestone.js";
import { planResourceMutationEdits } from "../mutation/resource.js";
import { planTaskMutationEdits } from "../mutation/task.js";
import type {
  AtomicMutation,
  BatchMutation,
  Mutation,
  MutationOptions,
  MutationResult,
} from "../mutation/types.js";
import { checkDocument } from "./check.js";

function digest(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function failure(
  originalDigest: string,
  documentId: string | null,
  diagnostics: readonly Diagnostic[],
  maximum: number,
  alreadyTruncated: boolean,
): MutationResult {
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maximum);
  return {
    ok: false,
    documentId,
    changed: false,
    originalDigest,
    updatedDigest: null,
    updatedText: null,
    diff: null,
    edits: [],
    diagnostics: limited.diagnostics,
    diagnosticsTruncated: alreadyTruncated || limited.truncated,
  };
}

function runtimeKind(value: unknown): unknown {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)["kind"]
    : undefined;
}

function planAtomicMutationEdits(
  text: string,
  document: Parameters<typeof planTaskMutationEdits>[1],
  mutation: AtomicMutation,
): MutationEditPlan {
  const kind = runtimeKind(mutation);
  if (typeof kind === "string" && kind.startsWith("milestone.")) {
    return planMilestoneMutationEdits(text, document, mutation as Parameters<typeof planMilestoneMutationEdits>[2]);
  }
  if (typeof kind === "string" && kind.startsWith("resource.")) {
    return planResourceMutationEdits(text, document, mutation as Parameters<typeof planResourceMutationEdits>[2]);
  }
  return planTaskMutationEdits(text, document, mutation as Parameters<typeof planTaskMutationEdits>[2]);
}

function batchRequestError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "batch mutation requestがobjectではありません";
  }
  const request = value as Record<string, unknown>;
  if (request["kind"] !== "batch") return "batch mutation kindが不正です";
  if (Object.keys(request).some((name) => !["kind", "mutations"].includes(name))) {
    return "batch mutation requestに未対応fieldが含まれています";
  }
  if (!Array.isArray(request["mutations"]) || request["mutations"].length === 0) {
    return "batch mutationは1件以上のatomic mutationを必要とします";
  }
  if (request["mutations"].some((item) => runtimeKind(item) === "batch")) {
    return "batch mutationはnested batchを許可しません";
  }
  const ids = request["mutations"].map((item) =>
    item !== null && typeof item === "object"
      ? (item as Record<string, unknown>)["id"]
      : undefined,
  );
  if (ids.some((id) => typeof id !== "string")) {
    return "batch内のatomic mutationはstring idを必要とします";
  }
  if (new Set(ids).size !== ids.length) {
    return "batch内で同じentity IDを複数回変更できません";
  }
  return undefined;
}

function mergeBatchInsertions(edits: readonly TextEdit[]): readonly TextEdit[] {
  const nonInsertions: TextEdit[] = [];
  const insertions = new Map<number, Array<{ edit: TextEdit; requestIndex: number }>>();
  for (const [requestIndex, edit] of edits.entries()) {
    if (edit.startOffset === edit.endOffset) {
      const group = insertions.get(edit.startOffset) ?? [];
      group.push({ edit, requestIndex });
      insertions.set(edit.startOffset, group);
    } else {
      nonInsertions.push(edit);
    }
  }
  const mergedInsertions = [...insertions.entries()].map(([offset, group]) => {
    const structuralRank = ({ edit }: { readonly edit: TextEdit }): number => {
      const withoutLeadingEndings = edit.replacement.replace(/^(?:\r?\n)*/, "");
      return withoutLeadingEndings.startsWith(" ") ? 0 : 1;
    };
    group.sort(
      (left, right) =>
        structuralRank(left) - structuralRank(right) || left.requestIndex - right.requestIndex,
    );
    return {
      startOffset: offset,
      endOffset: offset,
      replacement: group.map(({ edit }) => edit.replacement).join(""),
    };
  });
  return [...nonInsertions, ...mergedInsertions];
}

function planAllMutationEdits(
  text: string,
  document: Parameters<typeof planTaskMutationEdits>[1],
  mutation: Mutation,
): MutationEditPlan {
  if (runtimeKind(mutation) !== "batch") {
    return planAtomicMutationEdits(text, document, mutation as AtomicMutation);
  }
  const error = batchRequestError(mutation);
  if (error !== undefined) {
    return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", error) };
  }
  const batch = mutation as BatchMutation;
  const edits: TextEdit[] = [];
  for (const atomic of batch.mutations) {
    const planned = planAtomicMutationEdits(text, document, atomic);
    if (planned.diagnostic !== undefined) return planned;
    edits.push(...planned.edits);
  }
  return { edits: mergeBatchInsertions(edits) };
}

function planMutationRequest(
  text: string,
  mutation: unknown,
  options: MutationOptions = {},
  batchOnly = false,
): MutationResult {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const originalDigest = digest(text);
  const original = checkDocument(text, { maxDiagnostics: maximum });
  if (!original.ok) {
    return failure(
      originalDigest,
      original.documentId,
      original.diagnostics,
      maximum,
      original.diagnosticsTruncated,
    );
  }

  if (batchOnly && runtimeKind(mutation) !== "batch") {
    return failure(
      originalDigest,
      original.documentId,
      [
        ...original.diagnostics,
        mutationDiagnostic("PTMUT-301", "mutation applyはtop-level batch requestを必要とします"),
      ],
      maximum,
      original.diagnosticsTruncated,
    );
  }

  const planned = planAllMutationEdits(text, original.document, mutation as Mutation);
  if (planned.diagnostic !== undefined) {
    return failure(
      originalDigest,
      original.documentId,
      [...original.diagnostics, planned.diagnostic],
      maximum,
      original.diagnosticsTruncated,
    );
  }
  let edits: readonly TextEdit[];
  try {
    edits = normalizeTextEdits(text, planned.edits, "mutation");
  } catch (error) {
    if (runtimeKind(mutation) !== "batch") throw error;
    return failure(
      originalDigest,
      original.documentId,
      [
        ...original.diagnostics,
        mutationDiagnostic("PTMUT-301", "batch mutationのTextEdit rangeが競合しています"),
      ],
      maximum,
      original.diagnosticsTruncated,
    );
  }
  const updatedText = applyTextEdits(text, edits);
  const candidate = checkDocument(updatedText, { maxDiagnostics: maximum });
  if (!candidate.ok) {
    return failure(
      originalDigest,
      original.documentId,
      candidate.diagnostics,
      maximum,
      candidate.diagnosticsTruncated,
    );
  }

  return {
    ok: true,
    documentId: original.documentId,
    changed: updatedText !== text,
    originalDigest,
    updatedDigest: digest(updatedText),
    updatedText,
    diff: createUnifiedDiff(text, updatedText, {
      ...(options.originalLabel === undefined
        ? {}
        : { originalLabel: options.originalLabel }),
      ...(options.updatedLabel === undefined
        ? {}
        : { updatedLabel: options.updatedLabel }),
    }),
    edits,
    diagnostics: candidate.diagnostics,
    diagnosticsTruncated: candidate.diagnosticsTruncated,
  };
}

export function planMutation(
  text: string,
  mutation: Mutation,
  options: MutationOptions = {},
): MutationResult {
  return planMutationRequest(text, mutation, options);
}

export function planBatchMutation(
  text: string,
  mutation: unknown,
  options: MutationOptions = {},
): MutationResult {
  return planMutationRequest(text, mutation, options, true);
}
