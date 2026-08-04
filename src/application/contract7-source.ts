import { createHash } from "node:crypto";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import {
  formatTargetGrammar6Document,
} from "../formatter/target-source-formatter.js";
import type { FormatResult } from "../formatter/source-formatter.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { ParseResult, TargetDeclarationKind } from "../model/syntax.js";
import type { TextEdit } from "../mutation/text-edits.js";
import {
  parseTargetGrammar6Document,
  TARGET_GRAMMAR_6_CAPABILITY,
  type ParseOptions,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar6DocumentSemantics,
} from "../semantic/validator.js";
import type { FormatPreviewOptions } from "./format.js";

export function parseDocument(
  text: string,
  options: ParseOptions = {},
): ParseResult<TargetDeclarationKind> {
  return parseTargetGrammar6Document(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
}

export const validateDocument = validateTargetGrammar6DocumentSemantics;

export function formatDocument(
  text: string,
  options: ParseOptions = {},
): FormatResult {
  return formatTargetGrammar6Document(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    options,
  );
}

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
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
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
