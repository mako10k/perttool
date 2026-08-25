import type { AdvanceHistoryBaselineCapture } from "../history/git-probe.js";
import type { PlanningDestructiveRecord } from "./projection.js";
import type { TextEdit } from "../mutation/text-edits.js";
import { scanPlanningDeclarationBlocks } from "./source-lexical.js";
import { scanTemporalDeclarationBlocks } from "../temporal-schedule/source-lexical.js";

export type PlanningHistoryGuardStatus = "not_applicable" | "passed" | "blocked" | "forced";

export interface PlanningHistoryGuard {
  readonly modelVersion: 1;
  readonly status: PlanningHistoryGuardStatus;
  readonly cause: string;
  readonly repositorySnapshotId: string | null;
  readonly repositoryRelativePath: string | null;
  readonly headCommitId: string | null;
  readonly destructiveEntityIds: readonly string[];
  readonly overlappingEntityIds: readonly string[];
  readonly forceRequested: boolean;
}

interface ComparableBlock {
  readonly kind: string;
  readonly id: string | null;
  readonly startOffset: number;
  readonly endOffset: number;
}

function blocks(text: string): readonly ComparableBlock[] {
  return Object.freeze([
    ...scanPlanningDeclarationBlocks(text).map((block) => Object.freeze({
      kind: block.kind,
      id: block.id,
      startOffset: block.span.start.offset,
      endOffset: block.span.end.offset,
    })),
    ...scanTemporalDeclarationBlocks(text)
      .filter(({ kind }) => kind === "milestone" || kind === "task")
      .map((block) => Object.freeze({
        kind: block.kind,
        id: block.id,
        startOffset: block.span.start.offset,
        endOffset: block.span.end.offset,
      })),
  ]);
}

export function planningCanonicalRecordsForEdits(
  text: string,
  documentId: string,
  edits: readonly TextEdit[],
): readonly PlanningDestructiveRecord[] {
  return Object.freeze(scanPlanningDeclarationBlocks(text).flatMap((block) => {
    if (
      block.kind !== "work" && block.kind !== "window" &&
      block.kind !== "work_order"
    ) return [];
    const changed = edits.some((edit) =>
      edit.startOffset < block.span.end.offset &&
      edit.endOffset > block.span.start.offset);
    return changed
      ? [Object.freeze({
          ownerClass: "canonical" as const,
          entityKind: block.kind,
          qualifiedId: block.id === null ? null : `${documentId}::${block.id}`,
          startOffset: block.span.start.offset,
          endOffset: block.span.end.offset,
        })]
      : [];
  }));
}

function recordKey(record: PlanningDestructiveRecord): string {
  const local = record.qualifiedId === null
    ? null
    : record.qualifiedId.slice(record.qualifiedId.indexOf("::") + 2);
  return `${record.entityKind}\u0000${local ?? ""}`;
}

function blockKey(block: ComparableBlock): string {
  return `${block.kind}\u0000${block.id ?? ""}`;
}

function selectedBlock(
  text: string,
  record: PlanningDestructiveRecord,
): ComparableBlock | null {
  const matches = blocks(text).filter((block) => blockKey(block) === recordKey(record));
  return matches.length === 1 ? matches[0]! : null;
}

function decoded(value: Uint8Array | null): string | null {
  if (value === null) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    return null;
  }
}

function projection(
  status: PlanningHistoryGuardStatus,
  cause: string,
  records: readonly PlanningDestructiveRecord[],
  baseline: AdvanceHistoryBaselineCapture | null,
  overlappingEntityIds: readonly string[] = [],
  forceRequested = false,
): PlanningHistoryGuard {
  return Object.freeze({
    modelVersion: 1 as const,
    status,
    cause,
    repositorySnapshotId: baseline?.repositorySnapshotId ?? null,
    repositoryRelativePath: baseline?.repositoryRelativePath ?? null,
    headCommitId: baseline?.headCommitId ?? null,
    destructiveEntityIds: Object.freeze([...new Set(records.map((record) =>
      record.qualifiedId ?? record.entityKind))].sort()),
    overlappingEntityIds: Object.freeze([...overlappingEntityIds].sort()),
    forceRequested,
  });
}

function recordIdentity(record: PlanningDestructiveRecord): string {
  return record.qualifiedId ?? record.entityKind;
}

function blockedOrForced(
  cause: string,
  records: readonly PlanningDestructiveRecord[],
  baseline: AdvanceHistoryBaselineCapture,
  forceRequested: boolean,
  overlappingEntityIds: readonly string[] = records.map(recordIdentity),
): PlanningHistoryGuard {
  return projection(
    forceRequested ? "forced" : "blocked",
    forceRequested ? "forced_by_option" : cause,
    records,
    baseline,
    overlappingEntityIds,
    forceRequested,
  );
}

function recordMatchesBaseline(
  currentText: string,
  head: string,
  index: string,
  record: PlanningDestructiveRecord,
): boolean {
  const currentBlock = selectedBlock(currentText, record);
  const headBlock = selectedBlock(head, record);
  const indexBlock = selectedBlock(index, record);
  if (currentBlock === null || headBlock === null || indexBlock === null) return false;
  if (record.startOffset !== currentBlock.startOffset ||
      record.endOffset !== currentBlock.endOffset) return false;
  const currentSource = currentText.slice(currentBlock.startOffset, currentBlock.endOffset);
  const headSource = head.slice(headBlock.startOffset, headBlock.endOffset);
  const indexSource = index.slice(indexBlock.startOffset, indexBlock.endOffset);
  return currentSource === headSource && headSource === indexSource;
}

function overlappingRecords(
  currentText: string,
  head: string,
  index: string,
  records: readonly PlanningDestructiveRecord[],
): readonly string[] {
  return records
    .filter((record) => !recordMatchesBaseline(currentText, head, index, record))
    .map(recordIdentity);
}

export function planningHistoryNotApplicable(
  records: readonly PlanningDestructiveRecord[],
  cause: "preview" | "separate_output" | "no_change" | "no_canonical_records" | "authority_denied",
): PlanningHistoryGuard {
  return projection("not_applicable", cause, records, null);
}

export function assessPlanningHistoryBaseline(
  currentText: string,
  recordsInput: readonly PlanningDestructiveRecord[],
  baseline: AdvanceHistoryBaselineCapture,
  forceRequested = false,
): PlanningHistoryGuard {
  const records = recordsInput.filter(({ ownerClass }) => ownerClass === "canonical");
  if (records.length === 0) {
    return projection("not_applicable", "no_canonical_records", records, baseline);
  }
  if (baseline.status !== "complete") {
    return blockedOrForced(
      baseline.cause ?? "baseline_unavailable", records, baseline, forceRequested,
    );
  }
  const capturedCurrent = decoded(baseline.currentSource);
  const head = decoded(baseline.headSource);
  const index = decoded(baseline.indexSource);
  if (capturedCurrent !== currentText || head === null || index === null) {
    return blockedOrForced("baseline_invalid", records, baseline, forceRequested);
  }
  const overlapping = overlappingRecords(currentText, head, index, records);
  if (overlapping.length > 0) {
    return blockedOrForced(
      "destructive_overlap", records, baseline, forceRequested, overlapping,
    );
  }
  return projection("passed", "baseline_matches", records, baseline, [], forceRequested);
}
