import type { TargetPlanAssuranceAdvanceResultV2WithHistory } from "./target-assurance-advance-history.js";
import type { TargetPlanAssuranceInspectionResultV1 } from "./target-assurance-inspection.js";
import type { TargetGovernanceWriteProjection } from "./target-governance-projection.js";
import type {
  LifecycleResultV4,
  MutationResultV4,
} from "./contract7-mutation.js";
import { contract6MutationResultToJson } from "./contract6-projection.js";
import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import { TOOL_VERSION } from "../version.js";

function snakeJson(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(snakeJson);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(),
      snakeJson(item),
    ]),
  );
}

function jsonPosition(position: SourceSpan["start"]) {
  return {
    offset: position.offset,
    line: position.line + 1,
    column: position.column + 1,
  };
}

function jsonDiagnostic(diagnostic: Diagnostic) {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    entity_id: diagnostic.entityId ?? null,
    span: diagnostic.span === undefined
      ? null
      : {
          start: jsonPosition(diagnostic.span.start),
          end: jsonPosition(diagnostic.span.end),
        },
    related: (diagnostic.related ?? []).map((related) => ({
      message: related.message,
      span: {
        start: jsonPosition(related.span.start),
        end: jsonPosition(related.span.end),
      },
    })),
    help_topic: null,
    guide_topic: diagnostic.helpTopic ?? null,
    expected_syntax: diagnostic.expectedSyntax ?? null,
    fixes: [],
    data: snakeJson(diagnostic.data ?? {}),
  };
}

export function contract7MutationResultToJson(
  result:
    | MutationResultV4
    | LifecycleResultV4
    | TargetPlanAssuranceAdvanceResultV2WithHistory,
  operation: string,
  source: string,
  write: TargetGovernanceWriteProjection,
): Readonly<Record<string, unknown>> {
  const base = contract6MutationResultToJson(
    (
      "advance" in result || "lifecycle" in result
        ? result
        : Object.freeze({ ...result, lifecycle: null })
    ) as unknown as Parameters<typeof contract6MutationResultToJson>[0],
    operation,
    source,
    write,
  );
  const advance = "advance" in result && result.advance !== null
    ? {
        ...(base["advance"] as Readonly<Record<string, unknown>>),
        removed_assurance_record_ids:
          result.advance.removedAssuranceRecordIds,
        updated_assurance_receipt_ids:
          result.advance.updatedAssuranceReceiptIds,
      }
    : base["advance"];
  return Object.freeze({
    ...base,
    schema_version: "advance" in result
      ? "Perttool.AdvanceResult.v2"
      : "Perttool.MutationResult.v4",
    cli_contract_version: 7,
    governance: snakeJson(result.governance),
    ...("advance" in result
      ? {}
      : {
          assurance_impact:
            "assuranceImpact" in result
              ? snakeJson(result.assuranceImpact)
              : null,
        }),
    ...(advance === undefined ? {} : { advance }),
    ...("assuranceGuard" in result
      ? { assurance_guard: snakeJson(result.assuranceGuard) }
      : {}),
  });
}

export function contract7InspectionResultToJson(
  result: TargetPlanAssuranceInspectionResultV1,
  source: string,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    schema_version: result.schemaVersion,
    cli_contract_version: 7,
    tool_version: TOOL_VERSION,
    operation: result.operation,
    ok: result.ok,
    document_id: result.documentId,
    source,
    source_digest: result.sourceDigest,
    diagnostics: result.diagnostics.map(jsonDiagnostic),
    diagnostics_truncated: result.diagnosticsTruncated,
    grammar_version: result.grammarVersion,
    selected_task_ids: result.selectedTaskIds,
    task_id: result.taskId,
    kind: result.kind,
    selected_hash: result.selectedHash,
    assurance: snakeJson(result.assurance),
  });
}

export { snakeJson as contract7SnakeJson };
