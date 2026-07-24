import { digestDocumentBytes } from "../io/document-file.js";
import type { DocumentWriteResult } from "../io/safe-write.js";
import type { Diagnostic } from "../model/diagnostics.js";
import { mutationDiagnostic } from "../mutation/diagnostics.js";
import type { TextEdit } from "../mutation/text-edits.js";
import { TOOL_VERSION } from "../version.js";
import { checkDocument } from "./check.js";

export type ProjectInitDurationUnit = "day" | "hour" | "point";

export interface ProjectInitRequest {
  readonly projectId: string;
  readonly title: string;
  readonly durationUnit: ProjectInitDurationUnit;
  readonly initialMilestone: string;
  readonly initialMilestoneTitle: string;
  readonly finish: string;
  readonly version?: number;
  readonly asOf?: string;
  readonly velocity?: string;
}

export interface ProjectInitWrite {
  readonly mode: "preview" | "out";
  readonly target: string | null;
  readonly written: boolean;
}

export interface ProjectInitResult {
  readonly schemaVersion: "Perttool.InitResult.v1";
  readonly cliContractVersion: 3;
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

const requestFields = new Set([
  "projectId",
  "title",
  "durationUnit",
  "initialMilestone",
  "initialMilestoneTitle",
  "finish",
  "version",
  "asOf",
  "velocity",
]);

const previewWrite: ProjectInitWrite = Object.freeze({
  mode: "preview",
  target: null,
  written: false,
});

function requestError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "project init request is not an object";
  }
  const request = value as Record<string, unknown>;
  if (Object.keys(request).some((name) => !requestFields.has(name))) {
    return "project init request contains unsupported fields";
  }
  for (const field of [
    "projectId",
    "title",
    "initialMilestone",
    "initialMilestoneTitle",
    "finish",
  ]) {
    if (typeof request[field] !== "string") {
      return `project init request requires string field ${field}`;
    }
  }
  if (
    request["durationUnit"] !== "day" &&
    request["durationUnit"] !== "hour" &&
    request["durationUnit"] !== "point"
  ) {
    return "project init durationUnit must be day, hour, or point";
  }
  if (
    request["version"] !== undefined &&
    (!Number.isSafeInteger(request["version"]) ||
      (request["version"] as number) < 0 ||
      (request["version"] as number) > 2_147_483_647)
  ) {
    return "project init version must be an integer from 0 to 2147483647";
  }
  for (const field of ["asOf", "velocity"]) {
    if (request[field] !== undefined && typeof request[field] !== "string") {
      return `project init ${field} must be a string when provided`;
    }
  }
  if (request["finish"] !== request["initialMilestone"]) {
    return "project init finish must equal initialMilestone in initialization version 1";
  }
  if (request["durationUnit"] === "point" && request["velocity"] === undefined) {
    return "project init with point durationUnit requires velocity";
  }
  return undefined;
}

function renderCandidate(request: ProjectInitRequest): string {
  const fields = [
    `  version ${request.version ?? 1}`,
    `  title ${JSON.stringify(request.title)}`,
    ...(request.asOf === undefined ? [] : [`  as_of ${request.asOf}`]),
    `  duration_unit ${request.durationUnit}`,
    ...(request.velocity === undefined ? [] : [`  velocity ${request.velocity}`]),
    `  finish ${request.finish}`,
  ];
  return [
    `project ${request.projectId}:`,
    ...fields,
    "",
    `milestone ${request.initialMilestone}:`,
    `  title ${JSON.stringify(request.initialMilestoneTitle)}`,
    "  state reached",
    "",
  ].join("\n");
}

function result(
  values: Omit<
    ProjectInitResult,
    | "schemaVersion"
    | "cliContractVersion"
    | "toolVersion"
    | "operation"
    | "source"
    | "sourceDigest"
    | "write"
  >,
): ProjectInitResult {
  return {
    schemaVersion: "Perttool.InitResult.v1",
    cliContractVersion: 3,
    toolVersion: TOOL_VERSION,
    operation: "project.init",
    source: null,
    sourceDigest: null,
    write: previewWrite,
    ...values,
  };
}

export function planProjectInit(request: unknown): ProjectInitResult {
  const error = requestError(request);
  if (error !== undefined) {
    return result({
      ok: false,
      documentId: null,
      candidateText: null,
      candidateDigest: null,
      edits: [],
      diagnostics: [mutationDiagnostic("PTMUT-301", error)],
      diagnosticsTruncated: false,
    });
  }

  const candidateText = renderCandidate(request as ProjectInitRequest);
  const checked = checkDocument(candidateText);
  if (!checked.ok) {
    return result({
      ok: false,
      documentId: null,
      candidateText: null,
      candidateDigest: null,
      edits: [],
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    });
  }
  const edit = Object.freeze({
    startOffset: 0,
    endOffset: 0,
    replacement: candidateText,
  });
  return result({
    ok: true,
    documentId: checked.documentId,
    candidateText,
    candidateDigest: digestDocumentBytes(Buffer.from(candidateText, "utf8")),
    edits: Object.freeze([edit]),
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
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
  return {
    ...value,
    write: Object.freeze({
      mode: "out",
      target: output.target,
      written: true,
    }),
  };
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

export function serializeProjectInitResult(
  value: ProjectInitResult,
): string {
  return `${JSON.stringify(projectInitResultToJson(value), null, 2)}\n`;
}

export function renderProjectInitResult(
  value: ProjectInitResult,
): string {
  return value.candidateText ?? "";
}
