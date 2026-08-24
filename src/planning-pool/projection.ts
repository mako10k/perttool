import type { TextEdit } from "../mutation/text-edits.js";
import {
  auditPlanningReshape,
  PLANNING_RESHAPE_CORE_CAPABILITY,
} from "./reshape.js";
import type {
  PlanningReshapeAuditResult,
  PlanningReshapeRequest,
} from "./reshape-types.js";
import {
  scanPlanningDeclarationBlocks,
} from "./source-lexical.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "./source.js";
import type { PlanningPoolSourceDiagnostic } from "./source-types.js";
import { scanTemporalDeclarationBlocks } from "../temporal-schedule/source-lexical.js";

export interface PlanningProjectionCoreCapability {
  readonly id: "perttool.planning-projection-core";
  readonly version: 1;
}

export interface PlanningOwnershipTransfer {
  readonly direction: "to_strict" | "to_planning";
  readonly planningKind: "event" | "activity";
  readonly strictKind: "milestone" | "task";
  readonly qualifiedId: string;
  readonly affectedWorkIds: readonly string[];
}

export interface PlanningDestructiveRecord {
  readonly ownerClass: "temporary_draft" | "canonical";
  readonly entityKind: "event" | "activity" | "work" | "window" | "work_order" | "milestone" | "task";
  readonly qualifiedId: string | null;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface PlanningProjectionAuditResult extends PlanningReshapeAuditResult {
  readonly projectionCapability: "perttool.planning-projection-core@1";
  readonly transfers: readonly PlanningOwnershipTransfer[];
  readonly destructiveRecords: readonly PlanningDestructiveRecord[];
}

export const PLANNING_PROJECTION_CORE_CAPABILITY: PlanningProjectionCoreCapability =
  Object.freeze({ id: "perttool.planning-projection-core", version: 1 });

function requireCapability(capability: PlanningProjectionCoreCapability): void {
  if (capability !== PLANNING_PROJECTION_CORE_CAPABILITY) {
    throw new TypeError("the private planning projection Core capability is required");
  }
}

function workIds(
  request: PlanningReshapeRequest,
  kind: "event" | "activity" | "milestone" | "task",
  id: string,
): readonly string[] {
  const planning = kind === "event" || kind === "activity";
  const values = planning
    ? request.association_dispositions.flatMap((item) =>
        item.entity_kind === kind && item.entity_id === id
          ? [item.origin_work_id, item.destination_work_id].filter((value): value is string => value !== null)
          : [])
    : request.projection_link_dispositions.flatMap((item) =>
        item.strict_kind === kind && item.strict_id === id
          ? [item.origin_work_id, item.destination_work_id].filter((value): value is string => value !== null)
          : []);
  return Object.freeze([...new Set(values)].sort());
}

function transfers(request: PlanningReshapeRequest | null): readonly PlanningOwnershipTransfer[] {
  if (request === null) return Object.freeze([]);
  const fragment = request?.strict_fragment;
  if (fragment?.kind === "project") return Object.freeze([
    ...fragment.event_ids.map((id) => Object.freeze({
      direction: "to_strict" as const,
      planningKind: "event" as const,
      strictKind: "milestone" as const,
      qualifiedId: id,
      affectedWorkIds: workIds(request, "event", id),
    })),
    ...fragment.activity_ids.map((id) => Object.freeze({
      direction: "to_strict" as const,
      planningKind: "activity" as const,
      strictKind: "task" as const,
      qualifiedId: id,
      affectedWorkIds: workIds(request, "activity", id),
    })),
  ]);
  if (fragment?.kind === "defer") return Object.freeze([
    ...fragment.milestone_ids.map((id) => Object.freeze({
      direction: "to_planning" as const,
      planningKind: "event" as const,
      strictKind: "milestone" as const,
      qualifiedId: id,
      affectedWorkIds: workIds(request, "milestone", id),
    })),
    ...fragment.task_ids.map((id) => Object.freeze({
      direction: "to_planning" as const,
      planningKind: "activity" as const,
      strictKind: "task" as const,
      qualifiedId: id,
      affectedWorkIds: workIds(request, "task", id),
    })),
  ]);
  return Object.freeze([]);
}

function overlaps(edit: TextEdit, start: number, end: number): boolean {
  return edit.startOffset < end && edit.endOffset > start;
}

function planningDestructiveRecords(
  text: string,
  audit: PlanningReshapeAuditResult,
): PlanningDestructiveRecord[] {
  const records: PlanningDestructiveRecord[] = [];
  const fragment = audit.normalizedRequest!.strict_fragment;
  const projectedEvents = new Set(fragment?.kind === "project" ? fragment.event_ids : []);
  const projectedActivities = new Set(fragment?.kind === "project" ? fragment.activity_ids : []);
  for (const block of scanPlanningDeclarationBlocks(text)) {
    const qualified = block.id === null || audit.documentId === null ? null : `${audit.documentId}::${block.id}`;
    const removedTemporary = block.kind === "event" && qualified !== null && projectedEvents.has(qualified) ||
      block.kind === "activity" && qualified !== null && projectedActivities.has(qualified);
    const changedCanonical = (block.kind === "work" || block.kind === "window" || block.kind === "work_order") &&
      audit.edits.some((edit) => overlaps(edit, block.span.start.offset, block.span.end.offset));
    if (removedTemporary || changedCanonical) records.push(Object.freeze({
      ownerClass: removedTemporary ? "temporary_draft" : "canonical",
      entityKind: block.kind,
      qualifiedId: qualified,
      startOffset: block.span.start.offset,
      endOffset: block.span.end.offset,
    }));
  }
  return records;
}

function strictDestructiveRecords(
  text: string,
  audit: PlanningReshapeAuditResult,
): PlanningDestructiveRecord[] {
  const records: PlanningDestructiveRecord[] = [];
  const fragment = audit.normalizedRequest!.strict_fragment;
  const deferredTasks = new Set(fragment?.kind === "defer" ? fragment.task_ids : []);
  const deferredMilestones = new Set(fragment?.kind === "defer" ? fragment.milestone_ids : []);
  for (const block of scanTemporalDeclarationBlocks(text)) {
    if (audit.documentId === null || (block.kind !== "task" && block.kind !== "milestone")) continue;
    const qualified = `${audit.documentId}::${block.id}`;
    if ((block.kind === "task" && deferredTasks.has(qualified)) ||
        (block.kind === "milestone" && deferredMilestones.has(qualified))) records.push(Object.freeze({
      ownerClass: "canonical",
      entityKind: block.kind,
      qualifiedId: qualified,
      startOffset: block.span.start.offset,
      endOffset: block.span.end.offset,
    }));
  }
  return records;
}

function destructiveRecords(
  text: string,
  audit: PlanningReshapeAuditResult,
): readonly PlanningDestructiveRecord[] {
  if (!audit.ok || audit.normalizedRequest === null) return Object.freeze([]);
  return Object.freeze([
    ...planningDestructiveRecords(text, audit),
    ...strictDestructiveRecords(text, audit),
  ].sort((left, right) => left.startOffset - right.startOffset));
}

function failedIntentDiagnostic(): PlanningPoolSourceDiagnostic {
  return Object.freeze({
    code: "PTPOOL-108",
    severity: "error",
    message: "Planning projection Core accepts project, defer, archive, or composite intent",
    data: Object.freeze({}),
  });
}

export function auditPlanningProjection(
  text: string,
  requestInput: unknown,
  capability: PlanningProjectionCoreCapability,
): PlanningProjectionAuditResult {
  requireCapability(capability);
  const audit = auditPlanningReshape(text, requestInput, PLANNING_RESHAPE_CORE_CAPABILITY);
  const intent = audit.normalizedRequest?.intent;
  const allowed = intent === "project" || intent === "defer" || intent === "archive" || intent === "composite";
  const result: PlanningReshapeAuditResult = allowed ? audit : Object.freeze({
    ...audit,
    ok: false,
    candidateDigest: null,
    candidateText: null,
    changed: false,
    edits: Object.freeze([]),
    diagnostics: Object.freeze([...audit.diagnostics, failedIntentDiagnostic()]),
  });
  return Object.freeze({
    ...result,
    projectionCapability: "perttool.planning-projection-core@1",
    transfers: transfers(result.normalizedRequest),
    destructiveRecords: destructiveRecords(text, result),
  });
}

export function planningProjectionSourceIsValid(text: string): boolean {
  return parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY).ok;
}
