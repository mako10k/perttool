import {
  applyTextEdits,
  normalizeTextEdits,
  type TextEdit,
} from "../mutation/text-edits.js";
import {
  fieldLine,
  scanTemporalDeclarationBlocks,
} from "../temporal-schedule/source-lexical.js";
import { planPlanningPoolSourceMutation } from "./format.js";
import {
  PLANNING_RESHAPE_NORMALIZATION_CONTRACT,
  PLANNING_RESHAPE_NORMALIZED_LIMITS,
  normalizePlanningReshapeRequest,
  planningReshapeSha256,
} from "./reshape-normalize.js";
import { PlanningReshapeTokenRegistry } from "./reshape-token.js";
import type {
  PlanningAssociationDisposition,
  PlanningDependencyDisposition,
  PlanningEntityDisposition,
  PlanningProjectionLinkDisposition,
  PlanningReshapeApplyPreparationResult,
  PlanningReshapeAuditResult,
  PlanningReshapeAuthorityImpact,
  PlanningReshapeBinding,
  PlanningReshapeCoreCapability,
  PlanningReshapeCreatedWork,
  PlanningReshapeDescriptionRow,
  PlanningReshapePreflightResult,
  PlanningReshapeRequest,
  PlanningReshapeSemanticElement,
  PlanningWindowMembershipDisposition,
} from "./reshape-types.js";
import {
  planningFields,
  scanPlanningDeclarationBlocks,
  type PlanningDeclarationBlock,
} from "./source-lexical.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "./source.js";
import type {
  PlanningPoolSourceDiagnostic,
  PlanningPoolSourceModel,
  PlanningWindowSource,
  PlanningWorkSource,
} from "./source-types.js";

export const PLANNING_RESHAPE_CORE_CAPABILITY: PlanningReshapeCoreCapability =
  Object.freeze({
    id: "perttool.planning-reshape-core",
    version: 1,
    normalizationContract: PLANNING_RESHAPE_NORMALIZATION_CONTRACT,
  });

export const PLANNING_RESHAPE_CORE_LIMITS = PLANNING_RESHAPE_NORMALIZED_LIMITS;

interface MutableWork {
  readonly id: string;
  readonly qualifiedId: string;
  readonly title: string;
  description: string;
  readonly events: Set<string>;
  readonly activities: Set<string>;
  readonly milestoneLinks: Set<string>;
  readonly taskLinks: Set<string>;
  readonly dependsOn: Set<string>;
}

interface MutableWindow {
  readonly source: PlanningWindowSource;
  readonly works: Set<string>;
  changed: boolean;
}

interface CandidateState {
  readonly works: Map<string, MutableWork>;
  readonly windows: Map<string, MutableWindow>;
  readonly order: readonly string[];
  readonly affectedLocalIds: ReadonlySet<string>;
  readonly removedLocalIds: ReadonlySet<string>;
  readonly createdLocalIds: readonly string[];
  readonly writeWorkOrder: boolean;
  readonly beforeDescriptions: readonly PlanningReshapeDescriptionRow[];
  readonly afterDescriptions: readonly PlanningReshapeDescriptionRow[];
}

interface ExistingRelations {
  readonly associations: ReadonlySet<string>;
  readonly projectionLinks: ReadonlySet<string>;
  readonly dependencies: ReadonlySet<string>;
  readonly memberships: ReadonlySet<string>;
}

interface RelationMutationContext {
  readonly text: string;
  readonly model: PlanningPoolSourceModel;
  readonly works: ReadonlyMap<string, MutableWork>;
  readonly affected: ReadonlySet<string>;
  readonly relations: ExistingRelations;
  readonly diagnostics: PlanningPoolSourceDiagnostic[];
}

function reshapeDiagnostic(
  message: string,
  code = "PTPOOL-110",
  severity: "error" | "warning" = "error",
): PlanningPoolSourceDiagnostic {
  return Object.freeze({
    code,
    severity,
    message,
    data: Object.freeze({}),
  });
}

function requireCapability(capability: PlanningReshapeCoreCapability): void {
  if (capability !== PLANNING_RESHAPE_CORE_CAPABILITY) {
    throw new TypeError("the private planning reshape Core capability is required");
  }
}

function localId(
  qualifiedId: string,
  documentId: string,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | null {
  const prefix = `${documentId}::`;
  if (!qualifiedId.startsWith(prefix)) {
    diagnostics.push(reshapeDiagnostic(`${label} ${qualifiedId} is outside ${documentId}`));
    return null;
  }
  return qualifiedId.slice(prefix.length);
}

function relationCount(request: PlanningReshapeRequest): number {
  return request.planning_entity_dispositions.length +
    request.association_dispositions.length +
    request.projection_link_dispositions.length +
    request.dependency_dispositions.length +
    request.window_membership_dispositions.length;
}

function enforceRequestLimits(
  request: PlanningReshapeRequest,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  if (request.affected_work_ids.length > PLANNING_RESHAPE_CORE_LIMITS.affectedWorks) {
    diagnostics.push(reshapeDiagnostic("Planning reshape affected-Work limit exceeded", "PTPOOL-115"));
  }
  if (request.semantic_elements.length > PLANNING_RESHAPE_CORE_LIMITS.semanticRows) {
    diagnostics.push(reshapeDiagnostic("Planning reshape semantic-row limit exceeded", "PTPOOL-115"));
  }
  if (relationCount(request) > PLANNING_RESHAPE_CORE_LIMITS.relationshipDispositions) {
    diagnostics.push(reshapeDiagnostic("Planning reshape relationship-disposition limit exceeded", "PTPOOL-115"));
  }
}

function workState(work: PlanningWorkSource): MutableWork {
  return {
    id: work.id,
    qualifiedId: work.qualifiedId,
    title: work.title,
    description: work.description?.value ?? "",
    events: new Set(work.events.map(({ id }) => id)),
    activities: new Set(work.activities.map(({ id }) => id)),
    milestoneLinks: new Set(work.milestoneLinks.map(({ id }) => id)),
    taskLinks: new Set(work.taskLinks.map(({ id }) => id)),
    dependsOn: new Set(work.dependsOn.map(({ id }) => id)),
  };
}

function sourceDescriptions(
  model: PlanningPoolSourceModel,
  affected: ReadonlySet<string>,
  elementsByWork: ReadonlyMap<string, readonly string[]>,
): readonly PlanningReshapeDescriptionRow[] {
  return Object.freeze([...affected].sort().flatMap((id) => {
    const work = model.works.find((candidate) => candidate.id === id);
    return work === undefined ? [] : [Object.freeze({
      workId: work.qualifiedId,
      description: work.description?.value ?? "",
      elementIds: Object.freeze([...(elementsByWork.get(id) ?? [])]),
    })];
  }));
}

interface DescriptionInventory {
  readonly originIds: ReadonlyMap<string, readonly string[]>;
  readonly existingRows: ReadonlyMap<string, readonly PlanningReshapeSemanticElement[]>;
  readonly destinationRows: ReadonlyMap<string, readonly PlanningReshapeSemanticElement[]>;
}

function appendMapValue<T>(map: Map<string, readonly T[]>, key: string, value: T): void {
  map.set(key, Object.freeze([...(map.get(key) ?? []), value]));
}

function collectDescriptionInventory(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  affected: ReadonlySet<string>,
  finalWorks: ReadonlyMap<string, MutableWork>,
  removed: ReadonlySet<string>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): DescriptionInventory {
  const originIds = new Map<string, readonly string[]>();
  const existingRows = new Map<string, readonly PlanningReshapeSemanticElement[]>();
  const destinationRows = new Map<string, readonly PlanningReshapeSemanticElement[]>();
  for (const element of request.semantic_elements) {
    if (element.origin.kind === "existing") {
      const id = localId(element.origin.work_id, model.documentId, "Semantic origin Work", diagnostics);
      if (id !== null) {
        appendMapValue(existingRows, id, element);
        appendMapValue(originIds, id, element.element_id);
        if (!affected.has(id)) diagnostics.push(reshapeDiagnostic(`Semantic origin Work ${element.origin.work_id} is not affected`));
      }
    }
    if (element.destination.kind === "work") {
      const id = localId(element.destination.work_id, model.documentId, "Semantic destination Work", diagnostics);
      if (id !== null) {
        appendMapValue(destinationRows, id, element);
        if (!affected.has(id)) diagnostics.push(reshapeDiagnostic(`Semantic destination Work ${element.destination.work_id} is not affected`));
        if (!finalWorks.has(id) || removed.has(id)) diagnostics.push(reshapeDiagnostic(`Semantic destination Work ${element.destination.work_id} is not final`));
      }
    }
  }
  return Object.freeze({ originIds, existingRows, destinationRows });
}

function validateSourcePartition(
  work: PlanningWorkSource,
  rows: readonly PlanningReshapeSemanticElement[],
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  const description = work.description?.value ?? "";
  const ordered = [...rows].sort((left, right) =>
    (left.origin.kind === "existing" ? left.origin.start_utf16 : 0) -
    (right.origin.kind === "existing" ? right.origin.start_utf16 : 0));
  let cursor = 0;
  for (const row of ordered) {
    if (row.origin.kind !== "existing") continue;
    const matches = row.origin.start_utf16 === cursor &&
      row.origin.end_utf16 <= description.length &&
      description.slice(row.origin.start_utf16, row.origin.end_utf16) === row.origin.source_text;
    if (!matches) diagnostics.push(reshapeDiagnostic(`Semantic origin partition for ${work.qualifiedId} has a gap, overlap, or text mismatch`));
    cursor = row.origin.end_utf16;
  }
  if (cursor !== description.length) diagnostics.push(reshapeDiagnostic(`Semantic origin partition for ${work.qualifiedId} is incomplete`));
}

function validateSourcePartitions(
  model: PlanningPoolSourceModel,
  affected: ReadonlySet<string>,
  inventory: DescriptionInventory,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  const originalById = new Map(model.works.map((work) => [work.id, work]));
  for (const id of affected) {
    const work = originalById.get(id);
    if (work !== undefined) validateSourcePartition(work, inventory.existingRows.get(id) ?? [], diagnostics);
  }
}

function reconstructDestinationRow(
  work: MutableWork,
  rows: readonly PlanningReshapeSemanticElement[],
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningReshapeDescriptionRow {
  const ordered = [...rows].sort((left, right) =>
    (left.destination.kind === "work" ? left.destination.position : 0) -
    (right.destination.kind === "work" ? right.destination.position : 0));
  const destinations = ordered.map(({ destination }) => destination);
  if (destinations.some((destination, index) => destination.kind !== "work" || destination.position !== index)) {
    diagnostics.push(reshapeDiagnostic(`Semantic destination positions for ${work.qualifiedId} are not unique and contiguous`));
  }
  work.description = destinations.map((destination) => destination.kind === "work" ? destination.text : "").join("");
  return Object.freeze({
    workId: work.qualifiedId,
    description: work.description,
    elementIds: Object.freeze(ordered.map(({ element_id }) => element_id)),
  });
}

function reconstructDestinationRows(
  affected: ReadonlySet<string>,
  finalWorks: ReadonlyMap<string, MutableWork>,
  removed: ReadonlySet<string>,
  inventory: DescriptionInventory,
  diagnostics: PlanningPoolSourceDiagnostic[],
): readonly PlanningReshapeDescriptionRow[] {
  const after: PlanningReshapeDescriptionRow[] = [];
  for (const id of affected) {
    const work = finalWorks.get(id);
    if (work !== undefined && !removed.has(id)) {
      after.push(reconstructDestinationRow(work, inventory.destinationRows.get(id) ?? [], diagnostics));
    }
  }
  return Object.freeze(after.sort((left, right) => left.workId.localeCompare(right.workId)));
}

function validateResidualActions(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  affected: ReadonlySet<string>,
  finalWorks: ReadonlyMap<string, MutableWork>,
  removed: ReadonlySet<string>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  for (const action of request.add_residual_description) {
    const id = localId(action.work_id, model.documentId, "Residual-description Work", diagnostics);
    const work = id === null ? undefined : finalWorks.get(id);
    if (id === null || work === undefined || removed.has(id) || !affected.has(id)) {
      diagnostics.push(reshapeDiagnostic(`Residual-description action target ${action.work_id} is not an affected final Work`));
    } else if (work.description !== action.text) {
      diagnostics.push(reshapeDiagnostic(`Residual-description action for ${action.work_id} does not match reconstructed text`));
    }
  }
}

function affectedSet(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): ReadonlySet<string> {
  const result = new Set<string>();
  for (const id of request.affected_work_ids) {
    const local = localId(id, model.documentId, "Affected Work", diagnostics);
    if (local !== null) result.add(local);
  }
  return result;
}

function createdBoundaryIds(
  created: PlanningReshapeCreatedWork,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): readonly [string, string | null] | null {
  const id = localId(created.work_id, model.documentId, "Created Work", diagnostics);
  const anchor = created.insert_after_work_id === null
    ? null
    : localId(created.insert_after_work_id, model.documentId, "Created Work anchor", diagnostics);
  return id === null || (created.insert_after_work_id !== null && anchor === null)
    ? null
    : Object.freeze([id, anchor]);
}

function createdWorks(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  affected: ReadonlySet<string>,
  works: Map<string, MutableWork>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): readonly string[] {
  const result: string[] = [];
  const boundaries: Array<Readonly<{
    created: PlanningReshapeCreatedWork;
    id: string;
    anchor: string | null;
  }>> = [];
  for (const created of request.created_works) {
    const boundary = createdBoundaryIds(created, model, diagnostics);
    if (boundary === null) continue;
    const [id, anchor] = boundary;
    if (works.has(id)) diagnostics.push(reshapeDiagnostic(`Created Work ${created.work_id} already exists`));
    if (!affected.has(id)) diagnostics.push(reshapeDiagnostic(`Created Work ${created.work_id} is not affected`));
    works.set(id, {
      id,
      qualifiedId: created.work_id,
      title: created.title,
      description: "",
      events: new Set(),
      activities: new Set(),
      milestoneLinks: new Set(),
      taskLinks: new Set(),
      dependsOn: new Set(),
    });
    boundaries.push(Object.freeze({ created, id, anchor }));
    result.push(id);
  }
  for (const { created, anchor } of boundaries) {
    if (anchor !== null && !works.has(anchor)) diagnostics.push(reshapeDiagnostic(`Created Work anchor ${created.insert_after_work_id} does not exist`));
  }
  return Object.freeze(result.sort());
}

function removedWorks(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  affected: ReadonlySet<string>,
  originalIds: ReadonlySet<string>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): ReadonlySet<string> {
  const result = new Set<string>();
  for (const removed of request.removed_work_ids) {
    const id = localId(removed, model.documentId, "Removed Work", diagnostics);
    if (id === null) continue;
    if (!originalIds.has(id)) diagnostics.push(reshapeDiagnostic(`Removed Work ${removed} does not exist`));
    if (!affected.has(id)) diagnostics.push(reshapeDiagnostic(`Removed Work ${removed} is not affected`));
    result.add(id);
  }
  return result;
}

function validateAffectedIdentities(
  affected: ReadonlySet<string>,
  works: ReadonlyMap<string, MutableWork>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  for (const id of affected) {
    if (!works.has(id)) diagnostics.push(reshapeDiagnostic(`Affected Work ${id} does not exist in the final boundary set`));
  }
}

function descriptionRows(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  affected: ReadonlySet<string>,
  finalWorks: ReadonlyMap<string, MutableWork>,
  removed: ReadonlySet<string>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): Readonly<{ before: readonly PlanningReshapeDescriptionRow[]; after: readonly PlanningReshapeDescriptionRow[] }> {
  const inventory = collectDescriptionInventory(request, model, affected, finalWorks, removed, diagnostics);
  validateSourcePartitions(model, affected, inventory, diagnostics);
  const after = reconstructDestinationRows(affected, finalWorks, removed, inventory, diagnostics);
  validateResidualActions(request, model, affected, finalWorks, removed, diagnostics);
  return Object.freeze({
    before: sourceDescriptions(model, affected, inventory.originIds),
    after,
  });
}

function strictQualifiedIds(text: string, documentId: string): Readonly<{
  milestones: ReadonlySet<string>;
  tasks: ReadonlySet<string>;
}> {
  const milestones = new Set<string>();
  const tasks = new Set<string>();
  for (const block of scanTemporalDeclarationBlocks(text)) {
    if (block.kind === "milestone") milestones.add(`${documentId}::${block.id}`);
    if (block.kind === "task") tasks.add(`${documentId}::${block.id}`);
  }
  return Object.freeze({ milestones, tasks });
}

function existingRelations(model: PlanningPoolSourceModel): ExistingRelations {
  const associations = new Set<string>();
  const projectionLinks = new Set<string>();
  const dependencies = new Set<string>();
  const memberships = new Set<string>();
  for (const work of model.works) {
    for (const event of work.events) associations.add(`event|${event.qualifiedId}|${work.qualifiedId}`);
    for (const activity of work.activities) associations.add(`activity|${activity.qualifiedId}|${work.qualifiedId}`);
    for (const milestone of work.milestoneLinks) projectionLinks.add(`milestone|${milestone.qualifiedId}|${work.qualifiedId}`);
    for (const task of work.taskLinks) projectionLinks.add(`task|${task.qualifiedId}|${work.qualifiedId}`);
    for (const dependency of work.dependsOn) dependencies.add(`${work.qualifiedId}|${dependency.qualifiedId}`);
  }
  for (const window of model.windows) {
    for (const work of window.works) memberships.add(`${window.qualifiedId}|${work.qualifiedId}`);
  }
  return Object.freeze({ associations, projectionLinks, dependencies, memberships });
}

function entityDispositionMap(
  dispositions: readonly PlanningEntityDisposition[],
  diagnostics: PlanningPoolSourceDiagnostic[],
): ReadonlyMap<string, PlanningEntityDisposition> {
  const result = new Map<string, PlanningEntityDisposition>();
  for (const disposition of dispositions) {
    if (disposition.action !== "retain") {
      diagnostics.push(reshapeDiagnostic(`Planning entity action ${disposition.action} belongs to a later Core`));
    }
    result.set(`${disposition.entity_kind}:${disposition.entity_id}`, disposition);
  }
  return result;
}

function relationWorkLocal(key: string, position: number): string {
  const qualified = key.split("|")[position]!;
  return qualified.slice(qualified.indexOf("::") + 2);
}

function unaffectedRelations(
  relations: ReadonlySet<string>,
  affected: ReadonlySet<string>,
  workPosition: number,
): Set<string> {
  return new Set([...relations].filter((key) => !affected.has(relationWorkLocal(key, workPosition))));
}

function requireAffectedRelationDisposition(
  relations: ReadonlySet<string>,
  affected: ReadonlySet<string>,
  seen: ReadonlySet<string>,
  label: string,
  workPosition: number,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  for (const key of relations) {
    if (affected.has(relationWorkLocal(key, workPosition)) && !seen.has(key)) {
      diagnostics.push(reshapeDiagnostic(`Affected ${label} ${key} has no disposition`));
    }
  }
}

function applyAssociationDisposition(
  disposition: PlanningAssociationDisposition,
  entities: ReadonlyMap<string, PlanningEntityDisposition>,
  context: RelationMutationContext,
  seenOrigins: Set<string>,
  finalKeys: Set<string>,
): void {
  const { model, works, affected, relations, diagnostics } = context;
  const entitySet = disposition.entity_kind === "event"
    ? new Set(model.events.map(({ qualifiedId }) => qualifiedId))
    : new Set(model.activities.map(({ qualifiedId }) => qualifiedId));
  if (!entitySet.has(disposition.entity_id)) diagnostics.push(reshapeDiagnostic(`Association entity ${disposition.entity_id} does not exist`));
  if (!entities.has(`${disposition.entity_kind}:${disposition.entity_id}`)) diagnostics.push(reshapeDiagnostic(`Association entity ${disposition.entity_id} has no entity disposition`));
  if (disposition.origin_work_id !== null) {
    const key = `${disposition.entity_kind}|${disposition.entity_id}|${disposition.origin_work_id}`;
    if (!relations.associations.has(key)) diagnostics.push(reshapeDiagnostic(`Association origin ${key} does not exist`));
    if (seenOrigins.has(key)) diagnostics.push(reshapeDiagnostic(`Association origin ${key} is disposed more than once`));
    seenOrigins.add(key);
    const local = localId(disposition.origin_work_id, model.documentId, "Association origin Work", diagnostics);
    if (local !== null && !affected.has(local)) diagnostics.push(reshapeDiagnostic(`Association origin Work ${disposition.origin_work_id} is not affected`));
  }
  if (disposition.destination_work_id !== null) {
    const local = localId(disposition.destination_work_id, model.documentId, "Association destination Work", diagnostics);
    if (local !== null && !works.has(local)) diagnostics.push(reshapeDiagnostic(`Association destination Work ${disposition.destination_work_id} is not final`));
    finalKeys.add(`${disposition.entity_kind}|${disposition.entity_id}|${disposition.destination_work_id}`);
  }
}

function rebuildAssociations(
  works: ReadonlyMap<string, MutableWork>,
  finalKeys: ReadonlySet<string>,
): void {
  for (const work of works.values()) {
    work.events.clear();
    work.activities.clear();
  }
  for (const key of finalKeys) {
    const [kind, entityQualified, workQualified] = key.split("|");
    const work = works.get(workQualified!.slice(workQualified!.indexOf("::") + 2));
    if (work === undefined) continue;
    const entityId = entityQualified!.slice(entityQualified!.indexOf("::") + 2);
    (kind === "event" ? work.events : work.activities).add(entityId);
  }
}

function applyAssociations(
  request: PlanningReshapeRequest,
  context: RelationMutationContext,
): void {
  const { works, affected, relations, diagnostics } = context;
  const entities = entityDispositionMap(request.planning_entity_dispositions, diagnostics);
  const seenOrigins = new Set<string>();
  const finalKeys = unaffectedRelations(relations.associations, affected, 2);
  for (const disposition of request.association_dispositions) {
    applyAssociationDisposition(disposition, entities, context, seenOrigins, finalKeys);
  }
  requireAffectedRelationDisposition(relations.associations, affected, seenOrigins, "association", 2, diagnostics);
  rebuildAssociations(works, finalKeys);
}

function applyProjectionLinkDisposition(
  disposition: PlanningProjectionLinkDisposition,
  strict: ReturnType<typeof strictQualifiedIds>,
  context: RelationMutationContext,
  seenOrigins: Set<string>,
  finalKeys: Set<string>,
): void {
  const { model, works, affected, relations, diagnostics } = context;
  const ids = disposition.strict_kind === "milestone" ? strict.milestones : strict.tasks;
  if (!ids.has(disposition.strict_id)) diagnostics.push(reshapeDiagnostic(`Projection-link entity ${disposition.strict_id} does not exist`));
  if (disposition.origin_work_id !== null) {
    const key = `${disposition.strict_kind}|${disposition.strict_id}|${disposition.origin_work_id}`;
    if (!relations.projectionLinks.has(key)) diagnostics.push(reshapeDiagnostic(`Projection-link origin ${key} does not exist`));
    if (seenOrigins.has(key)) diagnostics.push(reshapeDiagnostic(`Projection-link origin ${key} is disposed more than once`));
    seenOrigins.add(key);
    const local = localId(disposition.origin_work_id, model.documentId, "Projection-link origin Work", diagnostics);
    if (local !== null && !affected.has(local)) diagnostics.push(reshapeDiagnostic(`Projection-link origin Work ${disposition.origin_work_id} is not affected`));
  }
  if (disposition.destination_work_id !== null) {
    const local = localId(disposition.destination_work_id, model.documentId, "Projection-link destination Work", diagnostics);
    if (local !== null && !works.has(local)) diagnostics.push(reshapeDiagnostic(`Projection-link destination Work ${disposition.destination_work_id} is not final`));
    finalKeys.add(`${disposition.strict_kind}|${disposition.strict_id}|${disposition.destination_work_id}`);
  }
}

function rebuildProjectionLinks(
  works: ReadonlyMap<string, MutableWork>,
  finalKeys: ReadonlySet<string>,
): void {
  for (const work of works.values()) {
    work.milestoneLinks.clear();
    work.taskLinks.clear();
  }
  for (const key of finalKeys) {
    const [kind, strictQualified, workQualified] = key.split("|");
    const work = works.get(workQualified!.slice(workQualified!.indexOf("::") + 2));
    if (work === undefined) continue;
    const strictLocal = strictQualified!.slice(strictQualified!.indexOf("::") + 2);
    (kind === "milestone" ? work.milestoneLinks : work.taskLinks).add(strictLocal);
  }
}

function applyProjectionLinks(
  request: PlanningReshapeRequest,
  context: RelationMutationContext,
): void {
  const { text, model, works, affected, relations, diagnostics } = context;
  const strict = strictQualifiedIds(text, model.documentId);
  const seenOrigins = new Set<string>();
  const finalKeys = unaffectedRelations(relations.projectionLinks, affected, 2);
  for (const disposition of request.projection_link_dispositions) {
    applyProjectionLinkDisposition(disposition, strict, context, seenOrigins, finalKeys);
  }
  requireAffectedRelationDisposition(relations.projectionLinks, affected, seenOrigins, "projection link", 2, diagnostics);
  rebuildProjectionLinks(works, finalKeys);
}

function dependencyFinalPair(
  disposition: PlanningDependencyDisposition,
): readonly [string, string] | null {
  if (disposition.action === "retain") return [disposition.dependent_work_id, disposition.prerequisite_work_id];
  if (disposition.action === "rebind") return [disposition.final_dependent_work_id!, disposition.final_prerequisite_work_id!];
  return null;
}

function unaffectedDependencies(
  relations: ReadonlySet<string>,
  affected: ReadonlySet<string>,
): Set<string> {
  return new Set([...relations].filter((pair) => {
    const [dependent, prerequisite] = pair.split("|");
    return !affected.has(relationWorkLocal(dependent!, 0)) &&
      !affected.has(relationWorkLocal(prerequisite!, 0));
  }));
}

function planningOwners(context: RelationMutationContext): ReadonlySet<string> {
  const { text, model } = context;
  const strict = strictQualifiedIds(text, model.documentId);
  return new Set([
    ...model.events.map(({ qualifiedId }) => qualifiedId),
    ...model.activities.map(({ qualifiedId }) => qualifiedId),
    ...strict.milestones,
    ...strict.tasks,
  ]);
}

function applyDependencyDisposition(
  disposition: PlanningDependencyDisposition,
  owners: ReadonlySet<string>,
  context: RelationMutationContext,
  seen: Set<string>,
  finalPairs: Set<string>,
): void {
  const { model, works, relations, diagnostics } = context;
  const originKey = `${disposition.dependent_work_id}|${disposition.prerequisite_work_id}`;
  if (!relations.dependencies.has(originKey)) diagnostics.push(reshapeDiagnostic(`Dependency origin ${originKey} does not exist`));
  seen.add(originKey);
  for (const owner of disposition.represented_by ?? []) {
    if (!owners.has(owner)) diagnostics.push(reshapeDiagnostic(`Represented dependency owner ${owner} does not exist`));
  }
  const pair = dependencyFinalPair(disposition);
  if (pair === null) return;
  const dependent = localId(pair[0], model.documentId, "Final dependent Work", diagnostics);
  const prerequisite = localId(pair[1], model.documentId, "Final prerequisite Work", diagnostics);
  if (dependent === null || prerequisite === null) return;
  if (!works.has(dependent) || !works.has(prerequisite)) diagnostics.push(reshapeDiagnostic("Final dependency endpoint does not exist"));
  if (dependent === prerequisite) diagnostics.push(reshapeDiagnostic("Rebound dependency cannot become a self-dependency"));
  finalPairs.add(`${pair[0]}|${pair[1]}`);
}

function requireIncidentDependencyDispositions(
  relations: ReadonlySet<string>,
  affected: ReadonlySet<string>,
  seen: ReadonlySet<string>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  for (const pair of relations) {
    const [dependent, prerequisite] = pair.split("|");
    const incident = affected.has(relationWorkLocal(dependent!, 0)) ||
      affected.has(relationWorkLocal(prerequisite!, 0));
    if (incident && !seen.has(pair)) diagnostics.push(reshapeDiagnostic(`Incident dependency ${pair} has no disposition`));
  }
}

function rebuildDependencies(
  works: ReadonlyMap<string, MutableWork>,
  finalPairs: ReadonlySet<string>,
): void {
  for (const work of works.values()) work.dependsOn.clear();
  for (const pair of finalPairs) {
    const [dependentQualified, prerequisiteQualified] = pair.split("|");
    const dependent = relationWorkLocal(dependentQualified!, 0);
    const prerequisite = relationWorkLocal(prerequisiteQualified!, 0);
    works.get(dependent)?.dependsOn.add(prerequisite);
  }
}

function applyDependencies(
  request: PlanningReshapeRequest,
  context: RelationMutationContext,
): void {
  const { works, affected, relations, diagnostics } = context;
  const owners = planningOwners(context);
  const seen = new Set<string>();
  const finalPairs = unaffectedDependencies(relations.dependencies, affected);
  for (const disposition of request.dependency_dispositions) {
    applyDependencyDisposition(disposition, owners, context, seen, finalPairs);
  }
  requireIncidentDependencyDispositions(relations.dependencies, affected, seen, diagnostics);
  rebuildDependencies(works, finalPairs);
}

function applyMemberships(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  works: ReadonlyMap<string, MutableWork>,
  affected: ReadonlySet<string>,
  relations: ExistingRelations,
  diagnostics: PlanningPoolSourceDiagnostic[],
): Map<string, MutableWindow> {
  const windows = new Map(model.windows.map((window) => [window.id, {
    source: window,
    works: new Set(window.works.map(({ id }) => id)),
    changed: false,
  }]));
  const seen = new Set<string>();
  for (const disposition of request.window_membership_dispositions) {
    const windowId = localId(disposition.window_id, model.documentId, "Window", diagnostics);
    const origin = localId(disposition.origin_work_id, model.documentId, "Window origin Work", diagnostics);
    const destination = disposition.destination_work_id === null
      ? null
      : localId(disposition.destination_work_id, model.documentId, "Window destination Work", diagnostics);
    if (windowId === null || origin === null || (disposition.destination_work_id !== null && destination === null)) continue;
    const key = `${disposition.window_id}|${disposition.origin_work_id}`;
    if (!relations.memberships.has(key)) diagnostics.push(reshapeDiagnostic(`Window membership origin ${key} does not exist`));
    if (!affected.has(origin)) diagnostics.push(reshapeDiagnostic(`Window membership origin ${disposition.origin_work_id} is not affected`));
    const window = windows.get(windowId);
    if (window === undefined) diagnostics.push(reshapeDiagnostic(`Window ${disposition.window_id} does not exist`));
    if (destination !== null && !works.has(destination)) diagnostics.push(reshapeDiagnostic(`Window destination Work ${disposition.destination_work_id} is not final`));
    window?.works.delete(origin);
    if (destination !== null) window?.works.add(destination);
    if (window !== undefined) window.changed = true;
    seen.add(key);
  }
  for (const key of relations.memberships) {
    const origin = key.split("|")[1]!;
    if (affected.has(origin.slice(origin.indexOf("::") + 2)) && !seen.has(key)) diagnostics.push(reshapeDiagnostic(`Affected Window membership ${key} has no disposition`));
  }
  for (const window of windows.values()) {
    if (window.works.size === 0) diagnostics.push(reshapeDiagnostic(`Persisted Window ${window.source.qualifiedId} cannot become empty`));
  }
  return windows;
}

function validateFinalOrder(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  works: ReadonlyMap<string, MutableWork>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): readonly string[] {
  if (request.final_work_order.length === 0) {
    if (request.created_works.length > 0 || request.removed_work_ids.length > 0) {
      diagnostics.push(reshapeDiagnostic("final_work_order is required when Work boundaries change"));
    }
    return Object.freeze(model.workOrder.map(({ id }) => id));
  }
  const order: string[] = [];
  for (const qualified of request.final_work_order) {
    const id = localId(qualified, model.documentId, "Final Work order", diagnostics);
    if (id !== null) order.push(id);
  }
  const expected = [...works.keys()].sort();
  const actual = [...order].sort();
  if (expected.length !== actual.length || expected.some((id, index) => id !== actual[index])) {
    diagnostics.push(reshapeDiagnostic("final_work_order must contain every final Work exactly once"));
  }
  for (const created of request.created_works) {
    const boundary = createdBoundaryIds(created, model, diagnostics);
    if (boundary === null) continue;
    const [id, anchor] = boundary;
    const position = order.indexOf(id);
    const anchorPosition = anchor === null ? -1 : order.indexOf(anchor);
    if (position <= anchorPosition) diagnostics.push(reshapeDiagnostic(`Created Work ${created.work_id} does not follow its insertion anchor`));
  }
  return Object.freeze(order);
}

function renderReferences(lines: string[], name: string, values: ReadonlySet<string>): void {
  if (values.size === 0) return;
  lines.push(`  ${name}:`, ...[...values].sort().map((id) => `    ${id}`));
}

function renderWork(work: MutableWork, lineEnding: string): string {
  const lines = [`work ${work.id}:`, `  title ${JSON.stringify(work.title)}`];
  if (work.description.length > 0) lines.push(`  description ${JSON.stringify(work.description)}`);
  renderReferences(lines, "events", work.events);
  renderReferences(lines, "activities", work.activities);
  renderReferences(lines, "milestone_links", work.milestoneLinks);
  renderReferences(lines, "task_links", work.taskLinks);
  renderReferences(lines, "depends_on", work.dependsOn);
  return `${lines.join(lineEnding)}${lineEnding}`;
}

function renderWindow(window: MutableWindow, lineEnding: string): string {
  const source = window.source;
  const lines = [
    `window ${source.id}:`,
    `  title ${JSON.stringify(source.title)}`,
    `  objective ${JSON.stringify(source.objective)}`,
  ];
  if (source.start !== null) lines.push(`  start ${source.start.sourceText}`);
  if (source.end !== null) lines.push(`  end ${source.end.sourceText}`);
  lines.push("  works:", ...[...window.works].sort().map((id) => `    ${id}`));
  return `${lines.join(lineEnding)}${lineEnding}`;
}

function lineEnding(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function planningInsertionOffset(text: string, blocks: readonly PlanningDeclarationBlock[]): number {
  const firstWork = blocks.find(({ kind }) => kind === "work");
  if (firstWork !== undefined) return firstWork.span.start.offset;
  const firstPlanning = blocks[0];
  if (firstPlanning !== undefined) return firstPlanning.span.start.offset;
  const firstStrict = scanTemporalDeclarationBlocks(text).find(({ kind }) =>
    kind === "milestone" || kind === "task");
  return firstStrict?.span.start.offset ?? text.length;
}

function candidateReplacements(
  blocks: readonly PlanningDeclarationBlock[],
  state: CandidateState,
  ending: string,
): Map<number, TextEdit> {
  const replacements = new Map<number, TextEdit>();
  for (const block of blocks) {
    if (block.kind === "work" && block.id !== null && state.affectedLocalIds.has(block.id)) {
      const work = state.works.get(block.id);
      replacements.set(block.span.start.offset, {
        startOffset: block.span.start.offset,
        endOffset: block.span.end.offset,
        replacement: work === undefined ? "" : renderWork(work, ending),
      });
    }
    if (block.kind === "window" && block.id !== null) {
      const window = state.windows.get(block.id);
      if (window?.changed === true) replacements.set(block.span.start.offset, {
        startOffset: block.span.start.offset,
        endOffset: block.span.end.offset,
        replacement: renderWindow(window, ending),
      });
    }
    if (block.kind === "work_order" && state.writeWorkOrder) replacements.set(block.span.start.offset, {
      startOffset: block.span.start.offset,
      endOffset: block.span.end.offset,
      replacement: state.order.length === 0
        ? ""
        : `work_order:${ending}${state.order.map((id) => `  ${id}`).join(ending)}${ending}`,
    });
  }
  return replacements;
}

function candidateInsertion(
  blocks: readonly PlanningDeclarationBlock[],
  state: CandidateState,
  ending: string,
): string {
  let insertion = state.createdLocalIds.map((id) => renderWork(state.works.get(id)!, ending)).join(ending);
  const hasOrder = blocks.some(({ kind }) => kind === "work_order");
  if (!hasOrder && state.order.length > 0) {
    if (insertion.length > 0) insertion += ending;
    insertion += `work_order:${ending}${state.order.map((id) => `  ${id}`).join(ending)}${ending}${ending}`;
  }
  return insertion;
}

function candidateText(
  text: string,
  model: PlanningPoolSourceModel,
  state: CandidateState,
): string {
  const ending = lineEnding(text);
  const blocks = scanPlanningDeclarationBlocks(text);
  const replacements = candidateReplacements(blocks, state, ending);
  const insertion = candidateInsertion(blocks, state, ending);
  if (insertion.length > 0) {
    const offset = planningInsertionOffset(text, blocks);
    const existing = replacements.get(offset);
    if (existing === undefined) replacements.set(offset, { startOffset: offset, endOffset: offset, replacement: insertion });
    else replacements.set(offset, { ...existing, replacement: `${insertion}${existing.replacement}` });
  }
  const edits = normalizeTextEdits(text, [...replacements.values()], "planning reshape candidate");
  return applyTextEdits(text, edits);
}

function buildState(
  text: string,
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): CandidateState {
  const originalIds = new Set(model.works.map(({ id }) => id));
  const works = new Map(model.works.map((work) => [work.id, workState(work)]));
  const affected = affectedSet(request, model, diagnostics);
  const created = createdWorks(request, model, affected, works, diagnostics);
  const removed = removedWorks(request, model, affected, originalIds, diagnostics);
  validateAffectedIdentities(affected, works, diagnostics);
  const descriptions = descriptionRows(request, model, affected, works, removed, diagnostics);
  for (const id of removed) works.delete(id);
  const relations = existingRelations(model);
  const relationContext: RelationMutationContext = {
    text,
    model,
    works,
    affected,
    relations,
    diagnostics,
  };
  applyAssociations(request, relationContext);
  applyProjectionLinks(request, relationContext);
  applyDependencies(request, relationContext);
  const windows = applyMemberships(request, model, works, affected, relations, diagnostics);
  const order = validateFinalOrder(request, model, works, diagnostics);
  return Object.freeze({
    works,
    windows,
    order,
    affectedLocalIds: affected,
    removedLocalIds: removed,
    createdLocalIds: created,
    writeWorkOrder: request.final_work_order.length > 0 || created.length > 0 || removed.size > 0,
    beforeDescriptions: descriptions.before,
    afterDescriptions: descriptions.after,
  });
}

function ownerFromSource(text: string): string | null {
  const project = scanTemporalDeclarationBlocks(text).find(({ kind }) => kind === "project");
  return project?.lines.map(fieldLine).find((field) => field?.name === "dag_owner")?.rawValue ?? "user";
}

function authorityImpact(text: string, changed: boolean): PlanningReshapeAuthorityImpact {
  return Object.freeze({
    affectedScopes: Object.freeze(["dag"] as const),
    requiredOwner: ownerFromSource(text),
    userResponseRequired: changed,
  });
}

function failedAudit(
  sourceDigest: string,
  documentId: string | null,
  diagnostics: readonly PlanningPoolSourceDiagnostic[],
): PlanningReshapeAuditResult {
  return Object.freeze({
    ok: false,
    documentId,
    sourceDigest,
    normalizedRequest: null,
    canonicalRequestUtf8: null,
    preflightHash: null,
    candidateDigest: null,
    candidateText: null,
    changed: false,
    edits: Object.freeze([]),
    beforeDescriptions: Object.freeze([]),
    afterDescriptions: Object.freeze([]),
    diagnostics: Object.freeze(diagnostics),
  });
}

function residualDescriptionWarnings(
  request: PlanningReshapeRequest,
  state: CandidateState,
): readonly PlanningPoolSourceDiagnostic[] {
  const acknowledged = new Set(request.add_residual_description.map(({ work_id }) => work_id));
  const before = new Map(state.beforeDescriptions.map((row) => [row.workId, row.description]));
  const warnings: PlanningPoolSourceDiagnostic[] = [];
  for (const row of state.afterDescriptions) {
    const original = before.get(row.workId);
    const local = row.workId.slice(row.workId.indexOf("::") + 2);
    const work = state.works.get(local);
    const materializesReference = work !== undefined && (
      work.events.size > 0 || work.activities.size > 0 ||
      work.milestoneLinks.size > 0 || work.taskLinks.size > 0
    );
    if (
      original !== undefined && original.length > 0 && original === row.description &&
      materializesReference && !acknowledged.has(row.workId)
    ) {
      warnings.push(reshapeDiagnostic(
        `Work ${row.workId} keeps an unchanged residual description while materializing planning or strict references; consider Add residual description`,
        "PTPOOL-112",
        "warning",
      ));
    }
  }
  return Object.freeze(warnings);
}

export function auditPlanningReshape(
  text: string,
  requestInput: unknown,
  capability: PlanningReshapeCoreCapability,
): PlanningReshapeAuditResult {
  requireCapability(capability);
  const sourceDigest = planningReshapeSha256(text);
  const source = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY);
  if (!source.ok || source.model === null) {
    return failedAudit(sourceDigest, source.documentId, source.diagnostics);
  }
  const normalized = normalizePlanningReshapeRequest(requestInput);
  if (!normalized.ok || normalized.request === null || normalized.canonicalUtf8 === null || normalized.preflightHash === null) {
    return failedAudit(sourceDigest, source.documentId, normalized.diagnostics);
  }
  const diagnostics: PlanningPoolSourceDiagnostic[] = [];
  enforceRequestLimits(normalized.request, diagnostics);
  if (normalized.request.source_digest !== sourceDigest) diagnostics.push(reshapeDiagnostic("Planning reshape source_digest does not match current raw source", "PTPOOL-111"));
  if (normalized.request.intent !== "reshape" && normalized.request.intent !== "composite") {
    diagnostics.push(reshapeDiagnostic(`Planning reshape intent ${normalized.request.intent} belongs to a later Core`));
  }
  const state = buildState(text, normalized.request, source.model, diagnostics);
  if (diagnostics.some(({ severity }) => severity === "error")) {
    return Object.freeze({
      ...failedAudit(sourceDigest, source.documentId, diagnostics),
      normalizedRequest: normalized.request,
      canonicalRequestUtf8: normalized.canonicalUtf8,
      preflightHash: normalized.preflightHash,
      beforeDescriptions: state.beforeDescriptions,
      afterDescriptions: state.afterDescriptions,
    });
  }
  const candidate = candidateText(text, source.model, state);
  const mutation = planPlanningPoolSourceMutation(
    text,
    [{ startOffset: 0, endOffset: text.length, replacement: candidate }],
    PLANNING_POOL_SOURCE_CAPABILITY,
  );
  if (!mutation.ok || mutation.updatedText === null) {
    return Object.freeze({
      ...failedAudit(sourceDigest, source.documentId, [
        ...mutation.diagnostics,
        reshapeDiagnostic("Planning reshape reconstruction did not produce a valid final candidate"),
      ]),
      normalizedRequest: normalized.request,
      canonicalRequestUtf8: normalized.canonicalUtf8,
      preflightHash: normalized.preflightHash,
      beforeDescriptions: state.beforeDescriptions,
      afterDescriptions: state.afterDescriptions,
    });
  }
  const changed = mutation.updatedText !== text;
  const warnings = residualDescriptionWarnings(normalized.request, state);
  return Object.freeze({
    ok: true,
    documentId: source.documentId,
    sourceDigest,
    normalizedRequest: normalized.request,
    canonicalRequestUtf8: normalized.canonicalUtf8,
    preflightHash: normalized.preflightHash,
    candidateDigest: planningReshapeSha256(mutation.updatedText),
    candidateText: mutation.updatedText,
    changed,
    edits: mutation.edits,
    beforeDescriptions: state.beforeDescriptions,
    afterDescriptions: state.afterDescriptions,
    diagnostics: Object.freeze([
      ...warnings,
      ...(changed ? [] : [reshapeDiagnostic("Planning reshape candidate is byte-identical", "PTPOOL-117", "warning")]),
    ]),
  });
}

function bindingFromAudit(audit: PlanningReshapeAuditResult): PlanningReshapeBinding {
  if (audit.preflightHash === null || audit.candidateDigest === null) {
    throw new TypeError("successful planning reshape audit bindings are required");
  }
  return Object.freeze({
    normalizationContract: PLANNING_RESHAPE_NORMALIZATION_CONTRACT,
    preflightHash: audit.preflightHash,
    sourceDigest: audit.sourceDigest,
    candidateDigest: audit.candidateDigest,
  });
}

export function preflightPlanningReshape(
  text: string,
  requestInput: unknown,
  registry: PlanningReshapeTokenRegistry,
  capability: PlanningReshapeCoreCapability,
): PlanningReshapePreflightResult {
  const audit = auditPlanningReshape(text, requestInput, capability);
  if (!audit.ok) return Object.freeze({
    ...audit,
    schemaVersion: "Perttool.PlanningReshapePreflightResult.v1",
    preflightToken: null,
    tokenExpiresAt: null,
    authorityImpact: null,
  });
  const issue = registry.issue(bindingFromAudit(audit));
  if (issue === null) return Object.freeze({
    ...audit,
    ok: false,
    schemaVersion: "Perttool.PlanningReshapePreflightResult.v1",
    preflightToken: null,
    tokenExpiresAt: null,
    authorityImpact: authorityImpact(text, audit.changed),
    diagnostics: Object.freeze([...audit.diagnostics, reshapeDiagnostic("Planning reshape token registry is full", "PTPOOL-115")]),
  });
  return Object.freeze({
    ...audit,
    schemaVersion: "Perttool.PlanningReshapePreflightResult.v1",
    preflightToken: issue.token,
    tokenExpiresAt: issue.expiresAt,
    authorityImpact: authorityImpact(text, audit.changed),
  });
}

export function preparePlanningReshapeApply(
  text: string,
  requestInput: unknown,
  preflightHash: string,
  preflightToken: string,
  registry: PlanningReshapeTokenRegistry,
  capability: PlanningReshapeCoreCapability,
): PlanningReshapeApplyPreparationResult {
  const audit = auditPlanningReshape(text, requestInput, capability);
  const binding = audit.ok ? bindingFromAudit(audit) : null;
  const tokenDecision = binding === null
    ? null
    : registry.verify(preflightToken, binding);
  const hashMatches = audit.preflightHash === preflightHash;
  const valid = audit.ok && hashMatches && tokenDecision?.ok === true;
  const diagnostics = valid
    ? audit.diagnostics
    : Object.freeze([
        ...audit.diagnostics,
        reshapeDiagnostic("Planning reshape hash, token, source, request, candidate, expiry, or replay binding failed", "PTPOOL-111"),
      ]);
  return Object.freeze({
    ...audit,
    ok: valid,
    schemaVersion: "Perttool.PlanningMutationResult.v1",
    preflightTokenValidated: valid,
    authorityImpact: audit.documentId === null ? null : authorityImpact(text, audit.changed),
    diagnostics,
  });
}

export function planningReshapeBinding(
  prepared: PlanningReshapeApplyPreparationResult,
): PlanningReshapeBinding {
  if (!prepared.ok || !prepared.preflightTokenValidated) {
    throw new TypeError("a successfully rebound planning reshape preparation is required");
  }
  return bindingFromAudit(prepared);
}
