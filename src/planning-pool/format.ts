import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import {
  applyTextEdits,
  type TextEdit,
} from "../mutation/text-edits.js";
import {
  formatValidatedSource,
  planValidatedSourceMutation,
} from "../mutation/validated-source.js";
import {
  scanTemporalDeclarationBlocks,
  sourceLineSpan,
  sourceSliceSpan,
  splitTemporalSourceLines,
  type TemporalSourceLine,
} from "../temporal-schedule/source-lexical.js";
import {
  formatTemporalScheduleSource,
} from "../temporal-schedule/format.js";
import {
  TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
} from "../temporal-schedule/source.js";
import {
  declaredPlanningGrammarVersion,
  planningFields,
  planningPoolBaseText,
  scanPlanningDeclarationBlocks,
  type PlanningFieldBlock,
} from "./source-lexical.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "./source.js";
import type {
  PlanningPoolFormatResult,
  PlanningPoolMigrationResult,
  PlanningPoolMutationResult,
  PlanningPoolSourceCapability,
  PlanningPoolSourceDiagnostic,
} from "./source-types.js";
import {
  canonicalPlanningCalendar,
  canonicalPlanningDuration,
  canonicalPlanningTags,
  parsePlanningInteger,
  parsePlanningString,
  parsePlanningTags,
} from "./source-values.js";

function lineEdit(line: TemporalSourceLine, replacement: string): TextEdit {
  return Object.freeze({
    startOffset: line.start,
    endOffset: line.contentEnd,
    replacement,
  });
}

function quotedScalarValue(field: PlanningFieldBlock): string | null | undefined {
  if (["title", "objective", "owner", "source"].includes(field.name)) {
    const value = parsePlanningString(field.rawValue);
    return value === null ? null : JSON.stringify(value);
  }
  if (field.name === "description" && field.rawValue !== "|") {
    const value = parsePlanningString(field.rawValue);
    return value === null ? null : JSON.stringify(value);
  }
  return undefined;
}

function structuredScalarValue(field: PlanningFieldBlock): string | null | undefined {
  if (field.name === "duration") {
    return canonicalPlanningDuration(field.rawValue);
  }
  if (field.name === "priority") {
    const value = parsePlanningInteger(field.rawValue);
    return value === null ? null : String(value);
  }
  if (field.name === "tags") {
    const value = parsePlanningTags(field.rawValue);
    return value === null ? null : canonicalPlanningTags(value);
  }
  return undefined;
}

function calendarScalarValue(field: PlanningFieldBlock): string | null | undefined {
  if (["start", "end", "deadline"].includes(field.name)) {
    return canonicalPlanningCalendar(field.rawValue);
  }
  if (field.name === "when") {
    const match = /^(start|finish) (earliest|latest) (.+)$/u.exec(field.rawValue);
    const value = match === null ? null : canonicalPlanningCalendar(match[3]!);
    return match === null || value === null ? null : `${match[1]} ${match[2]} ${value}`;
  }
  return undefined;
}

function scalarValue(field: PlanningFieldBlock): string | null {
  const quoted = quotedScalarValue(field);
  if (quoted !== undefined) return quoted;
  const structured = structuredScalarValue(field);
  if (structured !== undefined) return structured;
  const calendar = calendarScalarValue(field);
  return calendar === undefined ? field.rawValue : calendar;
}

function nestedDurationEdits(field: PlanningFieldBlock): readonly TextEdit[] {
  if (field.name !== "estimate") return Object.freeze([]);
  return Object.freeze(field.children.flatMap((line) => {
    const match = /^    (optimistic|most_likely|pessimistic) (\S+)$/u.exec(line.text);
    if (match === null) return [];
    const value = canonicalPlanningDuration(match[2]!);
    return value === null ? [] : [lineEdit(line, `    ${match[1]} ${value}`)];
  }));
}

function nestedRequirementEdits(field: PlanningFieldBlock): readonly TextEdit[] {
  if (field.name !== "requires") return Object.freeze([]);
  return Object.freeze(field.children.flatMap((line) => {
    const match = /^    ([A-Za-z][A-Za-z0-9_-]*) (\d+)$/u.exec(line.text);
    const value = match === null ? null : parsePlanningInteger(match[2]!);
    return match === null || value === null
      ? []
      : [lineEdit(line, `    ${match[1]} ${value}`)];
  }));
}

function planningOwnedEdits(text: string): readonly TextEdit[] {
  const edits: TextEdit[] = [];
  for (const block of scanPlanningDeclarationBlocks(text)) {
    for (const field of planningFields(block)) {
      if (!field.blockStyle) {
        const value = scalarValue(field);
        if (value !== null) edits.push(lineEdit(field.line, `  ${field.name} ${value}`));
      }
      edits.push(...nestedDurationEdits(field), ...nestedRequirementEdits(field));
    }
  }
  return Object.freeze(edits);
}

function legacyOwnedEdits(text: string): readonly TextEdit[] {
  const blocks = scanPlanningDeclarationBlocks(text);
  const baseText = planningPoolBaseText(text, blocks);
  const formatted = formatTemporalScheduleSource(
    baseText,
    TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
    { maxDiagnostics: 1_000 },
  );
  if (!formatted.ok) throw new Error("validated Grammar 9 base failed Grammar 8 formatting");
  return formatted.edits;
}

export function formatPlanningPoolSource(
  text: string,
  capability: PlanningPoolSourceCapability,
  options: Readonly<{ maxDiagnostics?: number }> = {},
): PlanningPoolFormatResult {
  if (capability !== PLANNING_POOL_SOURCE_CAPABILITY) {
    throw new TypeError("the target Grammar 9 planning-pool source capability is required");
  }
  return formatValidatedSource(
    text,
    (candidate) => parsePlanningPoolSource(candidate, capability, options),
    () => [...legacyOwnedEdits(text), ...planningOwnedEdits(text)],
    "Grammar 9 planning-pool formatter",
    "Grammar 9 planning-pool formatter produced an invalid candidate",
  );
}

export function planPlanningPoolSourceMutation(
  text: string,
  requestedEdits: readonly TextEdit[],
  capability: PlanningPoolSourceCapability,
  options: Readonly<{ maxDiagnostics?: number }> = {},
): PlanningPoolMutationResult {
  if (capability !== PLANNING_POOL_SOURCE_CAPABILITY) {
    throw new TypeError("the target Grammar 9 planning-pool source capability is required");
  }
  return planValidatedSourceMutation(
    text,
    requestedEdits,
    (candidate) => parsePlanningPoolSource(candidate, capability, options),
    "Grammar 9 planning-pool mutation",
  );
}

function migrationDiagnostic(
  text: string,
  message: string,
): PlanningPoolSourceDiagnostic {
  const line = splitTemporalSourceLines(text)[0];
  const span: SourceSpan | undefined = line === undefined ? undefined : sourceLineSpan(line);
  return Object.freeze({
    code: "PTPOOL-116",
    severity: "error" as const,
    message,
    ...(span === undefined ? {} : { span }),
    data: Object.freeze({}),
  });
}

function migrationFailure(
  text: string,
  sourceGrammarVersion: number | null,
  documentId: string | null,
  diagnostics: readonly PlanningPoolSourceDiagnostic[],
  truncated: boolean,
): PlanningPoolMigrationResult {
  return Object.freeze({
    ok: false,
    documentId,
    sourceGrammarVersion,
    targetGrammarVersion: null,
    changed: false,
    candidateText: null,
    edits: Object.freeze([]),
    diagnostics: Object.freeze([
      ...diagnostics,
      migrationDiagnostic(text, "Planning Pool migration requires a valid Grammar 8 or 9 source"),
    ]),
    diagnosticsTruncated: truncated,
  });
}

function versionEdit(text: string): TextEdit | null {
  const project = scanTemporalDeclarationBlocks(text).find(({ kind }) => kind === "project");
  const line = project?.lines.find((candidate) => /^  version 8$/u.test(candidate.text));
  return line === undefined
    ? null
    : Object.freeze({
        startOffset: line.contentEnd - 1,
        endOffset: line.contentEnd,
        replacement: "9",
      });
}

export function planPlanningPoolMigration(
  text: string,
  capability: PlanningPoolSourceCapability,
  options: Readonly<{ maxDiagnostics?: number }> = {},
): PlanningPoolMigrationResult {
  if (capability !== PLANNING_POOL_SOURCE_CAPABILITY) {
    throw new TypeError("the target Grammar 9 planning-pool source capability is required");
  }
  const grammarVersion = declaredPlanningGrammarVersion(text);
  const checked = parsePlanningPoolSource(text, capability, options);
  if (grammarVersion === 9 && checked.ok && checked.model !== null) {
    return Object.freeze({
      ok: true,
      documentId: checked.documentId,
      sourceGrammarVersion: 9,
      targetGrammarVersion: 9,
      changed: false,
      candidateText: text,
      edits: Object.freeze([]),
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    });
  }
  if (grammarVersion !== 8 || !checked.ok) {
    return migrationFailure(
      text,
      Number.isSafeInteger(grammarVersion) ? grammarVersion : null,
      checked.documentId,
      checked.diagnostics,
      checked.diagnosticsTruncated,
    );
  }
  const edit = versionEdit(text);
  if (edit === null) {
    return migrationFailure(text, 8, checked.documentId, checked.diagnostics, checked.diagnosticsTruncated);
  }
  const candidateText = applyTextEdits(text, [edit]);
  const candidate = parsePlanningPoolSource(candidateText, capability, options);
  if (!candidate.ok || candidate.model === null) {
    throw new Error("Grammar 8 to 9 planning-pool migration produced an invalid candidate");
  }
  return Object.freeze({
    ok: true,
    documentId: candidate.documentId,
    sourceGrammarVersion: 8,
    targetGrammarVersion: 9,
    changed: true,
    candidateText,
    edits: Object.freeze([edit]),
    diagnostics: candidate.diagnostics,
    diagnosticsTruncated: candidate.diagnosticsTruncated,
  });
}
