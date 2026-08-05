import { sha256DigestUtf8 } from "../model/sha256.js";
import {
  formatDocument,
} from "../core/source.js";
export {
  formatDocument,
  parseDocument,
  validateDocument,
} from "../core/source.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { TextEdit } from "../mutation/text-edits.js";
import type { FormatPreviewOptions } from "./format.js";

export interface FormatPreviewResultV7 {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

function digest(text: string): string {
  return sha256DigestUtf8(text);
}

export function planFormat(
  text: string,
  options: FormatPreviewOptions = {},
): FormatPreviewResultV7 {
  const originalDigest = digest(text);
  const formatted = formatDocument(text, options);
  if (!formatted.ok || formatted.formattedText === null) {
    return Object.freeze({
      ok: false,
      documentId: formatted.documentId,
      changed: false,
      originalDigest,
      updatedDigest: null,
      updatedText: null,
      diff: null,
      edits: Object.freeze([]),
      diagnostics: formatted.diagnostics,
      diagnosticsTruncated: formatted.diagnosticsTruncated,
    });
  }
  const updatedText = formatted.formattedText;
  return Object.freeze({
    ok: true,
    documentId: formatted.documentId,
    changed: formatted.changed,
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
    edits: formatted.edits,
    diagnostics: formatted.diagnostics,
    diagnosticsTruncated: formatted.diagnosticsTruncated,
  });
}
