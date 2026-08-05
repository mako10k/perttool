import {
  formatTargetGrammar6Document,
} from "../formatter/target-source-formatter.js";
import type { FormatResult } from "../formatter/source-formatter.js";
import type {
  ParseResult,
  TargetDeclarationKind,
} from "../model/syntax.js";
import {
  parseTargetGrammar6Document,
  TARGET_GRAMMAR_6_CAPABILITY,
  type ParseOptions,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar6DocumentSemantics,
} from "../semantic/validator.js";

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
