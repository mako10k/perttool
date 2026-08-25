import type { TextEdit } from "../mutation/text-edits.js";
import {
  planningFields,
  scanPlanningDeclarationBlocks,
  type PlanningDeclarationBlock,
} from "./source-lexical.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "./source.js";
import type { PlanningDestructiveRecord } from "./projection.js";
import type { PlanningPoolSourceModel } from "./source-types.js";

export interface PlanningAdvanceCleanup {
  readonly edits: readonly TextEdit[];
  readonly removedPlanningLinks: readonly string[];
  readonly archivedWorkIds: readonly string[];
  readonly destructiveRecords: readonly PlanningDestructiveRecord[];
}

function lineRemoval(line: { readonly start: number; readonly end: number }): TextEdit {
  return Object.freeze({
    startOffset: line.start,
    endOffset: line.end,
    replacement: "",
  });
}

function fieldRemoval(
  field: ReturnType<typeof planningFields>[number],
): TextEdit {
  return Object.freeze({
    startOffset: field.line.start,
    endOffset: field.children.at(-1)?.end ?? field.line.end,
    replacement: "",
  });
}

function qualified(documentId: string, id: string): string {
  return `${documentId}::${id}`;
}

function emptyCleanup(): PlanningAdvanceCleanup {
  return Object.freeze({
    edits: Object.freeze([]),
    removedPlanningLinks: Object.freeze([]),
    archivedWorkIds: Object.freeze([]),
    destructiveRecords: Object.freeze([]),
  });
}

function removedLinkProjection(
  model: PlanningPoolSourceModel,
  removedMilestones: ReadonlySet<string>,
  removedTasks: ReadonlySet<string>,
): Readonly<{
  affectedWorkIds: ReadonlySet<string>;
  links: readonly string[];
}> {
  const affectedWorkIds = new Set<string>();
  const links: string[] = [];
  for (const work of model.works) {
    for (const link of work.milestoneLinks) {
      if (!removedMilestones.has(link.id)) continue;
      affectedWorkIds.add(work.id);
      links.push(`${work.qualifiedId}->milestone:${qualified(model.documentId, link.id)}`);
    }
    for (const link of work.taskLinks) {
      if (!removedTasks.has(link.id)) continue;
      affectedWorkIds.add(work.id);
      links.push(`${work.qualifiedId}->task:${qualified(model.documentId, link.id)}`);
    }
  }
  return { affectedWorkIds, links: Object.freeze(links) };
}

function archiveCandidates(
  model: PlanningPoolSourceModel,
  affectedWorkIds: ReadonlySet<string>,
  removedMilestones: ReadonlySet<string>,
  removedTasks: ReadonlySet<string>,
  enabled: boolean,
): ReadonlySet<string> {
  if (!enabled) return new Set();
  const windowMembers = new Set(model.windows.flatMap((window) =>
    window.works.map(({ id }) => id)));
  const dependencyTargets = new Set(model.works.flatMap((work) =>
    work.dependsOn.map(({ id }) => id)));
  return new Set(model.works.filter((work) =>
    affectedWorkIds.has(work.id) && work.description === null &&
    work.events.length === 0 && work.activities.length === 0 &&
    work.milestoneLinks.every(({ id }) => removedMilestones.has(id)) &&
    work.taskLinks.every(({ id }) => removedTasks.has(id)) &&
    work.dependsOn.length === 0 && !dependencyTargets.has(work.id) &&
    !windowMembers.has(work.id)
  ).map(({ id }) => id));
}

function planningLinkFieldEdits(
  field: ReturnType<typeof planningFields>[number],
  removedMilestones: ReadonlySet<string>,
  removedTasks: ReadonlySet<string>,
): readonly TextEdit[] {
  const removed = field.name === "milestone_links"
    ? removedMilestones
    : field.name === "task_links"
      ? removedTasks
      : null;
  if (removed === null) return [];
  const selected = field.children.filter((line) => {
    const match = /^    ([A-Za-z][A-Za-z0-9_-]*)$/u.exec(line.text);
    return match !== null && removed.has(match[1]!);
  });
  if (selected.length === 0) return [];
  const meaningful = field.children.filter((line) =>
    line.text !== "" && !/^\s*#/u.test(line.text));
  return selected.length === meaningful.length
    ? [fieldRemoval(field)]
    : selected.map(lineRemoval);
}

function workCleanupEdits(
  model: PlanningPoolSourceModel,
  blocks: readonly PlanningDeclarationBlock[],
  archived: ReadonlySet<string>,
  removedMilestones: ReadonlySet<string>,
  removedTasks: ReadonlySet<string>,
): TextEdit[] {
  const edits: TextEdit[] = [];
  const workBlocks = new Map(blocks
    .filter((block) => block.kind === "work" && block.id !== null)
    .map((block) => [block.id!, block]));
  for (const work of model.works) {
    const block = workBlocks.get(work.id);
    if (block === undefined) continue;
    if (archived.has(work.id)) {
      edits.push(Object.freeze({
        startOffset: block.span.start.offset,
        endOffset: block.span.end.offset,
        replacement: "",
      }));
    } else {
      for (const field of planningFields(block)) {
        edits.push(...planningLinkFieldEdits(field, removedMilestones, removedTasks));
      }
    }
  }
  return edits;
}

function appendWorkOrderCleanup(
  edits: TextEdit[],
  model: PlanningPoolSourceModel,
  blocks: readonly PlanningDeclarationBlock[],
  archived: ReadonlySet<string>,
): void {
  if (archived.size === 0) return;
  const order = blocks.find(({ kind }) => kind === "work_order");
  if (order === undefined) return;
  if (model.works.every(({ id }) => archived.has(id))) {
    edits.push(Object.freeze({
      startOffset: order.span.start.offset,
      endOffset: order.span.end.offset,
      replacement: "",
    }));
    return;
  }
  for (const line of order.lines) {
    const match = /^  ([A-Za-z][A-Za-z0-9_-]*)$/u.exec(line.text);
    if (match !== null && archived.has(match[1]!)) edits.push(lineRemoval(line));
  }
}

function destructiveRecordsForEdits(
  documentId: string,
  blocks: readonly PlanningDeclarationBlock[],
  edits: readonly TextEdit[],
): readonly PlanningDestructiveRecord[] {
  return blocks.flatMap((block) => {
    const eligible = block.kind === "work" || block.kind === "work_order";
    const changed = edits.some((edit) =>
      edit.startOffset < block.span.end.offset && edit.endOffset > block.span.start.offset);
    if (!eligible || !changed) return [];
    return [Object.freeze({
      ownerClass: "canonical" as const,
      entityKind: block.kind,
      qualifiedId: block.id === null ? null : qualified(documentId, block.id),
      startOffset: block.span.start.offset,
      endOffset: block.span.end.offset,
    })];
  });
}

export function planPlanningAdvanceCleanup(
  text: string,
  removedMilestoneIds: readonly string[],
  removedTaskIds: readonly string[],
  archiveEmptyWork: boolean,
): PlanningAdvanceCleanup {
  const parsed = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY);
  if (!parsed.ok || parsed.model === null) return emptyCleanup();
  const model = parsed.model;
  const removedMilestones = new Set(removedMilestoneIds);
  const removedTasks = new Set(removedTaskIds);
  const blocks = scanPlanningDeclarationBlocks(text);
  const removed = removedLinkProjection(model, removedMilestones, removedTasks);
  const archived = archiveCandidates(
    model, removed.affectedWorkIds, removedMilestones, removedTasks, archiveEmptyWork,
  );
  const edits = workCleanupEdits(
    model, blocks, archived, removedMilestones, removedTasks,
  );
  appendWorkOrderCleanup(edits, model, blocks, archived);
  const destructiveRecords = destructiveRecordsForEdits(model.documentId, blocks, edits);
  return Object.freeze({
    edits: Object.freeze(edits),
    removedPlanningLinks: Object.freeze([...removed.links].sort()),
    archivedWorkIds: Object.freeze([...archived]
      .map((id) => qualified(model.documentId, id)).sort()),
    destructiveRecords: Object.freeze(destructiveRecords),
  });
}
