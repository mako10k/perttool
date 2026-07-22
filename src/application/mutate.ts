import { createHash } from "node:crypto";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import type { Diagnostic } from "../model/diagnostics.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
} from "../model/diagnostics.js";
import { applyTextEdits, normalizeTextEdits } from "../mutation/text-edits.js";
import { planTaskMutationEdits } from "../mutation/task.js";
import type {
  MutationOptions,
  MutationResult,
  TaskMutation,
} from "../mutation/types.js";
import { checkDocument } from "./check.js";

function digest(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function failure(
  originalDigest: string,
  diagnostics: readonly Diagnostic[],
  maximum: number,
  alreadyTruncated: boolean,
): MutationResult {
  const limited = limitDiagnostics(sortDiagnostics(diagnostics), maximum);
  return {
    ok: false,
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

export function planMutation(
  text: string,
  mutation: TaskMutation,
  options: MutationOptions = {},
): MutationResult {
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const originalDigest = digest(text);
  const original = checkDocument(text, { maxDiagnostics: maximum });
  if (!original.ok) {
    return failure(
      originalDigest,
      original.diagnostics,
      maximum,
      original.diagnosticsTruncated,
    );
  }

  const planned = planTaskMutationEdits(text, original.document, mutation);
  if (planned.diagnostic !== undefined) {
    return failure(
      originalDigest,
      [...original.diagnostics, planned.diagnostic],
      maximum,
      original.diagnosticsTruncated,
    );
  }
  const edits = normalizeTextEdits(text, planned.edits, "mutation");
  const updatedText = applyTextEdits(text, edits);
  const candidate = checkDocument(updatedText, { maxDiagnostics: maximum });
  if (!candidate.ok) {
    return failure(
      originalDigest,
      candidate.diagnostics,
      maximum,
      candidate.diagnosticsTruncated,
    );
  }

  return {
    ok: true,
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
