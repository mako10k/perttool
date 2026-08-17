import { composePlanAssuranceMutationImpact } from "../assurance/authority.js";
import type { PlanAssuranceImpactV1 } from "../assurance/mutation.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { applyTextEdits, normalizeTextEdits, type TextEdit } from "../mutation/text-edits.js";
import { fieldLine, scanTemporalDeclarationBlocks } from "../temporal-schedule/source-lexical.js";
import type { TemporalScheduleMutationResult } from "../temporal-schedule/source-types.js";
import type { MutationResultV5 } from "./contract8-milestone-acceptance.js";
import { evaluateContract9PlanAssurance } from "./contract9-assurance.js";
import { liftContract9Candidate } from "./contract9-candidate.js";

export type Contract9MutationResultV6 = Omit<MutationResultV5, "schemaVersion"> & {
  readonly schemaVersion: "Perttool.MutationResult.v6";
};

function originalOffset(candidateOffset: number, edits: readonly TextEdit[]): number | null {
  let delta = 0;
  for (const edit of edits) {
    const candidateStart = edit.startOffset + delta;
    const candidateEnd = candidateStart + edit.replacement.length;
    if (candidateOffset < candidateStart) return candidateOffset - delta;
    if (candidateOffset === candidateStart) return edit.startOffset;
    if (candidateOffset < candidateEnd) return null;
    if (candidateOffset === candidateEnd) return edit.endOffset;
    delta += edit.replacement.length - (edit.endOffset - edit.startOffset);
  }
  return candidateOffset - delta;
}

function rebaseTemporalEdits(text: string, legacy: readonly TextEdit[], temporal: readonly TextEdit[]): readonly TextEdit[] | null {
  const rebased: TextEdit[] = [];
  for (const edit of temporal) {
    const startOffset = originalOffset(edit.startOffset, legacy);
    const endOffset = originalOffset(edit.endOffset, legacy);
    if (startOffset === null || endOffset === null) return null;
    rebased.push(Object.freeze({ ...edit, startOffset, endOffset }));
  }
  try {
    return normalizeTextEdits(text, [...legacy, ...rebased], "Contract 9 mixed mutation");
  } catch {
    return null;
  }
}

function activeTaskIds(text: string): readonly string[] {
  return Object.freeze(scanTemporalDeclarationBlocks(text).filter(({ kind, lines }) => kind === "task" &&
    lines.some((line) => fieldLine(line)?.name === "status" && fieldLine(line)?.rawValue === "active")).map(({ id }) => id));
}

function assuranceImpact(text: string, candidate: string): PlanAssuranceImpactV1 | null {
  const before = evaluateContract9PlanAssurance(text);
  const after = evaluateContract9PlanAssurance(candidate);
  if (before === null || after === null) return null;
  const beforeById = new Map(before.taskResults.map((result) => [result.taskId, result]));
  const affectedTaskIds = after.taskResults.filter((result) =>
    JSON.stringify(beforeById.get(result.taskId)) !== JSON.stringify(result)).map(({ taskId }) => taskId);
  return Object.freeze({ modelVersion: 1, affectedTaskIds: Object.freeze(affectedTaskIds), before, after,
    projection: composePlanAssuranceMutationImpact(affectedTaskIds, before, after, activeTaskIds(text), activeTaskIds(candidate)) });
}

function failure(base: Contract9MutationResultV6, temporal: TemporalScheduleMutationResult,
  message: string): Contract9MutationResultV6 {
  return Object.freeze({ ...base, ok: false, changed: false, updatedDigest: null, updatedText: null, diff: null,
    edits: Object.freeze([]), assuranceImpact: null, diagnostics: Object.freeze([...base.diagnostics, ...temporal.diagnostics,
      Object.freeze({ code: "PTSCH-110", severity: "error" as const, message })]),
    diagnosticsTruncated: base.diagnosticsTruncated || temporal.diagnosticsTruncated });
}

export function composeContract9MixedMutation(
  text: string,
  legacyPlanner: (baseText: string) => MutationResultV5,
  temporalPlanner: (candidateText: string) => TemporalScheduleMutationResult,
  options: Readonly<{ originalLabel?: string; updatedLabel?: string }> = {},
): Contract9MutationResultV6 {
  const legacy = liftContract9Candidate(text, legacyPlanner, options) as Contract9MutationResultV6;
  if (!legacy.ok || legacy.updatedText === null) return legacy;
  const temporal = temporalPlanner(legacy.updatedText);
  if (!temporal.ok || temporal.updatedText === null) return failure(legacy, temporal,
    "temporal mutation failed after the legacy candidate");
  const edits = rebaseTemporalEdits(text, legacy.edits, temporal.edits);
  if (edits === null) return failure(legacy, temporal, "legacy and temporal edits overlap");
  const candidate = applyTextEdits(text, edits);
  if (candidate !== temporal.updatedText) return failure(legacy, temporal,
    "mixed mutation edit composition changed candidate bytes");
  const impact = assuranceImpact(text, candidate);
  const impactDiagnostics = impact?.projection.diagnostics ?? [];
  return Object.freeze({ ...legacy, changed: candidate !== text, updatedDigest: sha256DigestUtf8(candidate),
    updatedText: candidate, edits, diff: createUnifiedDiff(text, candidate,
      { originalLabel: options.originalLabel ?? "original", updatedLabel: options.updatedLabel ?? "candidate" }),
    assuranceImpact: impact, diagnostics: Object.freeze([...legacy.diagnostics, ...impactDiagnostics]) });
}

export function composeContract9TemporalMutation(
  text: string,
  temporalPlanner: (candidateText: string) => TemporalScheduleMutationResult,
  options: Readonly<{ originalLabel?: string; updatedLabel?: string }> = {},
): Contract9MutationResultV6 {
  const originalDigest = sha256DigestUtf8(text);
  return composeContract9MixedMutation(text, () => Object.freeze({
    schemaVersion: "Perttool.MutationResult.v5" as const, ok: true, documentId: null, changed: false,
    originalDigest, updatedDigest: originalDigest, updatedText: text, diff: "", edits: Object.freeze([]),
    governance: null, lifecycle: null, assuranceImpact: null, diagnostics: Object.freeze([]), diagnosticsTruncated: false,
  }), temporalPlanner, options);
}
