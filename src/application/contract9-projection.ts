import type { TargetPostdueScheduleAnalysis } from "./target-postdue-analysis.js";
import type { TargetScheduleAlertProjection } from "./target-postdue-projection.js";
import type { TemporalScheduleSourceModel } from "../temporal-schedule/source-types.js";
import type { Contract9CheckResult } from "./contract9-temporal.js";
import type { Contract9ProjectResult } from "./contract9-project.js";
import { contract7ProjectResultToJson } from "./contract7-project.js";
import { contract6WorkEventToJson } from "./contract6-projection.js";
import { TOOL_VERSION } from "../version.js";

function isPosition(value: Readonly<Record<string, unknown>>): boolean {
  return Object.keys(value).length === 3 && Number.isInteger(value["offset"]) &&
    Number.isInteger(value["line"]) && Number.isInteger(value["column"]);
}

export function contract9WireJson(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(contract9WireJson);
  if (value === null || typeof value !== "object") return value;
  const source = value as Readonly<Record<string, unknown>>;
  if (isPosition(source)) return Object.freeze({ offset: source["offset"],
    line: (source["line"] as number) + 1, column: (source["column"] as number) + 1 });
  return Object.freeze(Object.fromEntries(Object.entries(source).map(([key, item]) => [
    key.replace(/([a-z0-9])([A-Z])/gu, "$1_$2").toLowerCase(), contract9WireJson(item),
  ])));
}

export function contract9ProjectTemporalToJson(value: TemporalScheduleSourceModel | null): unknown {
  return contract9WireJson(value);
}

export function contract9AnalysisTemporalToJson(value: TargetPostdueScheduleAnalysis | null): unknown {
  return contract9WireJson(value);
}

export function contract9ScheduleAlertsToJson(value: TargetScheduleAlertProjection | null): unknown {
  return contract9WireJson(value);
}

export interface Contract9WireEnvelope {
  readonly source: string;
  readonly sourceDigest: string;
  readonly ok?: boolean;
}

export function contract9ProjectResultToJson(result: Contract9ProjectResult, envelope: Contract9WireEnvelope): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...contract7ProjectResultToJson(result, envelope.source, envelope.sourceDigest, envelope.ok ?? result.ok),
    schema_version: "Perttool.ProjectResult.v5", cli_contract_version: 9,
    temporal_schedule: contract9ProjectTemporalToJson(result.temporalSchedule) });
}

export function contract9CheckResultToJson(result: Contract9CheckResult, envelope: Contract9WireEnvelope): Readonly<Record<string, unknown>> {
  return Object.freeze({ schema_version: "Perttool.CheckResult.v6", cli_contract_version: 9, tool_version: TOOL_VERSION,
    operation: "document.check", ok: envelope.ok ?? result.ok, document_id: result.documentId, source: envelope.source,
    source_digest: envelope.sourceDigest, diagnostics: contract9WireJson(result.diagnostics),
    diagnostics_truncated: result.diagnosticsTruncated, grammar_version: result.grammarVersion, summary: result.summary,
    temporal_inputs: contract9WireJson(result.temporalInputs),
    actuals_inputs: result.actualsInputs === null ? null : Object.freeze({ model_version: result.actualsInputs.modelVersion,
      events: result.actualsInputs.events.map(contract6WorkEventToJson) }), assurance: contract9WireJson(result.assurance),
    assurance_state_counts: contract9WireJson(result.assuranceStateCounts), acceptance: contract9WireJson(result.acceptance),
    schedule_alerts: contract9ScheduleAlertsToJson(result.scheduleAlerts) });
}

function command(argv: readonly string[]): string {
  return argv.map((value) => JSON.stringify(value)).join(" ");
}

export function renderContract9ScheduleAlerts(value: TargetScheduleAlertProjection | null): string {
  if (value === null) return "";
  const lines: string[] = [];
  for (const occurrence of value.occurrences) {
    lines.push(`${occurrence.kind} ${occurrence.subject.kind}=${occurrence.subject.id} event=${occurrence.event} target=${occurrence.target.targetKind}:${occurrence.target.sourceText} late_seconds=${occurrence.comparison.signedDifferenceSeconds.numerator}/${occurrence.comparison.signedDifferenceSeconds.denominator} proof=${occurrence.proof.kind}${occurrence.proof.optimal === false ? " optimal=false" : ""}`);
    if (occurrence.driver.state !== "available" && occurrence.driver.analysisArgv !== null) {
      lines.push(`ANALYZE ${command(occurrence.driver.analysisArgv)}`);
    }
  }
  if (value.truncation.truncated) lines.push(`SCHEDULE_ALERTS_TRUNCATED emitted=${value.truncation.emitted} total=${value.truncation.total ?? "unknown"}`);
  return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
}
