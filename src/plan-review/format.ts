import { canonicalizeEventDateTimeSourceToken } from "../model/calendar.js";
import type { TextEdit } from "../mutation/text-edits.js";
import { formatValidatedSource } from "../mutation/validated-source.js";
import { formatPlanningPoolSource } from "../planning-pool/format.js";
import { PLANNING_POOL_SOURCE_CAPABILITY } from "../planning-pool/source.js";
import type { TemporalSourceLine } from "../temporal-schedule/source-lexical.js";
import { parseQuotedString } from "../temporal-schedule/source-values.js";
import {
  planReviewBaseText,
  planReviewFields,
  scanPlanReviewDeclarationBlocks,
  type PlanReviewFieldBlock,
} from "./source-lexical.js";
import {
  parsePlanReviewSource,
  PLAN_REVIEW_SOURCE_CAPABILITY,
} from "./source.js";
import type {
  PlanReviewFormatResult,
  PlanReviewSourceCapability,
} from "./source-types.js";

function lineEdit(line: TemporalSourceLine, replacement: string): TextEdit {
  return Object.freeze({
    startOffset: line.start,
    endOffset: line.contentEnd,
    replacement,
  });
}

function canonicalValue(field: PlanReviewFieldBlock): string | null {
  if (["reason", "locator", "resolution_reason"].includes(field.name)) {
    const value = parseQuotedString(field.rawValue);
    return value === null ? null : JSON.stringify(value);
  }
  if (field.name === "created_at" || field.name === "resolved_at") {
    return canonicalizeEventDateTimeSourceToken(field.rawValue);
  }
  return field.rawValue;
}

function planReviewOwnedEdits(text: string): readonly TextEdit[] {
  const edits: TextEdit[] = [];
  for (const block of scanPlanReviewDeclarationBlocks(text)) {
    for (const field of planReviewFields(block)) {
      const value = canonicalValue(field);
      const replacement = value === null ? null : `  ${field.name} ${value}`;
      if (replacement !== null && replacement !== field.line.text) {
        edits.push(lineEdit(field.line, replacement));
      }
    }
  }
  return Object.freeze(edits);
}

function lowerOwnedEdits(text: string): readonly TextEdit[] {
  const blocks = scanPlanReviewDeclarationBlocks(text);
  const lowerText = planReviewBaseText(text, blocks);
  const formatted = formatPlanningPoolSource(
    lowerText,
    PLANNING_POOL_SOURCE_CAPABILITY,
  );
  if (!formatted.ok) {
    throw new Error("validated Grammar 10 base failed Grammar 9 formatting");
  }
  return formatted.edits;
}

export function formatPlanReviewSource(
  text: string,
  capability: PlanReviewSourceCapability,
  options: Readonly<{ maxDiagnostics?: number }> = {},
): PlanReviewFormatResult {
  if (capability !== PLAN_REVIEW_SOURCE_CAPABILITY) {
    throw new TypeError("the target Grammar 10 Plan Review source capability is required");
  }
  return formatValidatedSource(
    text,
    (candidate) => parsePlanReviewSource(candidate, capability, options),
    () => [...lowerOwnedEdits(text), ...planReviewOwnedEdits(text)],
    "Grammar 10 Plan Review formatter",
    "Grammar 10 Plan Review formatter produced an invalid candidate",
  );
}
