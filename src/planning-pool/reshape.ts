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
import type {
  PlanningCarryOverTarget,
  PlanningNewCarryOverTarget,
  PlanningWindowCloseIntent,
  PlanningWindowCloseReport,
  PlanningWindowSnapshot,
} from "./window-types.js";
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
  readonly source: PlanningWindowSource | null;
  readonly id: string;
  readonly qualifiedId: string;
  readonly title: string;
  readonly objective: string;
  readonly start: string | null;
  readonly end: string | null;
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
  readonly createdWindowIds: readonly string[];
  readonly writeWorkOrder: boolean;
  readonly beforeDescriptions: readonly PlanningReshapeDescriptionRow[];
  readonly afterDescriptions: readonly PlanningReshapeDescriptionRow[];
  readonly windowCloseReport: PlanningWindowCloseReport | null;
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

function strictQualifiedIds(
  text: string,
  documentId: string,
  request?: PlanningReshapeRequest,
): Readonly<{
  milestones: ReadonlySet<string>;
  tasks: ReadonlySet<string>;
}> {
  const milestones = new Set<string>();
  const tasks = new Set<string>();
  for (const block of scanTemporalDeclarationBlocks(text)) {
    if (block.kind === "milestone") milestones.add(`${documentId}::${block.id}`);
    if (block.kind === "task") tasks.add(`${documentId}::${block.id}`);
  }
  if (request?.strict_fragment?.kind === "project") {
    for (const id of request.strict_fragment.event_ids) milestones.add(id);
    for (const id of request.strict_fragment.activity_ids) tasks.add(id);
  }
  return Object.freeze({ milestones, tasks });
}

function strictField(
  block: ReturnType<typeof scanTemporalDeclarationBlocks>[number],
  name: string,
): string | null {
  return block.lines.map(fieldLine).find((field) => field?.name === name)?.rawValue ?? null;
}

function qualifiedSelection(
  ids: readonly string[],
  documentId: string,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): ReadonlySet<string> {
  const locals = new Set<string>();
  for (const id of ids) {
    const local = localId(id, documentId, label, diagnostics);
    if (local !== null) locals.add(local);
  }
  return locals;
}

function entityDisposition(
  request: PlanningReshapeRequest,
  kind: "event" | "activity",
  qualifiedId: string,
  action: "project" | "defer",
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  const matching = request.planning_entity_dispositions.filter((item) =>
    item.entity_kind === kind && item.entity_id === qualifiedId && item.action === action);
  if (matching.length !== 1) diagnostics.push(reshapeDiagnostic(
    `${action} ${kind} ${qualifiedId} requires one exact planning-entity disposition`,
    action === "project" ? "PTPOOL-108" : "PTPOOL-109",
  ));
}

function hasAssociationDisposition(
  request: PlanningReshapeRequest,
  kind: "event" | "activity",
  entityId: string,
  originWorkId: string | null,
  destinationWorkId: string | null,
): boolean {
  return request.association_dispositions.some((item) =>
    item.entity_kind === kind && item.entity_id === entityId &&
    item.origin_work_id === originWorkId && item.destination_work_id === destinationWorkId);
}

function hasLinkDisposition(
  request: PlanningReshapeRequest,
  kind: "milestone" | "task",
  strictId: string,
  originWorkId: string | null,
  destinationWorkId: string | null,
): boolean {
  return request.projection_link_dispositions.some((item) =>
    item.strict_kind === kind && item.strict_id === strictId &&
    item.origin_work_id === originWorkId && item.destination_work_id === destinationWorkId);
}

function associatedWorkIds(
  model: PlanningPoolSourceModel,
  kind: "event" | "activity",
  qualifiedId: string,
): readonly string[] {
  return Object.freeze(model.works.filter((work) =>
    (kind === "event" ? work.events : work.activities).some((item) => item.qualifiedId === qualifiedId))
    .map(({ qualifiedId: id }) => id).sort());
}

function linkedWorkIds(
  model: PlanningPoolSourceModel,
  kind: "milestone" | "task",
  qualifiedId: string,
): readonly string[] {
  return Object.freeze(model.works.filter((work) =>
    (kind === "milestone" ? work.milestoneLinks : work.taskLinks)
      .some((item) => item.qualifiedId === qualifiedId))
    .map(({ qualifiedId: id }) => id).sort());
}

function requireAffectedWorks(
  request: PlanningReshapeRequest,
  workIds: readonly string[],
  label: string,
  code: "PTPOOL-108" | "PTPOOL-109",
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  const affected = new Set(request.affected_work_ids);
  for (const workId of workIds) {
    if (!affected.has(workId)) diagnostics.push(reshapeDiagnostic(
      `${label} requires affected Work ${workId}`,
      code,
    ));
  }
}

function validateProjectionEntity(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  kind: "event" | "activity",
  qualifiedId: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  const entities = kind === "event" ? model.events : model.activities;
  if (!entities.some((item) => item.qualifiedId === qualifiedId)) {
    diagnostics.push(reshapeDiagnostic(`Projected ${kind} ${qualifiedId} does not exist`, "PTPOOL-108"));
    return;
  }
  entityDisposition(request, kind, qualifiedId, "project", diagnostics);
  const workIds = associatedWorkIds(model, kind, qualifiedId);
  requireAffectedWorks(request, workIds, `Projection of ${qualifiedId}`, "PTPOOL-108", diagnostics);
  const strictKind = kind === "event" ? "milestone" : "task";
  for (const workId of workIds) {
    if (!hasAssociationDisposition(request, kind, qualifiedId, workId, null)) {
      diagnostics.push(reshapeDiagnostic(`Projection must remove ${kind} ${qualifiedId} association from ${workId}`, "PTPOOL-108"));
    }
    if (!hasLinkDisposition(request, strictKind, qualifiedId, null, workId)) {
      diagnostics.push(reshapeDiagnostic(`Projection must create ${strictKind} ${qualifiedId} link for ${workId}`, "PTPOOL-108"));
    }
  }
}

function validateProjectionFragment(
  text: string,
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  const fragment = request.strict_fragment;
  if (fragment?.kind !== "project") return;
  if (fragment.event_ids.length + fragment.activity_ids.length === 0) {
    diagnostics.push(reshapeDiagnostic("Projection strict fragment is empty", "PTPOOL-108"));
  }
  const existing = strictQualifiedIds(text, model.documentId);
  for (const id of fragment.event_ids) {
    if (existing.milestones.has(id)) diagnostics.push(reshapeDiagnostic(`Projected Event ${id} collides with an existing Milestone`, "PTPOOL-108"));
    validateProjectionEntity(request, model, "event", id, diagnostics);
    const event = model.events.find(({ qualifiedId }) => qualifiedId === id);
    if (event?.source !== null && event?.source !== undefined) diagnostics.push(reshapeDiagnostic(
      `Projected Event ${id} has a source field with no strict Milestone owner`,
      "PTPOOL-108",
    ));
  }
  const finalMilestones = new Set([...existing.milestones, ...fragment.event_ids]);
  for (const id of fragment.activity_ids) {
    if (existing.tasks.has(id)) diagnostics.push(reshapeDiagnostic(`Projected Activity ${id} collides with an existing Task`, "PTPOOL-108"));
    validateProjectionEntity(request, model, "activity", id, diagnostics);
    const activity = model.activities.find(({ qualifiedId }) => qualifiedId === id);
    if (activity !== undefined) {
      for (const endpoint of [activity.from.qualifiedId, activity.to.qualifiedId]) {
        if (!finalMilestones.has(endpoint)) diagnostics.push(reshapeDiagnostic(
          `Projected Activity ${id} endpoint ${endpoint} is not a final strict Milestone`,
          "PTPOOL-108",
        ));
      }
    }
  }
}

function declarationContainsReference(
  text: string,
  headerPattern: RegExp,
  fieldPattern: RegExp,
): boolean {
  const lines = text.split(/(?<=\n)/u);
  for (let index = 0; index < lines.length; index += 1) {
    if (!headerPattern.test(lines[index]!.replace(/\r?\n$/u, ""))) continue;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const line = lines[cursor]!.replace(/\r?\n$/u, "");
      if (line !== "" && !line.startsWith(" ") && !line.startsWith("\t")) break;
      if (fieldPattern.test(line)) return true;
    }
  }
  return false;
}

function taskHasProtectedEvidence(text: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`^plan_seal ${escaped}:`, "mu").test(text) ||
    declarationContainsReference(text, /^task_outcome [A-Za-z][A-Za-z0-9_-]*:$/u, new RegExp(`^  task ${escaped}$`, "u")) ||
    declarationContainsReference(text, /^work_event [A-Za-z][A-Za-z0-9_-]*:$/u, new RegExp(`^  task ${escaped}$`, "u")) ||
    declarationContainsReference(text, /^assurance_receipt [A-Za-z][A-Za-z0-9_-]*:$/u, new RegExp(`^(?:  producer|    ) ${escaped}(?: |$)`, "u")) ||
    new RegExp(`^task_relation [A-Za-z][A-Za-z0-9_-]* ${escaped} ->|^task_relation [A-Za-z][A-Za-z0-9_-]* [A-Za-z][A-Za-z0-9_-]* -> ${escaped}:`, "mu").test(text);
}

function milestoneHasProtectedEvidence(text: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return declarationContainsReference(text, /^milestone_criterion_set [A-Za-z][A-Za-z0-9_-]*:$/u, new RegExp(`^  milestone ${escaped}$`, "u"));
}

function taskEndpoints(block: ReturnType<typeof scanTemporalDeclarationBlocks>[number]): readonly [string, string] | null {
  const match = /^task [A-Za-z][A-Za-z0-9_-]* ([A-Za-z][A-Za-z0-9_-]*) -> ([A-Za-z][A-Za-z0-9_-]*):$/u.exec(block.header.text);
  return match === null ? null : Object.freeze([match[1]!, match[2]!] as const);
}

function projectFinish(text: string): string | null {
  const project = scanTemporalDeclarationBlocks(text).find(({ kind }) => kind === "project");
  return project === undefined ? null : strictField(project, "finish");
}

function validateDeferralLinkRestoration(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  kind: "milestone" | "task",
  qualifiedId: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  const planningKind = kind === "milestone" ? "event" : "activity";
  entityDisposition(request, planningKind, qualifiedId, "defer", diagnostics);
  const workIds = linkedWorkIds(model, kind, qualifiedId);
  if (workIds.length === 0) diagnostics.push(reshapeDiagnostic(`Deferred ${kind} ${qualifiedId} has no live Work projection link`, "PTPOOL-109"));
  requireAffectedWorks(request, workIds, `Deferral of ${qualifiedId}`, "PTPOOL-109", diagnostics);
  for (const workId of workIds) {
    if (!hasLinkDisposition(request, kind, qualifiedId, workId, null)) {
      diagnostics.push(reshapeDiagnostic(`Deferral must remove ${kind} ${qualifiedId} link from ${workId}`, "PTPOOL-109"));
    }
    if (!hasAssociationDisposition(request, planningKind, qualifiedId, null, workId)) {
      diagnostics.push(reshapeDiagnostic(`Deferral must restore ${planningKind} ${qualifiedId} association for ${workId}`, "PTPOOL-109"));
    }
  }
}

type TemporalBlock = ReturnType<typeof scanTemporalDeclarationBlocks>[number];

interface DeferralValidationContext {
  readonly text: string;
  readonly request: PlanningReshapeRequest;
  readonly model: PlanningPoolSourceModel;
  readonly tasks: ReadonlyMap<string, TemporalBlock>;
  readonly milestones: ReadonlyMap<string, TemporalBlock>;
  readonly blocks: readonly TemporalBlock[];
  readonly taskIds: ReadonlySet<string>;
  readonly milestoneIds: ReadonlySet<string>;
  readonly diagnostics: PlanningPoolSourceDiagnostic[];
}

function validateDeferredTask(
  id: string,
  context: DeferralValidationContext,
): void {
  const { text, request, model, tasks, milestones, milestoneIds, diagnostics } = context;
  const block = tasks.get(id);
  const qualified = `${model.documentId}::${id}`;
  if (block === undefined) {
    diagnostics.push(reshapeDiagnostic(`Deferred Task ${qualified} does not exist`, "PTPOOL-109"));
    return;
  }
  const protectedEvidence = (strictField(block, "status") ?? "planned") !== "planned" ||
    strictField(block, "blocked_reason") !== null || taskHasProtectedEvidence(text, id);
  if (protectedEvidence) diagnostics.push(reshapeDiagnostic(
    `Deferred Task ${qualified} has protected execution or assurance evidence`,
    "PTPOOL-109",
  ));
  validateDeferralLinkRestoration(request, model, "task", qualified, diagnostics);
  const endpoints = taskEndpoints(block);
  if (endpoints === null) {
    diagnostics.push(reshapeDiagnostic(`Deferred Task ${qualified} has invalid endpoints`, "PTPOOL-109"));
    return;
  }
  for (const endpoint of endpoints) {
    if (!milestones.has(endpoint) && !milestoneIds.has(endpoint)) diagnostics.push(reshapeDiagnostic(
      `Deferred Task ${qualified} endpoint ${endpoint} is unavailable`,
      "PTPOOL-109",
    ));
  }
}

function retainedMilestoneConsumer(
  text: string,
  id: string,
  blocks: readonly TemporalBlock[],
  taskIds: ReadonlySet<string>,
): boolean {
  const retainedTask = blocks.some((candidate) => {
    if (candidate.kind !== "task" || taskIds.has(candidate.id)) return false;
    return taskEndpoints(candidate)?.includes(id) ?? false;
  });
  const retainedGate = new RegExp(
    `^gate [A-Za-z][A-Za-z0-9_-]* (?:${id} ->|[A-Za-z][A-Za-z0-9_-]* -> ${id}:)`,
    "mu",
  ).test(text);
  return retainedTask || retainedGate;
}

function validateDeferredMilestone(
  id: string,
  context: DeferralValidationContext,
): void {
  const { text, request, model, milestones, blocks, taskIds, diagnostics } = context;
  const block = milestones.get(id);
  const qualified = `${model.documentId}::${id}`;
  if (block === undefined) {
    diagnostics.push(reshapeDiagnostic(`Deferred Milestone ${qualified} does not exist`, "PTPOOL-109"));
    return;
  }
  const protectedEvidence = (strictField(block, "state") ?? "planned") !== "planned" ||
    strictField(block, "deadline") !== null || strictField(block, "when") !== null ||
    milestoneHasProtectedEvidence(text, id) || projectFinish(text) === id;
  if (protectedEvidence) diagnostics.push(reshapeDiagnostic(
    `Deferred Milestone ${qualified} has protected outcome, temporal, or finish evidence`,
    "PTPOOL-109",
  ));
  if (retainedMilestoneConsumer(text, id, blocks, taskIds)) diagnostics.push(reshapeDiagnostic(
    `Deferred Milestone ${qualified} is required by retained strict structure`,
    "PTPOOL-109",
  ));
  validateDeferralLinkRestoration(request, model, "milestone", qualified, diagnostics);
}

function validateDeferralFragment(
  text: string,
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  const fragment = request.strict_fragment;
  if (fragment?.kind !== "defer") return;
  if (fragment.task_ids.length + fragment.milestone_ids.length === 0) {
    diagnostics.push(reshapeDiagnostic("Deferral strict fragment is empty", "PTPOOL-109"));
  }
  const taskIds = qualifiedSelection(fragment.task_ids, model.documentId, "Deferred Task", diagnostics);
  const milestoneIds = qualifiedSelection(fragment.milestone_ids, model.documentId, "Deferred Milestone", diagnostics);
  const blocks = scanTemporalDeclarationBlocks(text);
  const tasks = new Map(blocks.filter(({ kind }) => kind === "task").map((block) => [block.id, block]));
  const milestones = new Map(blocks.filter(({ kind }) => kind === "milestone").map((block) => [block.id, block]));
  const context: DeferralValidationContext = {
    text, request, model, tasks, milestones, blocks, taskIds, milestoneIds, diagnostics,
  };
  for (const id of taskIds) {
    validateDeferredTask(id, context);
  }
  for (const id of milestoneIds) {
    validateDeferredMilestone(id, context);
  }
}

function linkSelectedForDeferral(
  request: PlanningReshapeRequest,
  disposition: PlanningProjectionLinkDisposition,
): boolean {
  const fragment = request.strict_fragment;
  if (fragment?.kind !== "defer") return false;
  return disposition.strict_kind === "task"
    ? fragment.task_ids.includes(disposition.strict_id)
    : fragment.milestone_ids.includes(disposition.strict_id);
}

function linkTargetHasProtectedEvidence(
  text: string,
  disposition: PlanningProjectionLinkDisposition,
  local: string,
): boolean {
  const block = scanTemporalDeclarationBlocks(text).find((candidate) =>
    candidate.kind === disposition.strict_kind && candidate.id === local);
  if (block === undefined) return false;
  return disposition.strict_kind === "task"
    ? (strictField(block, "status") ?? "planned") !== "planned" || taskHasProtectedEvidence(text, local)
    : (strictField(block, "state") ?? "planned") !== "planned" || milestoneHasProtectedEvidence(text, local);
}

function validateProtectedLinkDisposition(
  text: string,
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  disposition: PlanningProjectionLinkDisposition,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  if (disposition.origin_work_id === null || disposition.origin_work_id === disposition.destination_work_id) return;
  const local = localId(disposition.strict_id, model.documentId, "Projection-link target", diagnostics);
  if (local === null || linkSelectedForDeferral(request, disposition)) return;
  if (linkTargetHasProtectedEvidence(text, disposition, local)) diagnostics.push(reshapeDiagnostic(
      `Projection link ${disposition.strict_id} cannot be split or reallocated after authoritative evidence exists`,
      "PTPOOL-109",
  ));
}

function validateProtectedLinkReallocation(
  text: string,
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  for (const disposition of request.projection_link_dispositions) {
    validateProtectedLinkDisposition(text, request, model, disposition, diagnostics);
  }
}

function workIsArchiveable(
  work: PlanningWorkSource,
  model: PlanningPoolSourceModel,
): boolean {
  const incidentDependency = model.works.some((candidate) =>
    candidate.qualifiedId !== work.qualifiedId &&
    candidate.dependsOn.some(({ qualifiedId }) => qualifiedId === work.qualifiedId));
  const membership = model.windows.some((window) =>
    window.works.some(({ qualifiedId }) => qualifiedId === work.qualifiedId));
  const ownsMeaning = (work.description?.value ?? "").length > 0 || work.events.length > 0 ||
    work.activities.length > 0 || work.milestoneLinks.length > 0 || work.taskLinks.length > 0;
  return !ownsMeaning && work.dependsOn.length === 0 && !incidentDependency && !membership;
}

function validateArchiveIntent(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  if (request.intent !== "archive") return;
  if (request.removed_work_ids.length === 0 || request.created_works.length > 0 || request.strict_fragment !== null) {
    diagnostics.push(reshapeDiagnostic("Archive requires removed Work and cannot create Work or transfer strict ownership", "PTPOOL-113"));
  }
  const removed = new Set(request.removed_work_ids);
  const affected = new Set(request.affected_work_ids);
  if (removed.size !== affected.size || [...removed].some((id) => !affected.has(id))) {
    diagnostics.push(reshapeDiagnostic("Archive affected Work set must equal the removed Work set", "PTPOOL-113"));
  }
  for (const qualified of removed) {
    const work = model.works.find(({ qualifiedId }) => qualifiedId === qualified);
    if (work === undefined) continue;
    if (!workIsArchiveable(work, model)) {
      diagnostics.push(reshapeDiagnostic(`Work ${qualified} is not archiveable in the current source`, "PTPOOL-113"));
    }
  }
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
  request: PlanningReshapeRequest,
  dispositions: readonly PlanningEntityDisposition[],
  diagnostics: PlanningPoolSourceDiagnostic[],
): ReadonlyMap<string, PlanningEntityDisposition> {
  const result = new Map<string, PlanningEntityDisposition>();
  for (const disposition of dispositions) {
    const projected = request.strict_fragment?.kind === "project" && (
      disposition.entity_kind === "event"
        ? request.strict_fragment.event_ids.includes(disposition.entity_id)
        : request.strict_fragment.activity_ids.includes(disposition.entity_id)
    );
    const deferred = request.strict_fragment?.kind === "defer" && (
      disposition.entity_kind === "event"
        ? request.strict_fragment.milestone_ids.includes(disposition.entity_id)
        : request.strict_fragment.task_ids.includes(disposition.entity_id)
    );
    const expected = projected ? "project" : deferred ? "defer" : "retain";
    if (disposition.action !== expected) {
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
  request: PlanningReshapeRequest,
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
  if (request.strict_fragment?.kind === "defer") {
    for (const id of disposition.entity_kind === "event"
      ? request.strict_fragment.milestone_ids
      : request.strict_fragment.task_ids) entitySet.add(id);
  }
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
  const entities = entityDispositionMap(request, request.planning_entity_dispositions, diagnostics);
  const seenOrigins = new Set<string>();
  const finalKeys = unaffectedRelations(relations.associations, affected, 2);
  for (const disposition of request.association_dispositions) {
    applyAssociationDisposition(request, disposition, entities, context, seenOrigins, finalKeys);
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
  const strict = strictQualifiedIds(text, model.documentId, request);
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

function planningOwners(
  request: PlanningReshapeRequest,
  context: RelationMutationContext,
): ReadonlySet<string> {
  const { text, model } = context;
  const strict = strictQualifiedIds(text, model.documentId, request);
  return new Set([
    ...model.events.map(({ qualifiedId }) => qualifiedId),
    ...model.activities.map(({ qualifiedId }) => qualifiedId),
    ...(request.strict_fragment?.kind === "defer"
      ? [...request.strict_fragment.milestone_ids, ...request.strict_fragment.task_ids]
      : []),
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
  const owners = planningOwners(request, context);
  const seen = new Set<string>();
  const finalPairs = unaffectedDependencies(relations.dependencies, affected);
  for (const disposition of request.dependency_dispositions) {
    applyDependencyDisposition(disposition, owners, context, seen, finalPairs);
  }
  requireIncidentDependencyDispositions(relations.dependencies, affected, seen, diagnostics);
  rebuildDependencies(works, finalPairs);
}

function mutableWindow(window: PlanningWindowSource): MutableWindow {
  return {
    source: window,
    id: window.id,
    qualifiedId: window.qualifiedId,
    title: window.title,
    objective: window.objective,
    start: window.start?.sourceText ?? null,
    end: window.end?.sourceText ?? null,
    works: new Set(window.works.map(({ id }) => id)),
    changed: false,
  };
}

interface MembershipMutationContext {
  readonly model: PlanningPoolSourceModel;
  readonly works: ReadonlyMap<string, MutableWork>;
  readonly affected: ReadonlySet<string>;
  readonly relations: ExistingRelations;
  readonly windows: Map<string, MutableWindow>;
  readonly seen: Set<string>;
  readonly diagnostics: PlanningPoolSourceDiagnostic[];
}

function applyMembershipDisposition(
  disposition: PlanningWindowMembershipDisposition,
  context: MembershipMutationContext,
): void {
  const { model, works, affected, relations, windows, seen, diagnostics } = context;
  const windowId = localId(disposition.window_id, model.documentId, "Window", diagnostics);
  const origin = localId(disposition.origin_work_id, model.documentId, "Window origin Work", diagnostics);
  const destination = disposition.destination_work_id === null
    ? null
    : localId(disposition.destination_work_id, model.documentId, "Window destination Work", diagnostics);
  if (windowId === null || origin === null || (disposition.destination_work_id !== null && destination === null)) return;
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

function requireAffectedMembershipDispositions(
  relations: ExistingRelations,
  affected: ReadonlySet<string>,
  seen: ReadonlySet<string>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  for (const key of relations.memberships) {
    const origin = key.split("|")[1]!;
    if (affected.has(origin.slice(origin.indexOf("::") + 2)) && !seen.has(key)) {
      diagnostics.push(reshapeDiagnostic(`Affected Window membership ${key} has no disposition`));
    }
  }
}

function applyMemberships(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  works: ReadonlyMap<string, MutableWork>,
  affected: ReadonlySet<string>,
  relations: ExistingRelations,
  diagnostics: PlanningPoolSourceDiagnostic[],
): Map<string, MutableWindow> {
  const windows = new Map<string, MutableWindow>();
  for (const window of model.windows) windows.set(window.id, mutableWindow(window));
  const seen = new Set<string>();
  const context: MembershipMutationContext = {
    model, works, affected, relations, windows, seen, diagnostics,
  };
  for (const disposition of request.window_membership_dispositions) {
    applyMembershipDisposition(disposition, context);
  }
  requireAffectedMembershipDispositions(relations, affected, seen, diagnostics);
  return windows;
}

function windowSnapshot(
  window: MutableWindow,
  documentId: string,
): PlanningWindowSnapshot {
  return Object.freeze({
    kind: "persisted" as const,
    qualifiedId: window.qualifiedId,
    title: window.title,
    objective: window.objective,
    start: window.start,
    end: window.end,
    workIds: Object.freeze([...window.works].sort().map((id) => `${documentId}::${id}`)),
  });
}

function carryTargetWindow(
  target: PlanningCarryOverTarget,
  model: PlanningPoolSourceModel,
  windows: ReadonlyMap<string, MutableWindow>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): Readonly<{ localId: string; existing: MutableWindow | undefined }> | null {
  const targetId = localId(target.window_id, model.documentId, "carry-over Window", diagnostics);
  const existing = targetId === null ? undefined : windows.get(targetId);
  if (target.kind === "existing" && existing === undefined) {
    diagnostics.push(reshapeDiagnostic(`Carry-over Window ${target.window_id} does not exist`));
  }
  if (target.kind === "new" && existing !== undefined) {
    diagnostics.push(reshapeDiagnostic(`New carry-over Window ${target.window_id} already exists`));
  }
  return targetId === null ? null : Object.freeze({ localId: targetId, existing });
}

function newCarryWindow(
  target: PlanningNewCarryOverTarget,
  local: string,
  works: readonly string[],
): MutableWindow {
  return {
    source: null,
    id: local,
    qualifiedId: target.window_id,
    title: target.title,
    objective: target.objective,
    start: target.start,
    end: target.end,
    works: new Set(works),
    changed: true,
  };
}

function validateFinalWindows(
  windows: ReadonlyMap<string, MutableWindow>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): void {
  for (const window of windows.values()) {
    if (window.works.size === 0) diagnostics.push(reshapeDiagnostic(`Persisted Window ${window.qualifiedId} cannot become empty`));
  }
}

interface CompositeWindowClose {
  readonly report: PlanningWindowCloseReport | null;
  readonly createdWindowIds: readonly string[];
}

function compositeCarryWorkIds(
  close: PlanningWindowCloseIntent,
  model: PlanningPoolSourceModel,
  works: ReadonlyMap<string, MutableWork>,
  source: MutableWindow | undefined,
  diagnostics: PlanningPoolSourceDiagnostic[],
): readonly string[] {
  const result: string[] = [];
  for (const qualified of close.carry_over_work_ids) {
    const id = localId(qualified, model.documentId, "carry-over Work", diagnostics);
    if (id === null) continue;
    result.push(id);
    if (!works.has(id)) diagnostics.push(reshapeDiagnostic(`Carry-over Work ${qualified} is not final`));
    if (source !== undefined && !source.works.has(id)) diagnostics.push(reshapeDiagnostic(`Carry-over Work ${qualified} is not selected by ${close.window_id}`));
  }
  return Object.freeze(result);
}

function applyCompositeCarryTarget(
  target: PlanningCarryOverTarget | null,
  resolved: Readonly<{ localId: string; existing: MutableWindow | undefined }> | null,
  carryLocal: readonly string[],
  windows: Map<string, MutableWindow>,
): readonly string[] {
  if (target?.kind === "existing" && resolved?.existing !== undefined) {
    for (const id of carryLocal) resolved.existing.works.add(id);
    resolved.existing.changed = true;
  }
  if (target?.kind !== "new" || resolved === null) return Object.freeze([]);
  windows.set(resolved.localId, newCarryWindow(target, resolved.localId, carryLocal));
  return Object.freeze([resolved.localId]);
}

function compositeCloseReport(
  close: PlanningWindowCloseIntent,
  source: MutableWindow | undefined,
  model: PlanningPoolSourceModel,
  existingWorks: ReadonlySet<string>,
): PlanningWindowCloseReport | null {
  if (source === undefined) return null;
  const target = close.carry_over_target;
  return Object.freeze({
    removedWindow: windowSnapshot(source, model.documentId),
    objectiveDisposition: "discard" as const,
    carryOver: Object.freeze(close.carry_over_work_ids.map((workId) => Object.freeze({
      workId,
      targetWindowId: target?.window_id ?? "",
      status: existingWorks.has(workId.slice(workId.indexOf("::") + 2)) ? "already_selected" as const : "selected" as const,
    }))),
    targetCreated: target?.kind === "new",
  });
}

function applyWindowClose(
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  works: ReadonlyMap<string, MutableWork>,
  windows: Map<string, MutableWindow>,
  diagnostics: PlanningPoolSourceDiagnostic[],
): CompositeWindowClose {
  const close = request.window_close;
  if (close === null) {
    validateFinalWindows(windows, diagnostics);
    return Object.freeze({ report: null, createdWindowIds: Object.freeze([]) });
  }
  const sourceId = localId(close.window_id, model.documentId, "closed Window", diagnostics);
  const source = sourceId === null ? undefined : windows.get(sourceId);
  if (source === undefined) diagnostics.push(reshapeDiagnostic(`Window ${close.window_id} does not exist`));
  const carryLocal = compositeCarryWorkIds(close, model, works, source, diagnostics);
  const target = close.carry_over_target;
  if (target?.window_id === close.window_id) diagnostics.push(reshapeDiagnostic("Window cannot carry over to itself"));
  const resolved = target === null ? null : carryTargetWindow(target, model, windows, diagnostics);
  const existingWorks = new Set(resolved?.existing?.works ?? []);
  const createdWindowIds = applyCompositeCarryTarget(target, resolved, carryLocal, windows);
  if (sourceId !== null) windows.delete(sourceId);
  validateFinalWindows(windows, diagnostics);
  return Object.freeze({
    report: compositeCloseReport(close, source, model, existingWorks),
    createdWindowIds,
  });
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
  const lines = [
    `window ${window.id}:`,
    `  title ${JSON.stringify(window.title)}`,
    `  objective ${JSON.stringify(window.objective)}`,
  ];
  if (window.start !== null) lines.push(`  start ${window.start}`);
  if (window.end !== null) lines.push(`  end ${window.end}`);
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

function declarationBody(
  lines: readonly ReturnType<typeof scanTemporalDeclarationBlocks>[number]["lines"][number][],
  removedFields: ReadonlySet<string>,
): readonly string[] {
  const result: string[] = [];
  let removing = false;
  for (const line of lines) {
    const field = fieldLine(line);
    if (field !== null) removing = removedFields.has(field.name);
    if (!removing) result.push(line.text);
  }
  while (result.at(-1) === "") result.pop();
  return Object.freeze(result);
}

function renderedTransferDeclaration(
  header: string,
  body: readonly string[],
  ending: string,
): string {
  return `${[header, ...body].join(ending)}${ending}`;
}

interface TransferEdits {
  readonly removals: readonly TextEdit[];
  readonly insertion: string;
}

function projectionTransferEdits(
  text: string,
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  ending: string,
): TransferEdits {
  const fragment = request.strict_fragment;
  if (fragment?.kind !== "project") return Object.freeze({ removals: Object.freeze([]), insertion: "" });
  const eventIds = qualifiedSelection(fragment.event_ids, model.documentId, "Projected Event", []);
  const activityIds = qualifiedSelection(fragment.activity_ids, model.documentId, "Projected Activity", []);
  const projectedIncoming = new Set(model.activities
    .filter(({ id }) => activityIds.has(id))
    .map(({ to }) => to.id));
  const removals: TextEdit[] = [];
  const declarations: string[] = [];
  for (const block of scanPlanningDeclarationBlocks(text)) {
    if (block.id === null) continue;
    if (block.kind === "event" && eventIds.has(block.id)) {
      removals.push({ startOffset: block.span.start.offset, endOffset: block.span.end.offset, replacement: "" });
      const body = [...declarationBody(block.lines, new Set(["source"]))];
      if (!projectedIncoming.has(block.id)) {
        const tags = body.findIndex((line) => /^  tags /u.test(line));
        body.splice(tags === -1 ? body.length : tags, 0, "  state reached");
      }
      declarations.push(renderedTransferDeclaration(
        `milestone ${block.id}:`,
        body,
        ending,
      ));
    }
    if (block.kind === "activity" && activityIds.has(block.id)) {
      removals.push({ startOffset: block.span.start.offset, endOffset: block.span.end.offset, replacement: "" });
      declarations.push(renderedTransferDeclaration(
        `task ${block.id} ${block.from!} -> ${block.to!}:`,
        declarationBody(block.lines, new Set()),
        ending,
      ));
    }
  }
  return Object.freeze({ removals: Object.freeze(removals), insertion: declarations.join(ending) });
}

function deferralTransferEdits(
  text: string,
  request: PlanningReshapeRequest,
  model: PlanningPoolSourceModel,
  ending: string,
): TransferEdits {
  const fragment = request.strict_fragment;
  if (fragment?.kind !== "defer") return Object.freeze({ removals: Object.freeze([]), insertion: "" });
  const taskIds = qualifiedSelection(fragment.task_ids, model.documentId, "Deferred Task", []);
  const milestoneIds = qualifiedSelection(fragment.milestone_ids, model.documentId, "Deferred Milestone", []);
  const removals: TextEdit[] = [];
  const events: string[] = [];
  const activities: string[] = [];
  for (const block of scanTemporalDeclarationBlocks(text)) {
    if (block.kind === "milestone" && milestoneIds.has(block.id)) {
      removals.push({ startOffset: block.span.start.offset, endOffset: block.span.end.offset, replacement: "" });
      events.push(renderedTransferDeclaration(
        `event ${block.id}:`,
        declarationBody(block.lines, new Set(["state", "deadline", "when"])),
        ending,
      ));
    }
    if (block.kind === "task" && taskIds.has(block.id)) {
      const endpoints = taskEndpoints(block)!;
      removals.push({ startOffset: block.span.start.offset, endOffset: block.span.end.offset, replacement: "" });
      activities.push(renderedTransferDeclaration(
        `activity ${block.id} ${endpoints[0]} -> ${endpoints[1]}:`,
        declarationBody(block.lines, new Set(["status", "blocked_reason"])),
        ending,
      ));
    }
  }
  return Object.freeze({ removals: Object.freeze(removals), insertion: [...events, ...activities].join(ending) });
}

function addCandidateReplacement(
  replacements: Map<number, TextEdit>,
  edit: TextEdit,
): void {
  const existing = replacements.get(edit.startOffset);
  if (existing === undefined) replacements.set(edit.startOffset, edit);
  else replacements.set(edit.startOffset, {
    startOffset: edit.startOffset,
    endOffset: Math.max(existing.endOffset, edit.endOffset),
    replacement: `${edit.replacement}${existing.replacement}`,
  });
}

function candidateReplacements(
  blocks: readonly PlanningDeclarationBlock[],
  state: CandidateState,
  ending: string,
): Map<number, TextEdit> {
  const replacements = new Map<number, TextEdit>();
  for (const block of blocks) {
    addWorkCandidateReplacement(replacements, block, state, ending);
    addWindowCandidateReplacement(replacements, block, state, ending);
    addOrderCandidateReplacement(replacements, block, state, ending);
  }
  return replacements;
}

function addWorkCandidateReplacement(
  replacements: Map<number, TextEdit>,
  block: PlanningDeclarationBlock,
  state: CandidateState,
  ending: string,
): void {
  if (block.kind !== "work" || block.id === null || !state.affectedLocalIds.has(block.id)) return;
  const work = state.works.get(block.id);
  replacements.set(block.span.start.offset, {
    startOffset: block.span.start.offset,
    endOffset: block.span.end.offset,
    replacement: work === undefined ? "" : renderWork(work, ending),
  });
}

function addWindowCandidateReplacement(
  replacements: Map<number, TextEdit>,
  block: PlanningDeclarationBlock,
  state: CandidateState,
  ending: string,
): void {
  if (block.kind !== "window" || block.id === null) return;
  const window = state.windows.get(block.id);
  if (window !== undefined && !window.changed) return;
  replacements.set(block.span.start.offset, {
    startOffset: block.span.start.offset,
    endOffset: block.span.end.offset,
    replacement: window === undefined ? "" : renderWindow(window, ending),
  });
}

function addOrderCandidateReplacement(
  replacements: Map<number, TextEdit>,
  block: PlanningDeclarationBlock,
  state: CandidateState,
  ending: string,
): void {
  if (block.kind !== "work_order" || !state.writeWorkOrder) return;
  replacements.set(block.span.start.offset, {
    startOffset: block.span.start.offset,
    endOffset: block.span.end.offset,
    replacement: state.order.length === 0
      ? ""
      : `work_order:${ending}${state.order.map((id) => `  ${id}`).join(ending)}${ending}`,
  });
}

function candidateInsertion(
  blocks: readonly PlanningDeclarationBlock[],
  state: CandidateState,
  ending: string,
): string {
  let insertion = [
    ...state.createdWindowIds.map((id) => renderWindow(state.windows.get(id)!, ending)),
    ...state.createdLocalIds.map((id) => renderWork(state.works.get(id)!, ending)),
  ].join(ending);
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
  request: PlanningReshapeRequest,
): string {
  const ending = lineEnding(text);
  const blocks = scanPlanningDeclarationBlocks(text);
  const replacements = candidateReplacements(blocks, state, ending);
  const projected = projectionTransferEdits(text, request, model, ending);
  const deferred = deferralTransferEdits(text, request, model, ending);
  for (const edit of [...projected.removals, ...deferred.removals]) addCandidateReplacement(replacements, edit);
  const insertion = [candidateInsertion(blocks, state, ending), projected.insertion, deferred.insertion]
    .filter((value) => value.length > 0).join(ending);
  if (insertion.length > 0) {
    const offset = planningInsertionOffset(text, blocks);
    addCandidateReplacement(replacements, { startOffset: offset, endOffset: offset, replacement: insertion });
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
  const windowClose = applyWindowClose(request, model, works, windows, diagnostics);
  const order = validateFinalOrder(request, model, works, diagnostics);
  return Object.freeze({
    works,
    windows,
    order,
    affectedLocalIds: affected,
    removedLocalIds: removed,
    createdLocalIds: created,
    createdWindowIds: windowClose.createdWindowIds,
    writeWorkOrder: request.final_work_order.length > 0 || created.length > 0 || removed.size > 0,
    beforeDescriptions: descriptions.before,
    afterDescriptions: descriptions.after,
    windowCloseReport: windowClose.report,
  });
}

function ownerFromSource(text: string): string | null {
  const project = scanTemporalDeclarationBlocks(text).find(({ kind }) => kind === "project");
  return project?.lines.map(fieldLine).find((field) => field?.name === "dag_owner")?.rawValue ?? "user";
}

function authorityImpact(
  text: string,
  request: PlanningReshapeRequest,
  changed: boolean,
): PlanningReshapeAuthorityImpact {
  const affectsDag = request.strict_fragment !== null;
  return Object.freeze({
    affectedScopes: affectsDag
      ? Object.freeze(["dag"] as const)
      : Object.freeze([] as const),
    requiredOwner: affectsDag ? ownerFromSource(text) : null,
    userResponseRequired: affectsDag && changed,
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
    windowCloseReport: null,
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
  if (!["reshape", "project", "defer", "archive", "composite"].includes(normalized.request.intent)) {
    diagnostics.push(reshapeDiagnostic(`Planning reshape intent ${normalized.request.intent} belongs to a later Core`));
  }
  validateProjectionFragment(text, normalized.request, source.model, diagnostics);
  validateDeferralFragment(text, normalized.request, source.model, diagnostics);
  validateProtectedLinkReallocation(text, normalized.request, source.model, diagnostics);
  validateArchiveIntent(normalized.request, source.model, diagnostics);
  const state = buildState(text, normalized.request, source.model, diagnostics);
  if (diagnostics.some(({ severity }) => severity === "error")) {
    return Object.freeze({
      ...failedAudit(sourceDigest, source.documentId, diagnostics),
      normalizedRequest: normalized.request,
      canonicalRequestUtf8: normalized.canonicalUtf8,
      preflightHash: normalized.preflightHash,
      beforeDescriptions: state.beforeDescriptions,
      afterDescriptions: state.afterDescriptions,
      windowCloseReport: state.windowCloseReport,
    });
  }
  const candidate = candidateText(text, source.model, state, normalized.request);
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
      windowCloseReport: state.windowCloseReport,
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
    windowCloseReport: state.windowCloseReport,
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
    authorityImpact: authorityImpact(text, audit.normalizedRequest!, audit.changed),
    diagnostics: Object.freeze([...audit.diagnostics, reshapeDiagnostic("Planning reshape token registry is full", "PTPOOL-115")]),
  });
  return Object.freeze({
    ...audit,
    schemaVersion: "Perttool.PlanningReshapePreflightResult.v1",
    preflightToken: issue.token,
    tokenExpiresAt: issue.expiresAt,
    authorityImpact: authorityImpact(text, audit.normalizedRequest!, audit.changed),
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
    authorityImpact: audit.documentId === null || audit.normalizedRequest === null
      ? null
      : authorityImpact(text, audit.normalizedRequest, audit.changed),
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
