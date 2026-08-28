import type {
  PlanningAssociationDisposition,
  PlanningDependencyDisposition,
  PlanningEntityDisposition,
  PlanningProjectionLinkDisposition,
  PlanningReshapeRequest,
  PlanningReshapeSemanticElement,
  PlanningWindowMembershipDisposition,
} from "./reshape-types.js";
import type {
  PlanningIntentAction,
  PlanningIntentCompilationResult,
  PlanningIntentRequest,
} from "./intent-types.js";
import type {
  PlanningPoolSourceDiagnostic,
  PlanningPoolSourceModel,
  PlanningWorkSource,
} from "./source-types.js";
import type {
  PlanningCarryOverTarget,
  PlanningWindowMutationRequest,
} from "./window-types.js";

export type {
  PlanningIntentAction,
  PlanningIntentCompilationResult,
  PlanningIntentRequest,
} from "./intent-types.js";

export const PLANNING_INTENT_REQUEST_SCHEMA_VERSION =
  "Perttool.PlanningIntentRequest.v1" as const;

type JsonRecord = Record<string, unknown>;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const qualifiedPattern = /^[A-Za-z][A-Za-z0-9_-]*::[A-Za-z][A-Za-z0-9_-]*$/u;

function diagnostic(message: string): PlanningPoolSourceDiagnostic {
  return Object.freeze({
    code: "PTPOOL-118",
    severity: "error" as const,
    message,
    data: Object.freeze({}),
  });
}

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function closed(
  value: unknown,
  fields: readonly string[],
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): JsonRecord | null {
  const parsed = record(value);
  if (parsed === null) {
    diagnostics.push(diagnostic(`${label} must be an object`));
    return null;
  }
  const expected = new Set(fields);
  const missing = fields.filter((field) => !Object.hasOwn(parsed, field));
  const unknown = Object.keys(parsed).filter((field) => !expected.has(field));
  if (missing.length > 0) diagnostics.push(diagnostic(`${label} is missing fields: ${missing.join(", ")}`));
  if (unknown.length > 0) diagnostics.push(diagnostic(`${label} has unknown fields: ${unknown.join(", ")}`));
  return missing.length === 0 && unknown.length === 0 ? parsed : null;
}

function text(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
  nonEmpty = true,
): string | null {
  if (typeof value !== "string" || (nonEmpty && value.length === 0)) {
    diagnostics.push(diagnostic(`${label} must be ${nonEmpty ? "a non-empty" : "a"} string`));
    return null;
  }
  return value;
}

function nullableText(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
  nonEmpty: boolean,
): string | null | undefined {
  return value === null ? null : text(value, label, diagnostics, nonEmpty) ?? undefined;
}

function qualified(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | null {
  const parsed = text(value, label, diagnostics);
  if (parsed !== null && !qualifiedPattern.test(parsed)) {
    diagnostics.push(diagnostic(`${label} must be a fully qualified identity`));
    return null;
  }
  return parsed;
}

function nullableQualified(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): string | null | undefined {
  return value === null ? null : qualified(value, label, diagnostics) ?? undefined;
}

function qualifiedSet(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): readonly string[] | null {
  if (!Array.isArray(value)) {
    diagnostics.push(diagnostic(`${label} must be an array`));
    return null;
  }
  const result = value.map((item) => qualified(item, label, diagnostics));
  if (result.some((item) => item === null)) return null;
  const strings = result as string[];
  if (new Set(strings).size !== strings.length) diagnostics.push(diagnostic(`${label} contains a duplicate`));
  return Object.freeze([...strings].sort());
}

function booleanValue(
  value: unknown,
  label: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): boolean | null {
  if (typeof value !== "boolean") {
    diagnostics.push(diagnostic(`${label} must be boolean`));
    return null;
  }
  return value;
}

function parseCarryTarget(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningCarryOverTarget | null | undefined {
  if (value === null) return null;
  const kind = record(value)?.["kind"];
  if (kind === "existing") {
    const parsed = closed(value, ["kind", "window_id"], "existing carry-over target", diagnostics);
    const windowId = parsed === null ? null : qualified(parsed["window_id"], "carry-over window_id", diagnostics);
    return parsed === null || windowId === null ? undefined : Object.freeze({ kind, window_id: windowId });
  }
  if (kind === "new") {
    const parsed = closed(value, ["kind", "window_id", "title", "objective", "start", "end"], "new carry-over target", diagnostics);
    if (parsed === null) return undefined;
    const windowId = qualified(parsed["window_id"], "carry-over window_id", diagnostics);
    const title = text(parsed["title"], "carry-over title", diagnostics);
    const objective = text(parsed["objective"], "carry-over objective", diagnostics);
    const start = nullableText(parsed["start"], "carry-over start", diagnostics, true);
    const end = nullableText(parsed["end"], "carry-over end", diagnostics, true);
    return windowId === null || title === null || objective === null || start === undefined || end === undefined
      ? undefined
      : Object.freeze({ kind, window_id: windowId, title, objective, start, end });
  }
  diagnostics.push(diagnostic("carry_over_target must be null, existing, or new"));
  return undefined;
}

function parseCreateWorkAction(value: unknown, diagnostics: PlanningPoolSourceDiagnostic[]): PlanningIntentAction | null {
    const parsed = closed(value, ["kind", "work_id", "title", "description", "insert_after_work_id"], "create_work action", diagnostics);
    if (parsed === null) return null;
    const workId = qualified(parsed["work_id"], "work_id", diagnostics);
    const title = text(parsed["title"], "title", diagnostics);
    const description = text(parsed["description"], "description", diagnostics, false);
    const anchor = nullableQualified(parsed["insert_after_work_id"], "insert_after_work_id", diagnostics);
    return workId === null || title === null || description === null || anchor === undefined
      ? null
      : Object.freeze({ kind: "create_work", work_id: workId, title, description, insert_after_work_id: anchor });
}

function parseUpdateWorkAction(value: unknown, diagnostics: PlanningPoolSourceDiagnostic[]): PlanningIntentAction | null {
    const parsed = closed(value, ["kind", "work_id", "title", "description"], "update_work action", diagnostics);
    if (parsed === null) return null;
    const workId = qualified(parsed["work_id"], "work_id", diagnostics);
    const title = nullableText(parsed["title"], "title", diagnostics, true);
    const description = nullableText(parsed["description"], "description", diagnostics, false);
    if (title === null && description === null) diagnostics.push(diagnostic("update_work requires title or description"));
    return workId === null || title === undefined || description === undefined || (title === null && description === null)
      ? null
      : Object.freeze({ kind: "update_work", work_id: workId, title, description });
}

function parseMoveWorkAction(value: unknown, diagnostics: PlanningPoolSourceDiagnostic[]): PlanningIntentAction | null {
    const parsed = closed(value, ["kind", "work_id", "insert_after_work_id"], "move_work action", diagnostics);
    if (parsed === null) return null;
    const workId = qualified(parsed["work_id"], "work_id", diagnostics);
    const anchor = nullableQualified(parsed["insert_after_work_id"], "insert_after_work_id", diagnostics);
    return workId === null || anchor === undefined ? null : Object.freeze({ kind: "move_work", work_id: workId, insert_after_work_id: anchor });
}

function parseDependencyAction(value: unknown, diagnostics: PlanningPoolSourceDiagnostic[]): PlanningIntentAction | null {
    const parsed = closed(value, ["kind", "dependent_work_id", "prerequisite_work_id", "present"], "set_dependency action", diagnostics);
    if (parsed === null) return null;
    const dependent = qualified(parsed["dependent_work_id"], "dependent_work_id", diagnostics);
    const prerequisite = qualified(parsed["prerequisite_work_id"], "prerequisite_work_id", diagnostics);
    const present = booleanValue(parsed["present"], "present", diagnostics);
    return dependent === null || prerequisite === null || present === null
      ? null
      : Object.freeze({ kind: "set_dependency", dependent_work_id: dependent, prerequisite_work_id: prerequisite, present });
}

function parseArchiveAction(value: unknown, diagnostics: PlanningPoolSourceDiagnostic[]): PlanningIntentAction | null {
    const parsed = closed(value, ["kind", "work_id"], "archive_work action", diagnostics);
    const workId = parsed === null ? null : qualified(parsed["work_id"], "work_id", diagnostics);
    return parsed === null || workId === null ? null : Object.freeze({ kind: "archive_work", work_id: workId });
}

function parseProjectAction(value: unknown, diagnostics: PlanningPoolSourceDiagnostic[]): PlanningIntentAction | null {
    const parsed = closed(value, ["kind", "event_ids", "activity_ids"], "project action", diagnostics);
    if (parsed === null) return null;
    const events = qualifiedSet(parsed["event_ids"], "event_ids", diagnostics);
    const activities = qualifiedSet(parsed["activity_ids"], "activity_ids", diagnostics);
    if ((events?.length ?? 0) + (activities?.length ?? 0) === 0) diagnostics.push(diagnostic("project action must select at least one entity"));
    return events === null || activities === null || events.length + activities.length === 0
      ? null
      : Object.freeze({ kind: "project", event_ids: events, activity_ids: activities });
}

function parseDeferAction(value: unknown, diagnostics: PlanningPoolSourceDiagnostic[]): PlanningIntentAction | null {
    const parsed = closed(value, ["kind", "task_ids", "milestone_ids"], "defer action", diagnostics);
    if (parsed === null) return null;
    const tasks = qualifiedSet(parsed["task_ids"], "task_ids", diagnostics);
    const milestones = qualifiedSet(parsed["milestone_ids"], "milestone_ids", diagnostics);
    if ((tasks?.length ?? 0) + (milestones?.length ?? 0) === 0) diagnostics.push(diagnostic("defer action must select at least one entity"));
    return tasks === null || milestones === null || tasks.length + milestones.length === 0
      ? null
      : Object.freeze({ kind: "defer", task_ids: tasks, milestone_ids: milestones });
}

function parseCreateWindowAction(value: unknown, diagnostics: PlanningPoolSourceDiagnostic[]): PlanningIntentAction | null {
    const parsed = closed(value, ["kind", "window_id", "title", "objective", "start", "end", "work_ids"], "create_window action", diagnostics);
    if (parsed === null) return null;
    const windowId = qualified(parsed["window_id"], "window_id", diagnostics);
    const title = text(parsed["title"], "title", diagnostics);
    const objective = text(parsed["objective"], "objective", diagnostics);
    const start = nullableText(parsed["start"], "start", diagnostics, true);
    const end = nullableText(parsed["end"], "end", diagnostics, true);
    const works = qualifiedSet(parsed["work_ids"], "work_ids", diagnostics);
    if (works !== null && works.length === 0) diagnostics.push(diagnostic("create_window requires at least one Work"));
    return windowId === null || title === null || objective === null || start === undefined || end === undefined || works === null || works.length === 0
      ? null
      : Object.freeze({ kind: "create_window", window_id: windowId, title, objective, start, end, work_ids: works });
}

function parseMembershipAction(value: unknown, diagnostics: PlanningPoolSourceDiagnostic[]): PlanningIntentAction | null {
    const parsed = closed(value, ["kind", "window_id", "work_id", "selected"], "set_window_membership action", diagnostics);
    if (parsed === null) return null;
    const windowId = qualified(parsed["window_id"], "window_id", diagnostics);
    const workId = qualified(parsed["work_id"], "work_id", diagnostics);
    const selected = booleanValue(parsed["selected"], "selected", diagnostics);
    return windowId === null || workId === null || selected === null
      ? null
      : Object.freeze({ kind: "set_window_membership", window_id: windowId, work_id: workId, selected });
}

function parseCloseWindowAction(value: unknown, diagnostics: PlanningPoolSourceDiagnostic[]): PlanningIntentAction | null {
    const parsed = closed(value, ["kind", "window_id", "carry_over_work_ids", "carry_over_target"], "close_window action", diagnostics);
    if (parsed === null) return null;
    const windowId = qualified(parsed["window_id"], "window_id", diagnostics);
    const works = qualifiedSet(parsed["carry_over_work_ids"], "carry_over_work_ids", diagnostics);
    const target = parseCarryTarget(parsed["carry_over_target"], diagnostics);
    if (works !== null && (works.length === 0) !== (target === null)) diagnostics.push(diagnostic("close_window requires a target exactly when carry-over is non-empty"));
    return windowId === null || works === null || target === undefined || ((works.length === 0) !== (target === null))
      ? null
      : Object.freeze({ kind: "close_window", window_id: windowId, carry_over_work_ids: works, carry_over_target: target });
}

function parseAction(
  value: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningIntentAction | null {
  switch (record(value)?.["kind"]) {
    case "create_work": return parseCreateWorkAction(value, diagnostics);
    case "update_work": return parseUpdateWorkAction(value, diagnostics);
    case "move_work": return parseMoveWorkAction(value, diagnostics);
    case "set_dependency": return parseDependencyAction(value, diagnostics);
    case "archive_work": return parseArchiveAction(value, diagnostics);
    case "project": return parseProjectAction(value, diagnostics);
    case "defer": return parseDeferAction(value, diagnostics);
    case "create_window": return parseCreateWindowAction(value, diagnostics);
    case "set_window_membership": return parseMembershipAction(value, diagnostics);
    case "close_window": return parseCloseWindowAction(value, diagnostics);
  }
  diagnostics.push(diagnostic("Planning intent action kind is unsupported"));
  return null;
}

function normalizeIntent(
  input: unknown,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningIntentRequest | null {
  const parsed = closed(input, ["request_schema_version", "source_digest", "action"], "Planning intent request", diagnostics);
  if (parsed === null) return null;
  if (parsed["request_schema_version"] !== PLANNING_INTENT_REQUEST_SCHEMA_VERSION) {
    diagnostics.push(diagnostic("Planning intent request schema identity is unsupported"));
  }
  const sourceDigest = text(parsed["source_digest"], "source_digest", diagnostics);
  if (sourceDigest !== null && !digestPattern.test(sourceDigest)) diagnostics.push(diagnostic("source_digest must be a lowercase SHA-256 identity"));
  const action = parseAction(parsed["action"], diagnostics);
  return sourceDigest === null || !digestPattern.test(sourceDigest) || action === null
    ? null
    : Object.freeze({ request_schema_version: PLANNING_INTENT_REQUEST_SCHEMA_VERSION, source_digest: sourceDigest, action });
}

export function isPlanningIntentRequest(input: unknown): boolean {
  return record(input)?.["request_schema_version"] === PLANNING_INTENT_REQUEST_SCHEMA_VERSION;
}

function local(qualifiedId: string): string {
  return qualifiedId.slice(qualifiedId.indexOf("::") + 2);
}

function findWork(
  model: PlanningPoolSourceModel,
  id: string,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningWorkSource | null {
  const work = model.works.find(({ qualifiedId }) => qualifiedId === id) ?? null;
  if (work === null) diagnostics.push(diagnostic(`Work ${id} does not exist`));
  return work;
}

function descriptionElement(
  work: PlanningWorkSource,
  destinationText: string,
  index: number,
  discard = false,
): PlanningReshapeSemanticElement | null {
  const source = work.description?.value ?? "";
  if (source.length === 0 && destinationText.length === 0 && !discard) return null;
  return Object.freeze({
    element_id: `INTENT_DESCRIPTION_${String(index).padStart(4, "0")}`,
    origin: Object.freeze({
      kind: "existing" as const,
      work_id: work.qualifiedId,
      start_utf16: 0,
      end_utf16: source.length,
      source_text: source,
    }),
    destination: discard
      ? Object.freeze({ kind: "discard" as const, reason: "explicit eligible archive" })
      : Object.freeze({ kind: "work" as const, work_id: work.qualifiedId, position: 0, text: destinationText }),
  });
}

interface PreservedRelations {
  readonly entities: PlanningEntityDisposition[];
  readonly associations: PlanningAssociationDisposition[];
  readonly links: PlanningProjectionLinkDisposition[];
  readonly dependencies: PlanningDependencyDisposition[];
  readonly memberships: PlanningWindowMembershipDisposition[];
}

function preservedRelations(
  model: PlanningPoolSourceModel,
  affected: ReadonlySet<string>,
): PreservedRelations {
  const entities = new Map<string, PlanningEntityDisposition>();
  const associations: PlanningAssociationDisposition[] = [];
  const links: PlanningProjectionLinkDisposition[] = [];
  const dependencies: PlanningDependencyDisposition[] = [];
  const memberships: PlanningWindowMembershipDisposition[] = [];
  for (const work of model.works.filter(({ qualifiedId }) => affected.has(qualifiedId))) {
    for (const event of work.events) {
      entities.set(`event:${event.qualifiedId}`, Object.freeze({ entity_kind: "event", entity_id: event.qualifiedId, action: "retain" }));
      associations.push(Object.freeze({ entity_kind: "event", entity_id: event.qualifiedId, origin_work_id: work.qualifiedId, destination_work_id: work.qualifiedId }));
    }
    for (const activity of work.activities) {
      entities.set(`activity:${activity.qualifiedId}`, Object.freeze({ entity_kind: "activity", entity_id: activity.qualifiedId, action: "retain" }));
      associations.push(Object.freeze({ entity_kind: "activity", entity_id: activity.qualifiedId, origin_work_id: work.qualifiedId, destination_work_id: work.qualifiedId }));
    }
    for (const milestone of work.milestoneLinks) {
      links.push(Object.freeze({ strict_kind: "milestone", strict_id: milestone.qualifiedId, origin_work_id: work.qualifiedId, destination_work_id: work.qualifiedId }));
    }
    for (const task of work.taskLinks) {
      links.push(Object.freeze({ strict_kind: "task", strict_id: task.qualifiedId, origin_work_id: work.qualifiedId, destination_work_id: work.qualifiedId }));
    }
  }
  for (const dependent of model.works) {
    for (const prerequisite of dependent.dependsOn) {
      if (affected.has(dependent.qualifiedId) || affected.has(prerequisite.qualifiedId)) {
        dependencies.push(Object.freeze({
          dependent_work_id: dependent.qualifiedId,
          prerequisite_work_id: prerequisite.qualifiedId,
          action: "retain",
        }));
      }
    }
  }
  for (const window of model.windows) {
    for (const work of window.works) {
      if (affected.has(work.qualifiedId)) memberships.push(Object.freeze({
        window_id: window.qualifiedId,
        origin_work_id: work.qualifiedId,
        destination_work_id: work.qualifiedId,
      }));
    }
  }
  return { entities: [...entities.values()], associations, links, dependencies, memberships };
}

function orderedWorkIds(model: PlanningPoolSourceModel): string[] {
  const declared = model.workOrder.map(({ qualifiedId }) => qualifiedId);
  return declared.length === model.works.length
    ? [...declared]
    : model.works.map(({ qualifiedId }) => qualifiedId);
}

function moveAfter(order: readonly string[], id: string, after: string | null): string[] {
  const result = order.filter((candidate) => candidate !== id);
  const position = after === null ? 0 : result.indexOf(after) + 1;
  result.splice(Math.max(0, position), 0, id);
  return result;
}

function reshapeBase(
  request: PlanningIntentRequest,
  affected: readonly string[],
  relations: PreservedRelations,
): PlanningReshapeRequest {
  return {
    request_schema_version: "Perttool.PlanningReshapeRequest.v2",
    normalization_contract: "perttool.planning-reshape-normalization@2",
    source_digest: request.source_digest,
    intent: "reshape",
    affected_work_ids: affected,
    created_works: [],
    work_title_dispositions: [],
    removed_work_ids: [],
    semantic_elements: [],
    planning_entity_dispositions: relations.entities,
    association_dispositions: relations.associations,
    projection_link_dispositions: relations.links,
    dependency_dispositions: relations.dependencies,
    window_membership_dispositions: relations.memberships,
    final_work_order: [],
    add_residual_description: [],
    strict_fragment: null,
    window_close: null,
  };
}

type ActionOf<K extends PlanningIntentAction["kind"]> = Extract<PlanningIntentAction, { readonly kind: K }>;

function compileCreateWork(
  request: PlanningIntentRequest,
  action: ActionOf<"create_work">,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningReshapeRequest {
    if (model.works.some(({ qualifiedId }) => qualifiedId === action.work_id)) diagnostics.push(diagnostic(`Work ${action.work_id} already exists`));
    if (action.insert_after_work_id !== null) findWork(model, action.insert_after_work_id, diagnostics);
    const relations = preservedRelations(model, new Set());
    const base = reshapeBase(request, [action.work_id], relations);
    const order = moveAfter([...orderedWorkIds(model), action.work_id], action.work_id, action.insert_after_work_id);
    const semanticElements: readonly PlanningReshapeSemanticElement[] = action.description.length === 0
      ? Object.freeze([])
      : Object.freeze([Object.freeze({
          element_id: "INTENT_DESCRIPTION_0001",
          origin: Object.freeze({ kind: "created" as const, source_text: action.description, asserted_new_meaning: true as const }),
          destination: Object.freeze({ kind: "work" as const, work_id: action.work_id, position: 0, text: action.description }),
        })]);
    return Object.freeze({
      ...base,
      created_works: Object.freeze([{ work_id: action.work_id, title: action.title, insert_after_work_id: action.insert_after_work_id }]),
      semantic_elements: semanticElements,
      final_work_order: Object.freeze(order),
    });
}

function compileMoveWork(
  request: PlanningIntentRequest,
  action: ActionOf<"move_work">,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningReshapeRequest {
    findWork(model, action.work_id, diagnostics);
    if (action.insert_after_work_id !== null) findWork(model, action.insert_after_work_id, diagnostics);
    if (action.work_id === action.insert_after_work_id) diagnostics.push(diagnostic("A Work cannot be moved after itself"));
    const base = reshapeBase(request, [], preservedRelations(model, new Set()));
    return Object.freeze({ ...base, final_work_order: Object.freeze(moveAfter(orderedWorkIds(model), action.work_id, action.insert_after_work_id)) });
}

function compileWorkMaintenance(
  request: PlanningIntentRequest,
  action: ActionOf<"update_work"> | ActionOf<"archive_work">,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningReshapeRequest | null {
    const work = findWork(model, action.work_id, diagnostics);
    if (work === null) return null;
    const affected = new Set([action.work_id]);
    const base = reshapeBase(request, [action.work_id], preservedRelations(model, affected));
    const archive = action.kind === "archive_work";
    const desiredDescription = archive ? "" : action.description ?? work.description?.value ?? "";
    const element = descriptionElement(work, desiredDescription, 1, archive);
    return Object.freeze({
      ...base,
      intent: archive ? "archive" : "reshape",
      work_title_dispositions: archive || action.title === null
        ? Object.freeze([])
        : Object.freeze([{ work_id: action.work_id, title: action.title }]),
      removed_work_ids: archive ? Object.freeze([action.work_id]) : Object.freeze([]),
      semantic_elements: element === null ? Object.freeze([]) : Object.freeze([element]),
      final_work_order: archive
        ? Object.freeze(orderedWorkIds(model).filter((id) => id !== action.work_id))
        : Object.freeze([]),
    });
}

function unchangedDescriptionElements(
  model: PlanningPoolSourceModel,
  affected: ReadonlySet<string>,
): readonly PlanningReshapeSemanticElement[] {
  return Object.freeze(model.works.filter(({ qualifiedId }) => affected.has(qualifiedId))
    .map((work, index) => descriptionElement(work, work.description?.value ?? "", index + 1))
    .filter((item): item is PlanningReshapeSemanticElement => item !== null));
}

function compileDependency(
  request: PlanningIntentRequest,
  action: ActionOf<"set_dependency">,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningReshapeRequest | null {
    const dependent = findWork(model, action.dependent_work_id, diagnostics);
    const prerequisite = findWork(model, action.prerequisite_work_id, diagnostics);
    if (action.dependent_work_id === action.prerequisite_work_id) diagnostics.push(diagnostic("A Work cannot depend on itself"));
    if (dependent === null || prerequisite === null) return null;
    const exists = dependent.dependsOn.some(({ qualifiedId }) => qualifiedId === action.prerequisite_work_id);
    if (exists === action.present) return reshapeBase(request, [], preservedRelations(model, new Set()));
    const affected = new Set([action.dependent_work_id, action.prerequisite_work_id]);
    const base = reshapeBase(request, [...affected].sort(), preservedRelations(model, affected));
    const targetKey = `${action.dependent_work_id}|${action.prerequisite_work_id}`;
    const retained = base.dependency_dispositions.filter((item) => `${item.dependent_work_id}|${item.prerequisite_work_id}` !== targetKey);
    const disposition: PlanningDependencyDisposition = Object.freeze({
      dependent_work_id: action.dependent_work_id,
      prerequisite_work_id: action.prerequisite_work_id,
      action: action.present ? "create" : "no_longer_required",
      ...(action.present ? {} : { reason: "explicit dependency maintenance" }),
    });
    return Object.freeze({
      ...base,
      semantic_elements: unchangedDescriptionElements(model, affected),
      dependency_dispositions: Object.freeze([...retained, disposition]),
    });
}

function compileProject(
  request: PlanningIntentRequest,
  action: ActionOf<"project">,
  model: PlanningPoolSourceModel,
): PlanningReshapeRequest {
    const eventSet = new Set(action.event_ids);
    const activitySet = new Set(action.activity_ids);
    const affected = new Set(model.works.filter((work) =>
      work.events.some(({ qualifiedId }) => eventSet.has(qualifiedId)) ||
      work.activities.some(({ qualifiedId }) => activitySet.has(qualifiedId)))
      .map(({ qualifiedId }) => qualifiedId));
    const relations = preservedRelations(model, affected);
    const entityMap = new Map(relations.entities.map((item) => [`${item.entity_kind}:${item.entity_id}`, item]));
    for (const id of action.event_ids) entityMap.set(`event:${id}`, Object.freeze({ entity_kind: "event", entity_id: id, action: "project" }));
    for (const id of action.activity_ids) entityMap.set(`activity:${id}`, Object.freeze({ entity_kind: "activity", entity_id: id, action: "project" }));
    const associations = relations.associations.map((item) =>
      (item.entity_kind === "event" ? eventSet : activitySet).has(item.entity_id)
        ? Object.freeze({ ...item, destination_work_id: null })
        : item);
    const addedLinks = associations.flatMap((item) => {
      const selected = (item.entity_kind === "event" ? eventSet : activitySet).has(item.entity_id);
      return !selected || item.origin_work_id === null ? [] : [Object.freeze({
        strict_kind: item.entity_kind === "event" ? "milestone" as const : "task" as const,
        strict_id: item.entity_id,
        origin_work_id: null,
        destination_work_id: item.origin_work_id,
      })];
    });
    const base = reshapeBase(request, [...affected].sort(), { ...relations, entities: [...entityMap.values()], associations, links: [...relations.links, ...addedLinks] });
    return Object.freeze({
      ...base,
      intent: "project",
      semantic_elements: unchangedDescriptionElements(model, affected),
      strict_fragment: Object.freeze({ kind: "project", event_ids: action.event_ids, activity_ids: action.activity_ids }),
    });
}

function compileDefer(
  request: PlanningIntentRequest,
  action: ActionOf<"defer">,
  model: PlanningPoolSourceModel,
): PlanningReshapeRequest {
    const taskSet = new Set(action.task_ids);
    const milestoneSet = new Set(action.milestone_ids);
    const affected = new Set(model.works.filter((work) =>
      work.taskLinks.some(({ qualifiedId }) => taskSet.has(qualifiedId)) ||
      work.milestoneLinks.some(({ qualifiedId }) => milestoneSet.has(qualifiedId)))
      .map(({ qualifiedId }) => qualifiedId));
    const relations = preservedRelations(model, affected);
    const entityMap = new Map(relations.entities.map((item) => [`${item.entity_kind}:${item.entity_id}`, item]));
    for (const id of action.task_ids) entityMap.set(`activity:${id}`, Object.freeze({ entity_kind: "activity", entity_id: id, action: "defer" }));
    for (const id of action.milestone_ids) entityMap.set(`event:${id}`, Object.freeze({ entity_kind: "event", entity_id: id, action: "defer" }));
    const associations = [...relations.associations];
    const links = relations.links.map((item) => {
      const selected = (item.strict_kind === "task" ? taskSet : milestoneSet).has(item.strict_id);
      if (!selected) return item;
      associations.push(Object.freeze({
        entity_kind: item.strict_kind === "task" ? "activity" : "event",
        entity_id: item.strict_id,
        origin_work_id: null,
        destination_work_id: item.origin_work_id,
      }));
      return Object.freeze({ ...item, destination_work_id: null });
    });
    const base = reshapeBase(request, [...affected].sort(), { ...relations, entities: [...entityMap.values()], associations, links });
    return Object.freeze({
      ...base,
      intent: "defer",
      semantic_elements: unchangedDescriptionElements(model, affected),
      strict_fragment: Object.freeze({ kind: "defer", task_ids: action.task_ids, milestone_ids: action.milestone_ids }),
    });
}

function compileReshape(
  request: PlanningIntentRequest,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningReshapeRequest | null {
  const action = request.action;
  switch (action.kind) {
    case "create_work": return compileCreateWork(request, action, model, diagnostics);
    case "update_work": return compileWorkMaintenance(request, action, model, diagnostics);
    case "move_work": return compileMoveWork(request, action, model, diagnostics);
    case "set_dependency": return compileDependency(request, action, model, diagnostics);
    case "archive_work": return compileWorkMaintenance(request, action, model, diagnostics);
    case "project": return compileProject(request, action, model);
    case "defer": return compileDefer(request, action, model);
    default: return null;
  }
}

function compileWindow(
  request: PlanningIntentRequest,
  model: PlanningPoolSourceModel,
  diagnostics: PlanningPoolSourceDiagnostic[],
): PlanningWindowMutationRequest | null {
  const action = request.action;
  if (action.kind === "create_window") return Object.freeze({
    request_schema_version: "Perttool.WindowMutationRequest.v1",
    source_digest: request.source_digest,
    operation: "add",
    window_id: action.window_id,
    final: Object.freeze({ title: action.title, objective: action.objective, start: action.start, end: action.end, work_ids: action.work_ids }),
    objective_disposition: null,
    carry_over_work_ids: Object.freeze([]),
    carry_over_target: null,
  });
  if (action.kind === "set_window_membership") {
    const window = model.windows.find(({ qualifiedId }) => qualifiedId === action.window_id);
    if (window === undefined) {
      diagnostics.push(diagnostic(`Window ${action.window_id} does not exist`));
      return null;
    }
    findWork(model, action.work_id, diagnostics);
    const works = new Set(window.works.map(({ qualifiedId }) => qualifiedId));
    if (action.selected) works.add(action.work_id);
    else works.delete(action.work_id);
    return Object.freeze({
      request_schema_version: "Perttool.WindowMutationRequest.v1",
      source_digest: request.source_digest,
      operation: "set",
      window_id: action.window_id,
      final: Object.freeze({
        title: window.title,
        objective: window.objective,
        start: window.start?.sourceText ?? null,
        end: window.end?.sourceText ?? null,
        work_ids: Object.freeze([...works].sort()),
      }),
      objective_disposition: null,
      carry_over_work_ids: Object.freeze([]),
      carry_over_target: null,
    });
  }
  if (action.kind === "close_window") return Object.freeze({
    request_schema_version: "Perttool.WindowMutationRequest.v1",
    source_digest: request.source_digest,
    operation: "close",
    window_id: action.window_id,
    final: null,
    objective_disposition: "discard",
    carry_over_work_ids: action.carry_over_work_ids,
    carry_over_target: action.carry_over_target,
  });
  return null;
}

export function compilePlanningIntentRequest(
  input: unknown,
  model: PlanningPoolSourceModel,
): PlanningIntentCompilationResult {
  const diagnostics: PlanningPoolSourceDiagnostic[] = [];
  const normalizedIntent = normalizeIntent(input, diagnostics);
  if (normalizedIntent === null || diagnostics.length > 0) return Object.freeze({
    ok: false,
    normalizedIntent: null,
    reshapeRequest: null,
    windowRequest: null,
    diagnostics: Object.freeze(diagnostics),
  });
  const windowAction = ["create_window", "set_window_membership", "close_window"].includes(normalizedIntent.action.kind);
  const reshapeRequest = windowAction ? null : compileReshape(normalizedIntent, model, diagnostics);
  const windowRequest = windowAction ? compileWindow(normalizedIntent, model, diagnostics) : null;
  return Object.freeze({
    ok: diagnostics.length === 0 && (reshapeRequest !== null || windowRequest !== null),
    normalizedIntent,
    reshapeRequest,
    windowRequest,
    diagnostics: Object.freeze(diagnostics),
  });
}
