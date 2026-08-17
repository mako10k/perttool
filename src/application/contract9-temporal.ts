import { limitDiagnostics, normalizeMaxDiagnostics, sortDiagnostics, type Diagnostic } from "../model/diagnostics.js";
import { temporalScheduleBaseText, scanTemporalDeclarationBlocks } from "../temporal-schedule/source-lexical.js";
import { parseTemporalScheduleSource, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../temporal-schedule/source.js";
import {
  analyzeDocument as analyzeContract8Document,
  checkDocument as checkContract8Document,
  selectNextTasks as selectContract8NextTasks,
  type AnalysisResultV6,
  type CheckResultV5,
  type NextResultV7,
} from "./contract8-milestone-acceptance.js";
import type { AnalyzeOptions } from "./analyze.js";
import type { CheckOptions } from "./check.js";
import type { NextOptions } from "./next.js";
import { composeContract9TemporalContext } from "./contract9-temporal-context.js";
import { projectTargetPostdueAnalysis, type TargetPostdueAnalysisResultV7 } from "./target-postdue-analysis.js";
import { projectTargetPostdueCheck, type TargetPostdueCheckResultV6 } from "./target-postdue-check.js";
import { projectTargetPostdueNext, type TargetPostdueNextResultV8 } from "./target-postdue-next.js";

function isGrammar8(text: string): boolean {
  return /^  version 8$/mu.test(text);
}

function baseText(text: string): string {
  return temporalScheduleBaseText(text, scanTemporalDeclarationBlocks(text));
}

function temporalDiagnostics(text: string, maximum: number): readonly Diagnostic[] {
  const source = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY, { maxDiagnostics: maximum });
  return Object.freeze(source.diagnostics.filter(({ code }) => code.startsWith("PTSCH-10")).map((item): Diagnostic => Object.freeze({
    code: item.code, severity: item.severity, message: item.message,
    ...(item.entityId === undefined ? {} : { entityId: item.entityId }),
    ...(item.span === undefined ? {} : { span: item.span }), helpTopic: "syntax", data: item.data ?? Object.freeze({}),
  })));
}

export type Contract9CheckResult = CheckResultV5 | TargetPostdueCheckResultV6;
export type Contract9AnalysisResult = AnalysisResultV6 | TargetPostdueAnalysisResultV7;
export type Contract9NextResult = NextResultV7 | TargetPostdueNextResultV8;
type Contract9SourceOptions = { readonly sourceOperand?: string };

export function checkDocument(text: string, options: CheckOptions & Contract9SourceOptions = {}): Contract9CheckResult {
  if (!isGrammar8(text)) return checkContract8Document(text, options);
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const base = checkContract8Document(baseText(text), options);
  const extra = temporalDiagnostics(text, maximum);
  const limited = limitDiagnostics(sortDiagnostics([...base.diagnostics, ...extra]), maximum);
  const errors = extra.filter(({ severity }) => severity === "error").length;
  const warnings = extra.filter(({ severity }) => severity === "warning").length;
  const candidate = Object.freeze({ ...base, document: Object.freeze({ ...base.document, text }), documentId: base.documentId,
    grammarVersion: 8, ok: base.ok && errors === 0, diagnostics: limited.diagnostics,
    diagnosticsTruncated: base.diagnosticsTruncated || limited.truncated,
    summary: Object.freeze({ ...base.summary, errors: base.summary.errors + errors, warnings: base.summary.warnings + warnings }) });
  if (!candidate.ok) return projectTargetPostdueCheck(candidate, null);
  const context = composeContract9TemporalContext(text, base.document, options.sourceOperand ?? "FILE", "compact");
  return projectTargetPostdueCheck(candidate, context.alerts);
}

export function analyzeDocument(text: string, options: AnalyzeOptions & Contract9SourceOptions = {}): Contract9AnalysisResult {
  if (!isGrammar8(text)) return analyzeContract8Document(text, options);
  const base = analyzeContract8Document(baseText(text), options);
  const extra = temporalDiagnostics(text, normalizeMaxDiagnostics(options.maxDiagnostics));
  const candidate = Object.freeze({ ...base, grammarVersion: 8, ok: base.ok && !extra.some(({ severity }) => severity === "error"),
    diagnostics: Object.freeze([...base.diagnostics, ...extra]) });
  if (!candidate.ok) return projectTargetPostdueAnalysis(candidate, null, null, null);
  const context = composeContract9TemporalContext(text, base.document, options.sourceOperand ?? "FILE", "full", options.capacityOverrides);
  return projectTargetPostdueAnalysis(candidate, context.scheduler, context.required, context.alerts);
}

export function selectNextTasks(text: string, options: AnalyzeOptions & NextOptions & Contract9SourceOptions = {}): Contract9NextResult {
  if (!isGrammar8(text)) return selectContract8NextTasks(text, options);
  const base = selectContract8NextTasks(baseText(text), options);
  const extra = temporalDiagnostics(text, normalizeMaxDiagnostics(options.maxDiagnostics));
  const candidate = Object.freeze({ ...base, grammarVersion: 8, ok: base.ok && !extra.some(({ severity }) => severity === "error"),
    diagnostics: Object.freeze([...base.diagnostics, ...extra]) });
  if (!candidate.ok) return projectTargetPostdueNext(candidate, null);
  const context = composeContract9TemporalContext(text, base.document, options.sourceOperand ?? "FILE", "compact", options.capacityOverrides);
  return projectTargetPostdueNext(candidate, context.alerts);
}
