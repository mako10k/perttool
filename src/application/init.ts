import type { DocumentWriteResult } from "../io/safe-write.js";
import type { Diagnostic } from "../model/diagnostics.js";
import type { TextEdit } from "../mutation/text-edits.js";
import { TARGET_GRAMMAR_4_CAPABILITY } from "../parser/document-parser.js";
import { TOOL_VERSION } from "../version.js";
import {
  planTargetGovernanceProjectInit,
  type TargetGovernanceProjectInitRequest,
} from "./target-governance-init.js";

export type ProjectInitDurationUnit = "day" | "hour" | "point";

export interface ProjectInitRequest
  extends TargetGovernanceProjectInitRequest {}

export interface ProjectInitWrite {
  readonly mode: "preview" | "out";
  readonly target: string | null;
  readonly written: boolean;
}

export interface ProjectInitResult {
  readonly schemaVersion: "Perttool.InitResult.v1";
  readonly cliContractVersion: 5;
  readonly toolVersion: string;
  readonly operation: "project.init";
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly source: null;
  readonly sourceDigest: null;
  readonly candidateText: string | null;
  readonly candidateDigest: string | null;
  readonly edits: readonly TextEdit[];
  readonly write: ProjectInitWrite;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export function planProjectInit(request: unknown): ProjectInitResult {
  const planned = planTargetGovernanceProjectInit(
    request,
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  return Object.freeze({
    schemaVersion: "Perttool.InitResult.v1",
    cliContractVersion: 5,
    toolVersion: TOOL_VERSION,
    operation: "project.init",
    ok: planned.ok,
    documentId: planned.documentId,
    source: null,
    sourceDigest: null,
    candidateText: planned.candidateText,
    candidateDigest: planned.candidateDigest,
    edits: planned.edits,
    write: planned.write,
    diagnostics: planned.diagnostics,
    diagnosticsTruncated: planned.diagnosticsTruncated,
  });
}

export function withProjectInitOutput(
  value: ProjectInitResult,
  output: DocumentWriteResult,
): ProjectInitResult {
  if (!value.ok || value.candidateText === null || value.candidateDigest === null) {
    throw new Error("cannot attach output state to a failed project init result");
  }
  if (
    output.mode !== "out" ||
    !output.written ||
    output.target.length === 0 ||
    output.digest !== value.candidateDigest
  ) {
    throw new Error("project init output does not match the candidate");
  }
  return Object.freeze({
    ...value,
    write: Object.freeze({
      mode: "out",
      target: output.target,
      written: true,
    }),
  });
}

function diagnosticToJson(
  diagnostic: Diagnostic,
): Readonly<Record<string, unknown>> {
  const spanToJson = (
    span: NonNullable<Diagnostic["span"]>,
  ): Readonly<Record<string, unknown>> => ({
    start: {
      offset: span.start.offset,
      line: span.start.line,
      column: span.start.column,
    },
    end: {
      offset: span.end.offset,
      line: span.end.line,
      column: span.end.column,
    },
  });
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    entity_id: diagnostic.entityId ?? null,
    span: diagnostic.span === undefined ? null : spanToJson(diagnostic.span),
    related: (diagnostic.related ?? []).map((related) => ({
      message: related.message,
      span: spanToJson(related.span),
    })),
    help_topic: null,
    guide_topic: diagnostic.helpTopic ?? null,
    expected_syntax: diagnostic.expectedSyntax ?? null,
    fixes: [],
    data: diagnostic.data ?? {},
  };
}

export function projectInitResultToJson(
  value: ProjectInitResult,
): Readonly<Record<string, unknown>> {
  return {
    schema_version: value.schemaVersion,
    cli_contract_version: value.cliContractVersion,
    tool_version: value.toolVersion,
    operation: value.operation,
    ok: value.ok,
    document_id: value.documentId,
    source: value.source,
    source_digest: value.sourceDigest,
    candidate_text: value.candidateText,
    candidate_digest: value.candidateDigest,
    edits: value.edits.map((edit) => ({
      start_offset: edit.startOffset,
      end_offset: edit.endOffset,
      replacement: edit.replacement,
    })),
    write: {
      mode: value.write.mode,
      target: value.write.target,
      written: value.write.written,
    },
    diagnostics: value.diagnostics.map(diagnosticToJson),
    diagnostics_truncated: value.diagnosticsTruncated,
  };
}

export function serializeProjectInitResult(value: ProjectInitResult): string {
  return `${JSON.stringify(projectInitResultToJson(value), null, 2)}\n`;
}

export function renderProjectInitResult(value: ProjectInitResult): string {
  return value.candidateText ?? "";
}
