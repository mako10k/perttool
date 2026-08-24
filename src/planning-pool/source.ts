import { parseDeclaredCalendarValue } from "../model/calendar.js";
import {
  normalizeMaxDiagnostics,
  type Diagnostic,
  type SourceSpan,
} from "../model/diagnostics.js";
import { compare } from "../model/rational.js";
import { sourceValidationResult } from "../model/source-result.js";
import {
  fieldLine,
  scanTemporalDeclarationBlocks,
  sourceLineSpan,
  sourceSliceSpan,
  splitTemporalSourceLines,
  type TemporalSourceLine,
} from "../temporal-schedule/source-lexical.js";
import {
  parseTemporalScheduleSource,
  TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
} from "../temporal-schedule/source.js";
import type { TemporalCalendarProfileSource } from "../temporal-schedule/source-types.js";
import {
  compareInstants,
  zoneOffsetMatches,
} from "../temporal-schedule/source-values.js";
import {
  declaredPlanningGrammarVersion,
  malformedPlanningHeaderLines,
  planningFields,
  planningPoolBaseText,
  scanPlanningDeclarationBlocks,
  type PlanningDeclarationBlock,
  type PlanningFieldBlock,
} from "./source-lexical.js";
import type {
  PlanningActivitySource,
  PlanningDescriptionSource,
  PlanningDurationSource,
  PlanningEstimateSource,
  PlanningEventSource,
  PlanningPoolSourceCapability,
  PlanningPoolSourceDiagnostic,
  PlanningPoolSourceModel,
  PlanningPoolSourceResult,
  PlanningReferenceSource,
  PlanningRequirementSource,
  PlanningWhenSource,
  PlanningWindowSource,
  PlanningWorkSource,
} from "./source-types.js";
import {
  comparePlanningCalendarValues,
  parsePlanningDescription,
  parsePlanningDuration,
  parsePlanningInteger,
  parsePlanningString,
  parsePlanningTags,
  parsePlanningWhen,
} from "./source-values.js";

export const PLANNING_POOL_SOURCE_MODEL_VERSION = 1 as const;

export const PLANNING_POOL_SOURCE_CAPABILITY:
  PlanningPoolSourceCapability = Object.freeze({
    id: "perttool.target-grammar-9-planning-pool-source",
    version: 1,
    grammarVersion: 9,
  });

export const PLANNING_POOL_SOURCE_LIMITS = Object.freeze({
  sourceOrCandidateUtf8Bytes: 8_388_608,
  works: 10_000,
  events: 20_000,
  activities: 20_000,
  associationsPlusProjectionLinks: 100_000,
  workDependencies: 100_000,
  persistedWindows: 2_048,
  persistedWindowMemberships: 100_000,
});

type EntityKind =
  | "project"
  | "calendar"
  | "resource"
  | "milestone"
  | "task"
  | "gate"
  | "other";

interface ParseContext {
  readonly text: string;
  readonly documentId: string;
  readonly blocks: readonly PlanningDeclarationBlock[];
  readonly diagnostics: Diagnostic[];
  readonly baseEntities: ReadonlyMap<string, EntityKind>;
  readonly durationUnit: "day" | "hour" | "point";
  readonly temporalProfile: TemporalCalendarProfileSource;
}

interface ParsedPlanning {
  readonly works: readonly PlanningWorkSource[];
  readonly events: readonly PlanningEventSource[];
  readonly activities: readonly PlanningActivitySource[];
  readonly windows: readonly PlanningWindowSource[];
  readonly workOrder: readonly PlanningReferenceSource[];
  readonly dependencyCycles: readonly (readonly string[])[];
}

const allowedFields = Object.freeze({
  work: new Set([
    "title", "description", "events", "activities", "milestone_links",
    "task_links", "depends_on",
  ]),
  event: new Set(["title", "description", "tags", "source"]),
  activity: new Set([
    "title", "description", "duration", "estimate", "priority", "requires",
    "owner", "tags", "source", "calendar", "when", "deadline",
  ]),
  window: new Set(["title", "objective", "start", "end", "works"]),
  work_order: new Set<string>(),
});

const associationFieldNames = new Set([
  "events",
  "activities",
  "milestone_links",
  "task_links",
]);
const dependencyFieldNames = new Set(["depends_on"]);
const windowMembershipFieldNames = new Set(["works"]);

function diagnostic(
  code: string,
  message: string,
  span: SourceSpan,
  entityId?: string,
): Diagnostic {
  return Object.freeze({
    code,
    severity: "error" as const,
    message,
    span,
    ...(entityId === undefined ? {} : { entityId }),
    helpTopic: "syntax",
    data: Object.freeze({}),
  });
}

function addDiagnostic(
  context: ParseContext,
  code: string,
  message: string,
  span: SourceSpan,
  entityId?: string,
): void {
  context.diagnostics.push(diagnostic(code, message, span, entityId));
}

function fieldOccurrences(
  block: PlanningDeclarationBlock,
  name: string,
): readonly PlanningFieldBlock[] {
  return planningFields(block).filter((field) => field.name === name);
}

function singleField(
  context: ParseContext,
  block: PlanningDeclarationBlock,
  name: string,
  required: boolean,
  code = "PTPOOL-101",
): PlanningFieldBlock | null {
  const values = fieldOccurrences(block, name);
  if (values.length > 1) {
    addDiagnostic(
      context,
      code,
      `Duplicate ${block.kind}.${name}`,
      values[1]!.span,
      block.id ?? undefined,
    );
  }
  if (values.length === 0 && required) {
    addDiagnostic(
      context,
      code,
      `${block.kind} ${block.id ?? "order"} requires ${name}`,
      block.idSpan ?? block.span,
      block.id ?? undefined,
    );
  }
  return values[0] ?? null;
}

function validateFieldSurface(
  context: ParseContext,
  block: PlanningDeclarationBlock,
): void {
  const fields = planningFields(block);
  const covered = new Set<number>();
  for (const field of fields) {
    covered.add(field.line.start);
    for (const child of field.children) covered.add(child.start);
    if (!allowedFields[block.kind].has(field.name)) {
      addDiagnostic(
        context,
        "PTPOOL-101",
        `Unknown ${block.kind} field ${field.name}`,
        field.span,
        block.id ?? undefined,
      );
    }
  }
  for (const line of block.lines) {
    if (covered.has(line.start) || line.text === "" || /^\s*#/u.test(line.text)) continue;
    addDiagnostic(
      context,
      "PTPOOL-101",
      `Invalid ${block.kind} field or indentation`,
      sourceLineSpan(line),
      block.id ?? undefined,
    );
  }
}

function requiredString(
  context: ParseContext,
  block: PlanningDeclarationBlock,
  name: string,
  code = "PTPOOL-101",
): Readonly<{ value: string; span: SourceSpan }> | null {
  const field = singleField(context, block, name, true, code);
  if (field === null) return null;
  const value = !field.blockStyle ? parsePlanningString(field.rawValue) : null;
  if (value === null || value.length === 0) {
    addDiagnostic(context, code, `${block.kind}.${name} must be a non-empty string`, field.span, block.id ?? undefined);
    return null;
  }
  return Object.freeze({ value, span: field.valueSpan });
}

function optionalString(
  context: ParseContext,
  block: PlanningDeclarationBlock,
  name: string,
): string | null {
  const field = singleField(context, block, name, false);
  if (field === null) return null;
  const value = !field.blockStyle ? parsePlanningString(field.rawValue) : null;
  if (value === null) {
    addDiagnostic(context, "PTPOOL-101", `${block.kind}.${name} must be a string`, field.span, block.id ?? undefined);
    return null;
  }
  return value;
}

function optionalDescription(
  context: ParseContext,
  block: PlanningDeclarationBlock,
): PlanningDescriptionSource | null {
  const field = singleField(context, block, "description", false);
  if (field === null) return null;
  const value = parsePlanningDescription(field);
  if (value === null) {
    addDiagnostic(context, "PTPOOL-101", `${block.kind}.description must be non-empty text`, field.span, block.id ?? undefined);
  }
  return value;
}

function referenceBlock(
  context: ParseContext,
  block: PlanningDeclarationBlock,
  name: string,
  code: string,
): readonly PlanningReferenceSource[] {
  const field = singleField(context, block, name, false, code);
  if (field === null) return Object.freeze([]);
  if (!field.blockStyle) {
    addDiagnostic(context, code, `${block.kind}.${name} must be a reference block`, field.span, block.id ?? undefined);
    return Object.freeze([]);
  }
  const result: PlanningReferenceSource[] = [];
  const seen = new Set<string>();
  for (const line of field.children) {
    if (line.text === "" || /^\s*#/u.test(line.text)) continue;
    const match = /^    ([A-Za-z][A-Za-z0-9_-]*)$/u.exec(line.text);
    if (match === null) {
      const diagnosticCode = line.text.includes("::") ? "PTPOOL-102" : code;
      addDiagnostic(context, diagnosticCode, `Invalid ${block.kind}.${name} reference`, sourceLineSpan(line), block.id ?? undefined);
      continue;
    }
    const id = match[1]!;
    const span = sourceSliceSpan(line, 4, 4 + id.length);
    if (seen.has(id)) {
      addDiagnostic(context, code, `Duplicate ${block.kind}.${name} reference ${id}`, span, block.id ?? undefined);
      continue;
    }
    seen.add(id);
    result.push(Object.freeze({ id, qualifiedId: `${context.documentId}::${id}`, span }));
  }
  if (result.length === 0) {
    addDiagnostic(context, code, `${block.kind}.${name} must not be empty`, field.span, block.id ?? undefined);
  }
  return Object.freeze(result);
}

function planningIdentity(
  context: ParseContext,
  block: PlanningDeclarationBlock,
): Readonly<{ id: string; qualifiedId: string; idSpan: SourceSpan }> {
  if (block.id === null || block.idSpan === null) {
    throw new Error("planning entity block lost its identity");
  }
  return Object.freeze({
    id: block.id,
    qualifiedId: `${context.documentId}::${block.id}`,
    idSpan: block.idSpan,
  });
}

function parseWork(
  context: ParseContext,
  block: PlanningDeclarationBlock,
): PlanningWorkSource | null {
  validateFieldSurface(context, block);
  const identity = planningIdentity(context, block);
  const title = requiredString(context, block, "title", "PTPOOL-102");
  if (title === null) return null;
  return Object.freeze({
    kind: "work" as const,
    ...identity,
    title: title.value,
    description: optionalDescription(context, block),
    events: referenceBlock(context, block, "events", "PTPOOL-104"),
    activities: referenceBlock(context, block, "activities", "PTPOOL-104"),
    milestoneLinks: referenceBlock(context, block, "milestone_links", "PTPOOL-104"),
    taskLinks: referenceBlock(context, block, "task_links", "PTPOOL-104"),
    dependsOn: referenceBlock(context, block, "depends_on", "PTPOOL-106"),
    span: block.span,
    titleSpan: title.span,
  });
}

function parseEvent(
  context: ParseContext,
  block: PlanningDeclarationBlock,
): PlanningEventSource | null {
  validateFieldSurface(context, block);
  const identity = planningIdentity(context, block);
  const title = requiredString(context, block, "title", "PTPOOL-102");
  if (title === null) return null;
  const tagsField = singleField(context, block, "tags", false);
  const tags = tagsField === null ? Object.freeze([]) : parsePlanningTags(tagsField.rawValue);
  if (tags === null) {
    addDiagnostic(context, "PTPOOL-101", "event.tags must be a valid tag list", tagsField!.span, block.id!);
  }
  return Object.freeze({
    kind: "event" as const,
    ...identity,
    title: title.value,
    description: optionalDescription(context, block),
    tags: tags ?? Object.freeze([]),
    source: optionalString(context, block, "source"),
    span: block.span,
    titleSpan: title.span,
  });
}

function durationField(
  context: ParseContext,
  block: PlanningDeclarationBlock,
  field: PlanningFieldBlock | null,
): PlanningDurationSource | null {
  if (field === null) return null;
  const value = parsePlanningDuration(field.rawValue, field.valueSpan);
  if (value === null || value.unit !== context.durationUnit) {
    addDiagnostic(context, "PTPOOL-105", "Activity duration must be positive and use the project unit", field.span, block.id!);
    return null;
  }
  return value;
}

function estimateField(
  context: ParseContext,
  block: PlanningDeclarationBlock,
  field: PlanningFieldBlock | null,
): PlanningEstimateSource | null {
  if (field === null) return null;
  if (!field.blockStyle) {
    addDiagnostic(context, "PTPOOL-105", "Activity estimate must be a block", field.span, block.id!);
    return null;
  }
  const values = new Map<string, PlanningDurationSource>();
  for (const line of field.children) {
    if (line.text === "" || /^\s*#/u.test(line.text)) continue;
    const match = /^    (optimistic|most_likely|pessimistic) (\S+)$/u.exec(line.text);
    if (match === null) {
      addDiagnostic(context, "PTPOOL-105", "Invalid Activity estimate entry", sourceLineSpan(line), block.id!);
      continue;
    }
    const name = match[1]!;
    const span = sourceSliceSpan(line, line.text.lastIndexOf(match[2]!), line.text.length);
    const value = parsePlanningDuration(match[2]!, span);
    if (value === null || value.unit !== context.durationUnit || values.has(name)) {
      addDiagnostic(context, "PTPOOL-105", `Invalid or duplicate Activity estimate ${name}`, sourceLineSpan(line), block.id!);
      continue;
    }
    values.set(name, value);
  }
  const optimistic = values.get("optimistic");
  const mostLikely = values.get("most_likely");
  const pessimistic = values.get("pessimistic");
  if (optimistic === undefined || mostLikely === undefined || pessimistic === undefined) {
    addDiagnostic(context, "PTPOOL-105", "Activity estimate requires optimistic, most_likely, and pessimistic", field.span, block.id!);
    return null;
  }
  if (compare(optimistic.value, mostLikely.value) > 0 || compare(mostLikely.value, pessimistic.value) > 0) {
    addDiagnostic(context, "PTPOOL-105", "Activity estimate must be ordered", field.span, block.id!);
    return null;
  }
  return Object.freeze({ optimistic, mostLikely, pessimistic, span: field.span });
}

function requirementsField(
  context: ParseContext,
  block: PlanningDeclarationBlock,
  field: PlanningFieldBlock | null,
): readonly PlanningRequirementSource[] {
  if (field === null) return Object.freeze([]);
  if (!field.blockStyle) {
    addDiagnostic(context, "PTPOOL-105", "Activity requires must be a block", field.span, block.id!);
    return Object.freeze([]);
  }
  const result: PlanningRequirementSource[] = [];
  const seen = new Set<string>();
  for (const line of field.children) {
    if (line.text === "" || /^\s*#/u.test(line.text)) continue;
    const match = /^    ([A-Za-z][A-Za-z0-9_-]*) (\d+)$/u.exec(line.text);
    const units = match === null ? null : parsePlanningInteger(match[2]!);
    if (match === null || units === null || units < 1) {
      addDiagnostic(context, "PTPOOL-105", "Invalid Activity resource requirement", sourceLineSpan(line), block.id!);
      continue;
    }
    const id = match[1]!;
    if (seen.has(id) || context.baseEntities.get(id) !== "resource") {
      addDiagnostic(context, "PTPOOL-105", `Unknown or duplicate Activity resource ${id}`, sourceLineSpan(line), block.id!);
      continue;
    }
    seen.add(id);
    result.push(Object.freeze({
      resourceId: id,
      qualifiedResourceId: `${context.documentId}::${id}`,
      units,
      span: sourceLineSpan(line),
    }));
  }
  if (result.length === 0) {
    addDiagnostic(context, "PTPOOL-105", "Activity requires must not be empty", field.span, block.id!);
  }
  return Object.freeze(result);
}

function whenFields(
  context: ParseContext,
  block: PlanningDeclarationBlock,
): readonly PlanningWhenSource[] {
  const result: PlanningWhenSource[] = [];
  const seen = new Set<string>();
  for (const field of fieldOccurrences(block, "when")) {
    const value = parsePlanningWhen(field.rawValue, field.line);
    const key = value === null ? "" : `${value.event}:${value.direction}`;
    if (value === null || seen.has(key)) {
      addDiagnostic(context, "PTPOOL-105", "Invalid or duplicate Activity when bound", field.span, block.id!);
      continue;
    }
    seen.add(key);
    if (
      context.temporalProfile.kind === "named_zone" &&
      !zoneOffsetMatches(context.temporalProfile.zoneId, value.value)
    ) {
      addDiagnostic(
        context,
        "PTPOOL-105",
        "Activity when offset does not match the project zone or supported range",
        value.value.span,
        block.id!,
      );
    }
    result.push(value);
  }
  for (const event of ["start", "finish"] as const) {
    const earliest = result.find((value) =>
      value.event === event && value.direction === "earliest");
    const latest = result.find((value) =>
      value.event === event && value.direction === "latest");
    if (
      earliest !== undefined &&
      latest !== undefined &&
      compareInstants(earliest.value, latest.value) > 0
    ) {
      addDiagnostic(
        context,
        "PTPOOL-105",
        `Activity earliest ${event} is after latest ${event}`,
        latest.span,
        block.id!,
      );
    }
  }
  return Object.freeze(result);
}

function optionalCalendar(
  context: ParseContext,
  block: PlanningDeclarationBlock,
  name: "deadline" | "start" | "end",
  code: string,
) {
  const field = singleField(context, block, name, false, code);
  if (field === null) return null;
  const value = parseDeclaredCalendarValue(field.rawValue);
  if (value === undefined) {
    addDiagnostic(context, code, `Invalid ${block.kind}.${name}`, field.span, block.id!);
    return null;
  }
  return Object.freeze(value);
}

function activityEffort(
  context: ParseContext,
  block: PlanningDeclarationBlock,
): Readonly<{
  duration: PlanningDurationSource | null;
  estimate: PlanningEstimateSource | null;
}> {
  const durationRaw = singleField(context, block, "duration", false, "PTPOOL-105");
  const estimateRaw = singleField(context, block, "estimate", false, "PTPOOL-105");
  if (durationRaw !== null && estimateRaw !== null) {
    addDiagnostic(
      context,
      "PTPOOL-105",
      "Activity cannot contain both duration and estimate",
      estimateRaw.span,
      block.id!,
    );
  }
  return Object.freeze({
    duration: durationField(context, block, durationRaw),
    estimate: estimateField(context, block, estimateRaw),
  });
}

function activityPriority(
  context: ParseContext,
  block: PlanningDeclarationBlock,
): number | null {
  const field = singleField(context, block, "priority", false, "PTPOOL-105");
  if (field === null) return null;
  const value = parsePlanningInteger(field.rawValue);
  if (value === null) {
    addDiagnostic(context, "PTPOOL-105", "Invalid Activity priority", field.span, block.id!);
  }
  return value;
}

function activityTags(
  context: ParseContext,
  block: PlanningDeclarationBlock,
): readonly string[] {
  const field = singleField(context, block, "tags", false, "PTPOOL-105");
  if (field === null) return Object.freeze([]);
  const value = parsePlanningTags(field.rawValue);
  if (value === null) {
    addDiagnostic(context, "PTPOOL-105", "Invalid Activity tags", field.span, block.id!);
    return Object.freeze([]);
  }
  return value;
}

function activityCalendarId(
  context: ParseContext,
  block: PlanningDeclarationBlock,
): string | null {
  const field = singleField(context, block, "calendar", false, "PTPOOL-105");
  if (field === null) return null;
  if (context.baseEntities.get(field.rawValue) !== "calendar") {
    addDiagnostic(
      context,
      "PTPOOL-105",
      `Unknown Activity calendar ${field.rawValue}`,
      field.span,
      block.id!,
    );
  }
  return field.rawValue;
}

function parseActivity(
  context: ParseContext,
  block: PlanningDeclarationBlock,
): PlanningActivitySource | null {
  validateFieldSurface(context, block);
  const identity = planningIdentity(context, block);
  const title = requiredString(context, block, "title", "PTPOOL-102");
  const effort = activityEffort(context, block);
  const fromSpan = block.fromSpan;
  const toSpan = block.toSpan;
  if (title === null || block.from === null || block.to === null || fromSpan === null || toSpan === null) return null;
  return Object.freeze({
    kind: "activity" as const,
    ...identity,
    from: Object.freeze({ id: block.from, qualifiedId: `${context.documentId}::${block.from}`, span: fromSpan }),
    to: Object.freeze({ id: block.to, qualifiedId: `${context.documentId}::${block.to}`, span: toSpan }),
    title: title.value,
    description: optionalDescription(context, block),
    ...effort,
    priority: activityPriority(context, block),
    requirements: requirementsField(context, block, singleField(context, block, "requires", false, "PTPOOL-105")),
    owner: optionalString(context, block, "owner"),
    tags: activityTags(context, block),
    source: optionalString(context, block, "source"),
    calendarId: activityCalendarId(context, block),
    when: whenFields(context, block),
    deadline: optionalCalendar(context, block, "deadline", "PTPOOL-105"),
    span: block.span,
    titleSpan: title.span,
  });
}

function parseWindow(
  context: ParseContext,
  block: PlanningDeclarationBlock,
): PlanningWindowSource | null {
  validateFieldSurface(context, block);
  const identity = planningIdentity(context, block);
  const title = requiredString(context, block, "title", "PTPOOL-102");
  const objective = requiredString(context, block, "objective", "PTPOOL-107");
  const start = optionalCalendar(context, block, "start", "PTPOOL-107");
  const end = optionalCalendar(context, block, "end", "PTPOOL-107");
  if (start !== null && end !== null) {
    const comparison = comparePlanningCalendarValues(start, end);
    if (comparison === null || comparison >= 0) {
      addDiagnostic(context, "PTPOOL-107", "Window bounds must have one kind and satisfy start < end", block.span, block.id!);
    }
  }
  const works = referenceBlock(context, block, "works", "PTPOOL-107");
  if (fieldOccurrences(block, "works").length === 0) {
    addDiagnostic(context, "PTPOOL-107", `Window ${block.id} requires works`, block.idSpan!, block.id!);
  }
  if (title === null || objective === null) return null;
  return Object.freeze({
    kind: "window" as const,
    ...identity,
    title: title.value,
    objective: objective.value,
    start,
    end,
    works,
    span: block.span,
    titleSpan: title.span,
    objectiveSpan: objective.span,
  });
}

function workOrder(
  context: ParseContext,
  block: PlanningDeclarationBlock | undefined,
): readonly PlanningReferenceSource[] {
  if (block === undefined) return Object.freeze([]);
  const result: PlanningReferenceSource[] = [];
  const seen = new Set<string>();
  for (const line of block.lines) {
    if (line.text === "" || /^\s*#/u.test(line.text)) continue;
    const match = /^  ([A-Za-z][A-Za-z0-9_-]*)$/u.exec(line.text);
    if (match === null) {
      const diagnosticCode = line.text.includes("::") ? "PTPOOL-102" : "PTPOOL-103";
      addDiagnostic(context, diagnosticCode, "Invalid work_order entry", sourceLineSpan(line));
      continue;
    }
    const id = match[1]!;
    const span = sourceSliceSpan(line, 2, 2 + id.length);
    if (seen.has(id)) {
      addDiagnostic(context, "PTPOOL-103", `Duplicate work_order entry ${id}`, span, id);
      continue;
    }
    seen.add(id);
    result.push(Object.freeze({ id, qualifiedId: `${context.documentId}::${id}`, span }));
  }
  return Object.freeze(result);
}

function baseEntityKind(header: string): EntityKind | null {
  if (/^(?:\uFEFF)?project /u.test(header)) return "project";
  if (/^calendar /u.test(header)) return "calendar";
  if (/^resource /u.test(header)) return "resource";
  if (/^milestone /u.test(header)) return "milestone";
  if (/^task /u.test(header)) return "task";
  if (/^gate /u.test(header)) return "gate";
  return /^[a-z_]+ /u.test(header) ? "other" : null;
}

function baseEntityMap(
  text: string,
  planningBlocks: readonly PlanningDeclarationBlock[],
): ReadonlyMap<string, EntityKind> {
  const planningStarts = new Set(planningBlocks.map(({ header }) => header.start));
  const result = new Map<string, EntityKind>();
  for (const line of splitTemporalSourceLines(text)) {
    if (planningStarts.has(line.start) || /^\s/u.test(line.text)) continue;
    const kind = baseEntityKind(line.text);
    const match = /^(?:\uFEFF)?[a-z_]+ ([A-Za-z][A-Za-z0-9_-]*)/u.exec(line.text);
    if (kind !== null && match !== null && !result.has(match[1]!)) result.set(match[1]!, kind);
  }
  return result;
}

function projectDurationUnit(text: string): "day" | "hour" | "point" {
  const project = scanTemporalDeclarationBlocks(text).find(({ kind }) => kind === "project");
  const value = project?.lines.map(fieldLine).find((field) => field?.name === "duration_unit")?.rawValue;
  if (value !== "day" && value !== "hour" && value !== "point") {
    throw new Error("validated Grammar 8 base lost project duration unit");
  }
  return value;
}

function validateIdentitySurface(
  context: ParseContext,
  entities: readonly (PlanningWorkSource | PlanningEventSource | PlanningActivitySource | PlanningWindowSource)[],
): void {
  const seen = new Map<string, SourceSpan>();
  for (const entity of entities) {
    if (context.baseEntities.has(entity.id) || seen.has(entity.id)) {
      addDiagnostic(context, "PTPOOL-102", `Planning identity ${entity.id} is duplicated`, entity.idSpan, entity.id);
    } else {
      seen.set(entity.id, entity.idSpan);
    }
  }
}

interface PlanningReferenceIndex {
  readonly workIds: ReadonlySet<string>;
  readonly eventIds: ReadonlySet<string>;
  readonly activityIds: ReadonlySet<string>;
  readonly eventConsumers: Map<string, number>;
  readonly activityConsumers: Map<string, number>;
}

function planningReferenceIndex(
  works: readonly PlanningWorkSource[],
  events: readonly PlanningEventSource[],
  activities: readonly PlanningActivitySource[],
): PlanningReferenceIndex {
  return Object.freeze({
    workIds: new Set(works.map(({ id }) => id)),
    eventIds: new Set(events.map(({ id }) => id)),
    activityIds: new Set(activities.map(({ id }) => id)),
    eventConsumers: new Map(events.map(({ id }) => [id, 0])),
    activityConsumers: new Map(activities.map(({ id }) => [id, 0])),
  });
}

function validateKnownReferences(
  context: ParseContext,
  references: readonly PlanningReferenceSource[],
  ids: ReadonlySet<string>,
  code: string,
  owner: string,
): void {
  for (const reference of references) {
    if (!ids.has(reference.id)) {
      addDiagnostic(
        context,
        code,
        `${owner} references unknown ${reference.id}`,
        reference.span,
        owner,
      );
    }
  }
}

function countConsumers(
  references: readonly PlanningReferenceSource[],
  consumers: Map<string, number>,
): void {
  for (const reference of references) {
    consumers.set(reference.id, (consumers.get(reference.id) ?? 0) + 1);
  }
}

function validateWorkReferences(
  context: ParseContext,
  works: readonly PlanningWorkSource[],
  index: PlanningReferenceIndex,
): void {
  for (const work of works) {
    validateKnownReferences(context, work.events, index.eventIds, "PTPOOL-104", work.id);
    validateKnownReferences(context, work.activities, index.activityIds, "PTPOOL-104", work.id);
    validateKnownReferences(context, work.dependsOn, index.workIds, "PTPOOL-106", work.id);
    countConsumers(work.events, index.eventConsumers);
    countConsumers(work.activities, index.activityConsumers);
    for (const reference of work.milestoneLinks) {
      if (context.baseEntities.get(reference.id) !== "milestone") {
        addDiagnostic(context, "PTPOOL-104", `Work ${work.id} links unknown Milestone ${reference.id}`, reference.span, work.id);
      }
    }
    for (const reference of work.taskLinks) {
      if (context.baseEntities.get(reference.id) !== "task") {
        addDiagnostic(context, "PTPOOL-104", `Work ${work.id} links unknown Task ${reference.id}`, reference.span, work.id);
      }
    }
    for (const reference of work.dependsOn) {
      if (reference.id === work.id) {
        addDiagnostic(context, "PTPOOL-106", `Work ${work.id} cannot depend on itself`, reference.span, work.id);
      }
    }
  }
}

function validatePlanningConsumers(
  context: ParseContext,
  events: readonly PlanningEventSource[],
  activities: readonly PlanningActivitySource[],
  index: PlanningReferenceIndex,
): void {
  for (const event of events) {
    if ((index.eventConsumers.get(event.id) ?? 0) === 0) {
      addDiagnostic(context, "PTPOOL-104", `Event ${event.id} has no Work association`, event.idSpan, event.id);
    }
  }
  for (const activity of activities) {
    if ((index.activityConsumers.get(activity.id) ?? 0) === 0) {
      addDiagnostic(context, "PTPOOL-104", `Activity ${activity.id} has no Work association`, activity.idSpan, activity.id);
    }
    for (const endpoint of [activity.from, activity.to]) {
      if (!index.eventIds.has(endpoint.id) && context.baseEntities.get(endpoint.id) !== "milestone") {
        addDiagnostic(context, "PTPOOL-105", `Activity ${activity.id} endpoint ${endpoint.id} is not an Event or Milestone`, endpoint.span, activity.id);
      }
    }
  }
}

function validateReferences(
  context: ParseContext,
  works: readonly PlanningWorkSource[],
  events: readonly PlanningEventSource[],
  activities: readonly PlanningActivitySource[],
  windows: readonly PlanningWindowSource[],
): void {
  const index = planningReferenceIndex(works, events, activities);
  validateWorkReferences(context, works, index);
  validatePlanningConsumers(context, events, activities, index);
  for (const window of windows) {
    validateKnownReferences(context, window.works, index.workIds, "PTPOOL-107", window.id);
  }
}

function validateOrder(
  context: ParseContext,
  works: readonly PlanningWorkSource[],
  orders: readonly PlanningDeclarationBlock[],
  order: readonly PlanningReferenceSource[],
): void {
  if ((works.length === 0 && orders.length > 0) || (works.length > 0 && orders.length !== 1)) {
    const target = orders[0]?.span ?? works[0]?.span ?? sourceLineSpan(splitTemporalSourceLines(context.text)[0]!);
    addDiagnostic(context, "PTPOOL-103", "Work requires exactly one work_order and an empty pool forbids it", target);
    return;
  }
  const workIds = new Set(works.map(({ id }) => id));
  const orderIds = new Set(order.map(({ id }) => id));
  for (const entry of order) {
    if (!workIds.has(entry.id)) addDiagnostic(context, "PTPOOL-103", `work_order references unknown Work ${entry.id}`, entry.span, entry.id);
  }
  for (const work of works) {
    if (!orderIds.has(work.id)) addDiagnostic(context, "PTPOOL-103", `work_order is missing Work ${work.id}`, work.idSpan, work.id);
  }
}

function planningFinishOrder(
  ids: readonly string[],
  edges: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  const visited = new Set<string>();
  const finish: string[] = [];
  for (const root of ids) {
    if (visited.has(root)) continue;
    const stack: Array<Readonly<{ id: string; expanded: boolean }>> = [{ id: root, expanded: false }];
    while (stack.length > 0) {
      const item = stack.pop()!;
      if (item.expanded) {
        finish.push(item.id);
        continue;
      }
      if (visited.has(item.id)) continue;
      visited.add(item.id);
      stack.push({ id: item.id, expanded: true });
      for (const next of [...(edges.get(item.id) ?? [])].reverse()) {
        if (!visited.has(next)) stack.push({ id: next, expanded: false });
      }
    }
  }
  return Object.freeze(finish);
}

function planningStrongComponents(
  finish: readonly string[],
  reverse: ReadonlyMap<string, readonly string[]>,
): readonly (readonly string[])[] {
  const assigned = new Set<string>();
  const components: string[][] = [];
  for (const root of [...finish].reverse()) {
    if (assigned.has(root)) continue;
    const component: string[] = [];
    const stack = [root];
    assigned.add(root);
    while (stack.length > 0) {
      const id = stack.pop()!;
      component.push(id);
      for (const next of reverse.get(id) ?? []) {
        if (!assigned.has(next)) {
          assigned.add(next);
          stack.push(next);
        }
      }
    }
    components.push(component);
  }
  return Object.freeze(components.map((component) => Object.freeze(component)));
}

function dependencyCycles(works: readonly PlanningWorkSource[]): readonly (readonly string[])[] {
  const ids = works.map(({ id }) => id);
  const known = new Set(ids);
  const edges = new Map(works.map((work) => [
    work.id,
    work.dependsOn.map(({ id }) => id).filter((id) => known.has(id) && id !== work.id),
  ]));
  const reverse = new Map(ids.map((id) => [id, [] as string[]]));
  for (const [from, targets] of edges) {
    for (const to of targets) reverse.get(to)!.push(from);
  }
  const rank = new Map(ids.map((id, index) => [id, index]));
  const cycles = planningStrongComponents(planningFinishOrder(ids, edges), reverse)
    .filter((component) => component.length > 1)
    .map((component) => [...component].sort((left, right) => rank.get(left)! - rank.get(right)!));
  return Object.freeze(cycles.sort((left, right) => rank.get(left[0]!)! - rank.get(right[0]!)!)
    .map((cycle) => Object.freeze(cycle)));
}

function validateLimits(
  context: ParseContext,
  parsed: Omit<ParsedPlanning, "dependencyCycles">,
): void {
  const associations = parsed.works.reduce((sum, work) =>
    sum + work.events.length + work.activities.length + work.milestoneLinks.length + work.taskLinks.length, 0);
  const dependencies = parsed.works.reduce((sum, work) => sum + work.dependsOn.length, 0);
  const memberships = parsed.windows.reduce((sum, window) => sum + window.works.length, 0);
  const limits = [
    [parsed.works.length, PLANNING_POOL_SOURCE_LIMITS.works, "Work"],
    [parsed.events.length, PLANNING_POOL_SOURCE_LIMITS.events, "Event"],
    [parsed.activities.length, PLANNING_POOL_SOURCE_LIMITS.activities, "Activity"],
    [associations, PLANNING_POOL_SOURCE_LIMITS.associationsPlusProjectionLinks, "association and projection link"],
    [dependencies, PLANNING_POOL_SOURCE_LIMITS.workDependencies, "Work dependency"],
    [parsed.windows.length, PLANNING_POOL_SOURCE_LIMITS.persistedWindows, "Window"],
    [memberships, PLANNING_POOL_SOURCE_LIMITS.persistedWindowMemberships, "Window membership"],
  ] as const;
  for (const [actual, maximum, label] of limits) {
    if (actual > maximum) addDiagnostic(context, "PTPOOL-115", `${label} count ${actual} exceeds ${maximum}`, context.blocks.at(-1)?.span ?? context.blocks[0]!.span);
  }
}

function planningStructureLimitDiagnostics(
  blocks: readonly PlanningDeclarationBlock[],
): readonly Diagnostic[] {
  const works = blocks.filter(({ kind }) => kind === "work");
  const events = blocks.filter(({ kind }) => kind === "event");
  const activities = blocks.filter(({ kind }) => kind === "activity");
  const windows = blocks.filter(({ kind }) => kind === "window");
  const associations = works.reduce((sum, block) =>
    sum + referenceEntryCount(block, associationFieldNames), 0);
  const dependencies = works.reduce((sum, block) =>
    sum + referenceEntryCount(block, dependencyFieldNames), 0);
  const memberships = windows.reduce((sum, block) =>
    sum + referenceEntryCount(block, windowMembershipFieldNames), 0);
  const counts = [
    [works.length, PLANNING_POOL_SOURCE_LIMITS.works, "Work"],
    [events.length, PLANNING_POOL_SOURCE_LIMITS.events, "Event"],
    [activities.length, PLANNING_POOL_SOURCE_LIMITS.activities, "Activity"],
    [associations, PLANNING_POOL_SOURCE_LIMITS.associationsPlusProjectionLinks, "association and projection link"],
    [dependencies, PLANNING_POOL_SOURCE_LIMITS.workDependencies, "Work dependency"],
    [windows.length, PLANNING_POOL_SOURCE_LIMITS.persistedWindows, "Window"],
    [memberships, PLANNING_POOL_SOURCE_LIMITS.persistedWindowMemberships, "Window membership"],
  ] as const;
  const target = blocks.at(-1)?.span ?? blocks[0]?.span;
  if (target === undefined) return Object.freeze([]);
  return Object.freeze(counts.flatMap(([actual, maximum, label]) =>
    actual > maximum
      ? [diagnostic("PTPOOL-115", `${label} count ${actual} exceeds ${maximum}`, target)]
      : []));
}

function parsePlanning(context: ParseContext): ParsedPlanning {
  const works = context.blocks.filter(({ kind }) => kind === "work")
    .map((block) => parseWork(context, block)).filter((value): value is PlanningWorkSource => value !== null);
  const events = context.blocks.filter(({ kind }) => kind === "event")
    .map((block) => parseEvent(context, block)).filter((value): value is PlanningEventSource => value !== null);
  const activities = context.blocks.filter(({ kind }) => kind === "activity")
    .map((block) => parseActivity(context, block)).filter((value): value is PlanningActivitySource => value !== null);
  const windows = context.blocks.filter(({ kind }) => kind === "window")
    .map((block) => parseWindow(context, block)).filter((value): value is PlanningWindowSource => value !== null);
  const orders = context.blocks.filter(({ kind }) => kind === "work_order");
  const order = workOrder(context, orders[0]);
  validateIdentitySurface(context, [...works, ...events, ...activities, ...windows]);
  validateReferences(context, works, events, activities, windows);
  validateOrder(context, works, orders, order);
  const partial = { works, events, activities, windows, workOrder: order };
  validateLimits(context, partial);
  return Object.freeze({ ...partial, dependencyCycles: dependencyCycles(works) });
}

function result(
  grammarVersion: number | null,
  documentId: string | null,
  model: PlanningPoolSourceModel | null,
  diagnostics: readonly Diagnostic[],
  maximum: number,
  inheritedTruncation = false,
): PlanningPoolSourceResult {
  return sourceValidationResult<PlanningPoolSourceModel, PlanningPoolSourceDiagnostic>(
    grammarVersion,
    documentId,
    model,
    diagnostics,
    maximum,
    inheritedTruncation,
  );
}

function legacyResult(
  text: string,
  grammarVersion: number,
  maximum: number,
): PlanningPoolSourceResult {
  const base = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY, { maxDiagnostics: maximum });
  return Object.freeze({
    ok: base.ok,
    grammarVersion: Number.isSafeInteger(grammarVersion) ? grammarVersion : null,
    documentId: base.documentId,
    model: null,
    diagnostics: base.diagnostics,
    diagnosticCounts: base.diagnosticCounts,
    diagnosticsTruncated: base.diagnosticsTruncated,
  });
}

export function parsePlanningPoolSource(
  text: string,
  capability: PlanningPoolSourceCapability,
  options: Readonly<{ maxDiagnostics?: number }> = {},
): PlanningPoolSourceResult {
  if (capability !== PLANNING_POOL_SOURCE_CAPABILITY) {
    throw new TypeError("the target Grammar 9 planning-pool source capability is required");
  }
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const grammarVersion = declaredPlanningGrammarVersion(text);
  if (!Number.isSafeInteger(grammarVersion) || grammarVersion < 1 || grammarVersion > 9) {
    const legacy = legacyResult(text, grammarVersion, maximum);
    const target = splitTemporalSourceLines(text)[0];
    return target === undefined ? legacy : result(
      null,
      legacy.documentId,
      null,
      [
        ...(legacy.diagnostics as readonly Diagnostic[]),
        diagnostic("PTPOOL-116", "Planning Pool source requires Grammar 1 through 9", sourceLineSpan(target)),
      ],
      maximum,
      legacy.diagnosticsTruncated,
    );
  }
  if (grammarVersion < 9) return legacyResult(text, grammarVersion, maximum);
  if (
    new TextEncoder().encode(text).byteLength >
    PLANNING_POOL_SOURCE_LIMITS.sourceOrCandidateUtf8Bytes
  ) {
    const target = splitTemporalSourceLines(text)[0];
    return result(
      9,
      null,
      null,
      target === undefined
        ? []
        : [diagnostic("PTPOOL-115", "Planning Pool source exceeds the byte limit", sourceLineSpan(target))],
      maximum,
    );
  }
  const blocks = scanPlanningDeclarationBlocks(text);
  const structureLimitDiagnostics = planningStructureLimitDiagnostics(blocks);
  if (structureLimitDiagnostics.length > 0) {
    return result(9, null, null, structureLimitDiagnostics, maximum);
  }
  const baseText = planningPoolBaseText(text, blocks);
  const base = parseTemporalScheduleSource(baseText, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY, { maxDiagnostics: 1_000 });
  const diagnostics: Diagnostic[] = [...(base.diagnostics as readonly Diagnostic[])];
  for (const line of malformedPlanningHeaderLines(text, blocks)) {
    const code = line.text.includes("::") ? "PTPOOL-102" : "PTPOOL-101";
    diagnostics.push(diagnostic(code, "Invalid Grammar 9 planning declaration header", sourceLineSpan(line)));
  }
  if (!base.ok || base.model === null || base.documentId === null) {
    return result(9, base.documentId, null, diagnostics, maximum, base.diagnosticsTruncated);
  }
  const context: ParseContext = {
    text,
    documentId: base.documentId,
    blocks,
    diagnostics,
    baseEntities: baseEntityMap(text, blocks),
    durationUnit: projectDurationUnit(text),
    temporalProfile: base.model.profile,
  };
  const parsed = parsePlanning(context);
  const model: PlanningPoolSourceModel = Object.freeze({
    schemaVersion: "Perttool.PlanningPoolModel.v1",
    modelVersion: PLANNING_POOL_SOURCE_MODEL_VERSION,
    grammarVersion: 9,
    documentId: base.documentId,
    qualifiedNamespace: base.documentId,
    base: base.model,
    ...parsed,
  });
  return result(9, base.documentId, model, diagnostics, maximum, base.diagnosticsTruncated);
}

export function planningPoolSourceModel(
  source: PlanningPoolSourceResult,
): PlanningPoolSourceModel {
  if (!source.ok || source.model === null) {
    throw new TypeError("a valid Grammar 9 planning-pool source result is required");
  }
  return source.model;
}

function referenceEntryCount(
  block: PlanningDeclarationBlock,
  names: ReadonlySet<string>,
): number {
  let count = 0;
  for (const field of planningFields(block)) {
    if (!names.has(field.name)) continue;
    for (const line of field.children) {
      if (line.text !== "" && !/^\s*#/u.test(line.text)) count += 1;
    }
  }
  return count;
}
