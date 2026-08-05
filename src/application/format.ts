import { sha256DigestUtf8 } from "../model/sha256.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import {
  formatDocument,
  type FormatOptions,
} from "../formatter/source-formatter.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { TextEdit } from "../mutation/text-edits.js";

export interface FormatPreviewOptions extends FormatOptions {
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
}

export interface FormatPreviewResult {
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
): FormatPreviewResult {
  const originalDigest = digest(text);
  const formatted = formatDocument(text, {
    ...(options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics }),
  });
  if (!formatted.ok) {
    return {
      ok: false,
      documentId: formatted.documentId,
      changed: false,
      originalDigest,
      updatedDigest: null,
      updatedText: null,
      diff: null,
      edits: [],
      diagnostics: formatted.diagnostics,
      diagnosticsTruncated: formatted.diagnosticsTruncated,
    };
  }
  if (formatted.formattedText === null) {
    throw new Error("successful formatter result does not contain candidate text");
  }

  const updatedText = formatted.formattedText;
  return {
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
  };
}
