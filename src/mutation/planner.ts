import { createHash } from "node:crypto";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { DocumentNode } from "../model/syntax.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
} from "../model/diagnostics.js";
import { applyTextEdits, normalizeTextEdits } from "../mutation/text-edits.js";
import type { TextEdit } from "../mutation/text-edits.js";
import { mutationDiagnostic, type MutationEditPlan } from "../mutation/diagnostics.js";
import { planGateMutationEdits } from "../mutation/gate.js";
import {
  TARGET_MILESTONE_MUTATION_PROFILE,
  planMilestoneMutationEdits,
  type MilestoneMutationProfile,
} from "../mutation/milestone.js";
import {
  TARGET_GRAMMAR_3_PROJECT_MUTATION_PROFILE,
  planProjectMutationEdits,
  type ProjectMutationProfile,
} from "../mutation/project.js";
import { planResourceMutationEdits } from "../mutation/resource.js";
import {
  TARGET_GRAMMAR_3_TASK_MUTATION_PROFILE,
  planTaskMutationEdits,
  type TaskMutationProfile,
} from "../mutation/task.js";
import type {
  Mutation,
  MutationOptions,
  MutationResult,
} from "../mutation/types.js";
import { checkDocument } from "../semantic/check.js";

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

export interface MutationDocumentValidation {
  readonly ok: boolean;
  readonly document: DocumentNode | null;
  readonly documentId: string | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export type MutationDocumentValidator = (
  text: string,
  maxDiagnostics: number,
) => MutationDocumentValidation;

export interface MutationPlanningProfile {
  readonly project: ProjectMutationProfile;
  readonly task: TaskMutationProfile;
  readonly milestone: MilestoneMutationProfile;
}

const activeMutationPlanningProfile: MutationPlanningProfile = Object.freeze({
  project: TARGET_GRAMMAR_3_PROJECT_MUTATION_PROFILE,
  task: TARGET_GRAMMAR_3_TASK_MUTATION_PROFILE,
  milestone: TARGET_MILESTONE_MUTATION_PROFILE,
});

function validateActiveDocument(
  text: string,
  maxDiagnostics: number,
): MutationDocumentValidation {
  const checked = checkDocument(text, { maxDiagnostics });
  return {
    ok: checked.ok,
    document: checked.document,
    documentId: checked.documentId,
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  };
}

export function planAtomicMutationEdits(
  text: string,
  document: Parameters<typeof planTaskMutationEdits>[1],
  mutation: unknown,
  profile: MutationPlanningProfile,
): MutationEditPlan {
  const kind = runtimeKind(mutation);
  if (kind === "project.set") {
    return planProjectMutationEdits(
      text,
      document,
      mutation as Parameters<typeof planProjectMutationEdits>[2],
      profile.project,
    );
  }
  if (typeof kind === "string" && kind.startsWith("milestone.")) {
    return planMilestoneMutationEdits(
      text,
      document,
      mutation as Parameters<typeof planMilestoneMutationEdits>[2],
      profile.milestone,
    );
  }
  if (typeof kind === "string" && kind.startsWith("gate.")) {
    return planGateMutationEdits(
      text,
      document,
      mutation as Parameters<typeof planGateMutationEdits>[2],
    );
  }
  if (typeof kind === "string" && kind.startsWith("resource.")) {
    return planResourceMutationEdits(text, document, mutation as Parameters<typeof planResourceMutationEdits>[2]);
  }
  return planTaskMutationEdits(
    text,
    document,
    mutation as Parameters<typeof planTaskMutationEdits>[2],
    profile.task,
  );
}

function batchRequestError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "batch mutation request is not an object";
  }
  const request = value as Record<string, unknown>;
  if (request["kind"] !== "batch") return "batch mutation kind is invalid";
  if (Object.keys(request).some((name) => !["kind", "mutations"].includes(name))) {
    return "batch mutation request contains unsupported fields";
  }
  if (!Array.isArray(request["mutations"]) || request["mutations"].length === 0) {
    return "batch mutation requires at least one atomic mutation";
  }
  if (request["mutations"].some((item) => runtimeKind(item) === "batch")) {
    return "batch mutation does not allow nested batches";
  }
  const targets = request["mutations"].map((item) => {
    if (item === null || typeof item !== "object") return undefined;
    const record = item as Record<string, unknown>;
    if (record["kind"] === "project.set") return "project";
    return typeof record["id"] === "string" ? `entity:${record["id"]}` : undefined;
  });
  if (targets.some((target) => target === undefined)) {
    return "atomic mutations in a batch require a project target or string id";
  }
  if (new Set(targets).size !== targets.length) {
    return "the same target cannot be changed more than once in a batch";
  }
  return undefined;
}

export function mergeBatchInsertions(edits: readonly TextEdit[]): readonly TextEdit[] {
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
  mutation: unknown,
  profile: MutationPlanningProfile,
): MutationEditPlan {
  if (runtimeKind(mutation) !== "batch") {
    return planAtomicMutationEdits(text, document, mutation, profile);
  }
  const error = batchRequestError(mutation);
  if (error !== undefined) {
    return { edits: [], diagnostic: mutationDiagnostic("PTMUT-301", error) };
  }
  const batch = mutation as { readonly mutations: readonly unknown[] };
  const edits: TextEdit[] = [];
  for (const atomic of batch.mutations) {
    const planned = planAtomicMutationEdits(text, document, atomic, profile);
    if (planned.diagnostic !== undefined) return planned;
    edits.push(...planned.edits);
  }
  return { edits: mergeBatchInsertions(edits) };
}

export function planValidatedMutationRequest(
  text: string,
  mutation: unknown,
  validator: MutationDocumentValidator,
  profile: MutationPlanningProfile,
  options: MutationOptions = {},
  batchOnly = false,
): MutationResult {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const originalDigest = digest(text);
  const original = validator(text, maximum);
  if (!original.ok) {
    return failure(
      originalDigest,
      original.documentId,
      original.diagnostics,
      maximum,
      original.diagnosticsTruncated,
    );
  }
  if (original.document === null) {
    throw new Error("mutation validator accepted a document without an AST");
  }

  if (batchOnly && runtimeKind(mutation) !== "batch") {
    return failure(
      originalDigest,
      original.documentId,
      [
        ...original.diagnostics,
        mutationDiagnostic("PTMUT-301", "mutation apply requires a top-level batch request"),
      ],
      maximum,
      original.diagnosticsTruncated,
    );
  }

  const planned = planAllMutationEdits(
    text,
    original.document,
    mutation,
    profile,
  );
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
        mutationDiagnostic("PTMUT-301", "TextEdit ranges in the batch mutation overlap"),
      ],
      maximum,
      original.diagnosticsTruncated,
    );
  }
  const updatedText = applyTextEdits(text, edits);
  const candidate = validator(updatedText, maximum);
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
  return planValidatedMutationRequest(
    text,
    mutation,
    validateActiveDocument,
    activeMutationPlanningProfile,
    options,
  );
}

export function planBatchMutation(
  text: string,
  mutation: unknown,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    validateActiveDocument,
    activeMutationPlanningProfile,
    options,
    true,
  );
}
