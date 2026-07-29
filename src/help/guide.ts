import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import { TOOL_VERSION } from "../version.js";
import {
  getHelp,
  type HelpLevel,
  type HelpResult,
} from "./registry.js";

export interface GuideProjectionResult extends HelpResult {
  readonly schemaVersion: "Perttool.GuideResult.v1";
  readonly cliContractVersion: 4 | 5 | 6;
  readonly toolVersion: string;
  readonly operation: "guide";
}

export interface GuideResult extends GuideProjectionResult {
  readonly cliContractVersion: 4;
}

function jsonPosition(position: SourceSpan["start"]): Readonly<
  Record<string, number>
> {
  return {
    offset: position.offset,
    line: position.line + 1,
    column: position.column + 1,
  };
}

function jsonSpan(span: SourceSpan): Readonly<Record<string, unknown>> {
  return {
    start: jsonPosition(span.start),
    end: jsonPosition(span.end),
  };
}

function guideDiagnosticToJson(
  diagnostic: Diagnostic,
): Readonly<Record<string, unknown>> {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    entity_id: diagnostic.entityId ?? null,
    span: diagnostic.span === undefined ? null : jsonSpan(diagnostic.span),
    related: (diagnostic.related ?? []).map((related) => ({
      message: related.message,
      span: jsonSpan(related.span),
    })),
    help_topic: null,
    guide_topic: diagnostic.helpTopic ?? null,
    expected_syntax: diagnostic.expectedSyntax ?? null,
    fixes: [],
    data: diagnostic.data ?? {},
  };
}

function guideInvocation(topicId: string): string {
  return ["perttool", "guide", ...topicId.split("."), "--level", "quick"]
    .join(" ");
}

function renderGuideDiagnostic(diagnostic: Diagnostic): string {
  return [
    `${diagnostic.code} ${diagnostic.severity}: ${diagnostic.message}`,
    ...(diagnostic.helpTopic === undefined
      ? []
      : [`  guide: ${guideInvocation(diagnostic.helpTopic)}`]),
  ].join("\n");
}

export function getGuide(
  topicId: string | null,
  level: HelpLevel,
): GuideResult {
  const help = getHelp(topicId, level);
  return Object.freeze({
    schemaVersion: "Perttool.GuideResult.v1",
    cliContractVersion: 4,
    toolVersion: TOOL_VERSION,
    operation: "guide",
    ...help,
  });
}

export function guideResultToJson(
  result: GuideProjectionResult,
): Readonly<Record<string, unknown>> {
  return {
    schema_version: result.schemaVersion,
    cli_contract_version: result.cliContractVersion,
    tool_version: result.toolVersion,
    operation: result.operation,
    ok: result.ok,
    diagnostics: result.diagnostics.map(guideDiagnosticToJson),
    topic_id: result.topicId,
    level: result.level,
    title: result.title,
    summary: result.summary,
    sections: result.sections,
    syntax: result.syntax,
    examples: result.examples,
    related: result.related,
    topics: result.topics,
  };
}

export function serializeGuideResult(result: GuideProjectionResult): string {
  return `${JSON.stringify(guideResultToJson(result))}\n`;
}

export function renderGuideResult(result: GuideProjectionResult): string {
  if (!result.ok) {
    return `${result.diagnostics.map(renderGuideDiagnostic).join("\n")}\n`;
  }

  const lines = [result.title, "", result.summary];
  if (result.topics.length > 0) {
    lines.push("", "Topics:");
    for (const topic of result.topics) {
      lines.push(`  ${topic.id.padEnd(12)} ${topic.summary}`);
    }
  }
  for (const section of result.sections) {
    lines.push("", section.title, section.body);
  }
  if (result.syntax.length > 0) {
    lines.push(
      "",
      "Syntax:",
      ...result.syntax.map((line) => `  ${line}`),
    );
  }
  if (result.examples.length > 0) {
    lines.push(
      "",
      "Examples:",
      ...result.examples.map(
        (example) => `  ${example.id}: ${example.text}`,
      ),
    );
  }
  if (result.related.length > 0) {
    lines.push("", `Related: ${result.related.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}
