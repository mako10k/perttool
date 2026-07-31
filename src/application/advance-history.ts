import {
  captureAdvanceHistoryBaseline,
  type AdvanceHistoryBaselineCapture,
  type AdvanceHistoryBaselineDependencies,
  type AdvanceHistoryBaselineRecheck,
} from "../history/git-probe.js";
import {
  assessAdvanceHistorySafety,
  deriveAdvanceDestructiveRecords,
  type AdvanceDestructiveRecordV1,
  type AdvanceHistoryAssessmentCause,
} from "../history/advance-history.js";
import {
  documentContentFromBytes,
  digestDocumentBytes,
} from "../io/document-file.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import {
  TARGET_GRAMMAR_5_CAPABILITY,
} from "../parser/document-parser.js";
import {
  validateTargetGrammar5Document,
} from "../semantic/target-validator.js";
import type {
  TargetActualsAdvanceResultV3,
} from "./target-actuals-advance.js";

export const ADVANCE_RESULT_SCHEMA_VERSION =
  "Perttool.AdvanceResult.v1" as const;

export type AdvanceHistoryGuardStatus =
  | "not_applicable"
  | "passed"
  | "blocked"
  | "forced";

export type AdvanceHistoryGuardCause =
  | "preview"
  | "separate_output"
  | "no_change"
  | "no_destructive_records"
  | "authority_denied"
  | "warning_denied"
  | "baseline_matches"
  | "destructive_overlap"
  | "no_repository"
  | "no_head"
  | "untracked_target"
  | "ambiguous_path"
  | "unmerged_index"
  | "git_unavailable"
  | "baseline_read_failed"
  | "baseline_invalid"
  | "correspondence_missing"
  | "correspondence_ambiguous"
  | "forced_by_option";

export interface AdvanceHistoryGuardV1 {
  readonly modelVersion: 1;
  readonly status: AdvanceHistoryGuardStatus;
  readonly cause: AdvanceHistoryGuardCause;
  readonly repositorySnapshotId: string | null;
  readonly repositoryRelativePath: string | null;
  readonly headCommitId: string | null;
  readonly sourceDigest: string;
  readonly candidateDigest: string;
  readonly sourceModifiedAt: string | null;
  readonly sourceBytes: number;
  readonly candidateBytes: number;
  readonly diffAddedLines: number;
  readonly diffRemovedLines: number;
  readonly destructiveEntityIds: readonly string[];
  readonly overlappingEntityIds: readonly string[];
  readonly forceRequested: boolean;
}

export interface AdvanceResultV1
  extends Omit<TargetActualsAdvanceResultV3, "schemaVersion"> {
  readonly schemaVersion: typeof ADVANCE_RESULT_SCHEMA_VERSION;
  readonly historyGuard: AdvanceHistoryGuardV1 | null;
}

export interface AdvanceHistoryPreparationOptions {
  readonly mode: "preview" | "out" | "in_place";
  readonly sourceBytes: Uint8Array;
  readonly sourceModifiedAt: string | null;
  readonly targetPath?: string;
  readonly forceRequested?: boolean;
  readonly warningDenied?: boolean;
  readonly maxDiagnostics?: number;
  readonly baselineDependencies?: AdvanceHistoryBaselineDependencies;
}

export interface PreparedAdvanceHistory {
  readonly result: AdvanceResultV1;
  readonly baseline: AdvanceHistoryBaselineCapture | null;
}

function diffCounts(diff: string | null): {
  readonly added: number;
  readonly removed: number;
} {
  let added = 0;
  let removed = 0;
  for (const line of (diff ?? "").split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) added += 1;
    if (line.startsWith("-") && !line.startsWith("---")) removed += 1;
  }
  return { added, removed };
}

function recordsFor(
  text: string,
  result: TargetActualsAdvanceResultV3 | AdvanceResultV1,
): readonly AdvanceDestructiveRecordV1[] | null {
  if (
    result.updatedText === null ||
    result.updatedDigest === null ||
    result.advance === null
  ) {
    return null;
  }
  const checked = validateTargetGrammar5Document(
    text,
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  if (!checked.ok || checked.validatedDocument === null) {
    throw new Error(
      "advance history candidate has no validated original document",
    );
  }
  return deriveAdvanceDestructiveRecords(
    text,
    checked.validatedDocument.document,
    result.advance,
  );
}

function stableEntityIds(
  records: readonly AdvanceDestructiveRecordV1[],
): readonly string[] {
  return Object.freeze(
    [...new Set(records.map(({ entityId }) => entityId))].sort(),
  );
}

function guard(
  result: TargetActualsAdvanceResultV3 | AdvanceResultV1,
  records: readonly AdvanceDestructiveRecordV1[],
  options: AdvanceHistoryPreparationOptions,
  status: AdvanceHistoryGuardStatus,
  cause: AdvanceHistoryGuardCause,
  overlappingEntityIds: readonly string[] = [],
  baseline: AdvanceHistoryBaselineCapture | null = null,
): AdvanceHistoryGuardV1 {
  if (result.updatedText === null || result.updatedDigest === null) {
    throw new Error("advance history guard requires a candidate");
  }
  const counts = diffCounts(result.diff);
  return Object.freeze({
    modelVersion: 1,
    status,
    cause,
    repositorySnapshotId: baseline?.repositorySnapshotId ?? null,
    repositoryRelativePath: baseline?.repositoryRelativePath ?? null,
    headCommitId: baseline?.headCommitId ?? null,
    sourceDigest: result.originalDigest,
    candidateDigest: result.updatedDigest,
    sourceModifiedAt:
      baseline?.sourceModifiedAt ?? options.sourceModifiedAt,
    sourceBytes: options.sourceBytes.byteLength,
    candidateBytes: Buffer.byteLength(result.updatedText, "utf8"),
    diffAddedLines: counts.added,
    diffRemovedLines: counts.removed,
    destructiveEntityIds: stableEntityIds(records),
    overlappingEntityIds: Object.freeze(
      [...overlappingEntityIds].sort(),
    ),
    forceRequested: options.forceRequested ?? false,
  });
}

function resultWithGuard(
  result: TargetActualsAdvanceResultV3 | AdvanceResultV1,
  historyGuard: AdvanceHistoryGuardV1 | null,
  diagnostics: readonly Diagnostic[] = result.diagnostics,
  diagnosticsTruncated = result.diagnosticsTruncated,
  ok = result.ok,
): AdvanceResultV1 {
  return Object.freeze({
    ...result,
    schemaVersion: ADVANCE_RESULT_SCHEMA_VERSION,
    ok,
    diagnostics,
    diagnosticsTruncated,
    historyGuard,
  });
}

function historyDiagnostic(
  code: "PTADV-101" | "PTADV-102" | "PTADV-103",
  severity: "error" | "warning",
  message: string,
  data: Readonly<Record<string, unknown>>,
): Diagnostic {
  return Object.freeze({
    code,
    severity,
    message,
    helpTopic: "editing",
    data,
  });
}

function appendDiagnostic(
  result: AdvanceResultV1,
  diagnostic: Diagnostic,
  maximum: number,
  ok: boolean,
): AdvanceResultV1 {
  const limited = limitDiagnostics(
    sortDiagnostics([...result.diagnostics, diagnostic]),
    maximum,
  );
  return resultWithGuard(
    result,
    result.historyGuard,
    limited.diagnostics,
    result.diagnosticsTruncated || limited.truncated,
    ok,
  );
}

function baselineCause(
  cause: AdvanceHistoryBaselineCapture["cause"],
): AdvanceHistoryGuardCause {
  switch (cause) {
    case "no_repository":
    case "no_head":
    case "untracked_target":
    case "ambiguous_path":
    case "unmerged_index":
    case "git_unavailable":
    case "baseline_read_failed":
    case "correspondence_missing":
      return cause;
    case "target_changed":
    case "head_changed":
    case "index_changed":
    case null:
      return "baseline_read_failed";
  }
}

function assessmentCause(
  cause: AdvanceHistoryAssessmentCause,
): AdvanceHistoryGuardCause {
  return cause;
}

function blockedResult(
  result: TargetActualsAdvanceResultV3 | AdvanceResultV1,
  records: readonly AdvanceDestructiveRecordV1[],
  options: AdvanceHistoryPreparationOptions,
  cause: AdvanceHistoryGuardCause,
  overlappingEntityIds: readonly string[],
  baseline: AdvanceHistoryBaselineCapture | null,
): AdvanceResultV1 {
  const forced = options.forceRequested ?? false;
  const withGuard = resultWithGuard(
    result,
    guard(
      result,
      records,
      options,
      forced ? "forced" : "blocked",
      forced ? "forced_by_option" : cause,
      overlappingEntityIds,
      baseline,
    ),
  );
  const diagnostic = forced
    ? historyDiagnostic(
        "PTADV-103",
        "warning",
        "advance history loss was explicitly forced",
        Object.freeze({
          cause,
          entity_ids: Object.freeze([
            ...(overlappingEntityIds.length > 0
              ? overlappingEntityIds
              : stableEntityIds(records)),
          ]),
        }),
      )
    : historyDiagnostic(
        "PTADV-101",
        "error",
        "advance history proof is blocked",
        Object.freeze({
          cause,
          entity_ids: Object.freeze([
            ...(overlappingEntityIds.length > 0
              ? overlappingEntityIds
              : stableEntityIds(records)),
          ]),
        }),
      );
  return appendDiagnostic(
    withGuard,
    diagnostic,
    normalizeMaxDiagnostics(options.maxDiagnostics),
    forced && result.ok,
  );
}

export function withPreviewAdvanceHistory(
  text: string,
  result: TargetActualsAdvanceResultV3,
): AdvanceResultV1 {
  const sourceBytes = Buffer.from(text, "utf8");
  const records = recordsFor(text, result);
  return resultWithGuard(
    result,
    records === null
      ? null
      : guard(
          result,
          records,
          {
            mode: "preview",
            sourceBytes,
            sourceModifiedAt: null,
          },
          "not_applicable",
          "preview",
        ),
  );
}

export async function prepareAdvanceHistory(
  text: string,
  result: TargetActualsAdvanceResultV3 | AdvanceResultV1,
  options: AdvanceHistoryPreparationOptions,
): Promise<PreparedAdvanceHistory> {
  if (digestDocumentBytes(options.sourceBytes) !== result.originalDigest) {
    throw new Error("advance history source bytes do not match the plan");
  }
  const records = recordsFor(text, result);
  if (records === null) {
    return Object.freeze({
      result: resultWithGuard(result, null),
      baseline: null,
    });
  }
  const notApplicable = (
    cause: Extract<
      AdvanceHistoryGuardCause,
      | "preview"
      | "separate_output"
      | "no_change"
      | "no_destructive_records"
      | "authority_denied"
      | "warning_denied"
    >,
  ): PreparedAdvanceHistory =>
    Object.freeze({
      result: resultWithGuard(
        result,
        guard(
          result,
          records,
          options,
          "not_applicable",
          cause,
        ),
      ),
      baseline: null,
    });
  if (options.mode === "preview") return notApplicable("preview");
  if (options.mode === "out") return notApplicable("separate_output");
  if (!result.changed) return notApplicable("no_change");
  if (records.length === 0) return notApplicable("no_destructive_records");
  if (
    result.governance === null ||
    !result.governance.writeAuthorized
  ) {
    return notApplicable("authority_denied");
  }
  if (options.warningDenied === true) {
    return notApplicable("warning_denied");
  }
  if (options.targetPath === undefined) {
    throw new Error("in-place advance history assessment requires a path");
  }

  const baseline = await captureAdvanceHistoryBaseline(
    {
      targetPath: options.targetPath,
      expectedSourceDigest: result.originalDigest,
    },
    options.baselineDependencies,
  );
  if (baseline.status !== "complete") {
    return Object.freeze({
      result: blockedResult(
        result,
        records,
        options,
        baselineCause(baseline.cause),
        [],
        baseline,
      ),
      baseline,
    });
  }
  if (
    baseline.currentSource === null ||
    baseline.headSource === null ||
    baseline.indexSource === null ||
    !Buffer.from(baseline.currentSource).equals(
      Buffer.from(options.sourceBytes),
    )
  ) {
    return Object.freeze({
      result: blockedResult(
        result,
        records,
        options,
        "baseline_invalid",
        [],
        baseline,
      ),
      baseline,
    });
  }

  let current;
  let head;
  try {
    current = documentContentFromBytes(baseline.currentSource);
    head = documentContentFromBytes(baseline.headSource);
  } catch {
    return Object.freeze({
      result: blockedResult(
        result,
        records,
        options,
        "baseline_invalid",
        [],
        baseline,
      ),
      baseline,
    });
  }
  const currentChecked = validateTargetGrammar5Document(
    current.text,
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  const headChecked = validateTargetGrammar5Document(
    head.text,
    TARGET_GRAMMAR_5_CAPABILITY,
  );
  if (
    !currentChecked.ok ||
    currentChecked.validatedDocument === null ||
    !headChecked.ok ||
    headChecked.validatedDocument === null
  ) {
    return Object.freeze({
      result: blockedResult(
        result,
        records,
        options,
        "baseline_invalid",
        [],
        baseline,
      ),
      baseline,
    });
  }
  const assessed = assessAdvanceHistorySafety({
    currentText: current.text,
    currentDocument: currentChecked.validatedDocument.document,
    currentSource: baseline.currentSource,
    headText: head.text,
    headDocument: headChecked.validatedDocument.document,
    headSource: baseline.headSource,
    indexSource: baseline.indexSource,
    destructiveRecords: records,
  });
  if (assessed.status === "blocked") {
    return Object.freeze({
      result: blockedResult(
        result,
        records,
        options,
        assessmentCause(assessed.cause),
        assessed.overlappingEntityIds,
        baseline,
      ),
      baseline,
    });
  }
  return Object.freeze({
    result: resultWithGuard(
      result,
      guard(
        result,
        records,
        options,
        "passed",
        "baseline_matches",
        [],
        baseline,
      ),
    ),
    baseline,
  });
}

export function withAdvanceHistoryRace(
  result: AdvanceResultV1,
  recheck: AdvanceHistoryBaselineRecheck,
  maxDiagnostics?: number,
): AdvanceResultV1 {
  if (recheck.ok) return result;
  return appendDiagnostic(
    result,
    historyDiagnostic(
      "PTADV-102",
      "error",
      "advance history baseline changed after assessment",
      Object.freeze({
        cause: recheck.cause,
        operation: recheck.operation,
      }),
    ),
    normalizeMaxDiagnostics(maxDiagnostics),
    false,
  );
}

function list(values: readonly string[]): string {
  return values.length === 0 ? "-" : values.join(",");
}

export function renderAdvanceHistoryGuard(
  value: AdvanceHistoryGuardV1,
): string {
  const head =
    value.headCommitId === null ? "-" : value.headCommitId.slice(0, 12);
  return [
    `HISTORY_GUARD status=${value.status} cause=${value.cause}`,
    `HISTORY_TARGET path=${value.repositoryRelativePath ?? "-"} head=${head} modified_at=${value.sourceModifiedAt ?? "-"}`,
    `HISTORY_CHANGE source_bytes=${value.sourceBytes} candidate_bytes=${value.candidateBytes} added_lines=${value.diffAddedLines} removed_lines=${value.diffRemovedLines}`,
    `HISTORY_ENTITIES destructive=${list(value.destructiveEntityIds)} overlapping=${list(value.overlappingEntityIds)}`,
    `HISTORY_FORCE requested=${value.forceRequested}`,
    `HISTORY_DIGEST source=${value.sourceDigest} candidate=${value.candidateDigest} repository=${value.repositorySnapshotId ?? "-"}`,
    "",
  ].join("\n");
}
