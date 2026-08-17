import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  milestoneAcceptanceBaseText,
  parseMilestoneAcceptanceSource,
} from "../milestone-acceptance/source.js";
import {
  countDiagnostics,
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
  type Diagnostic,
  type SourceSpan,
} from "../model/diagnostics.js";
import { compare, type Rational } from "../model/rational.js";
import { fieldNamed, type DeclarationNode } from "../model/syntax.js";
import {
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../parser/document-parser.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";
import {
  declaredTemporalGrammarVersion,
  fieldLine,
  scanTemporalDeclarationBlocks,
  sourceLineSpan,
  sourceSliceSpan,
  temporalScheduleBaseText,
  type TemporalDeclarationBlock,
  type TemporalSourceLine,
} from "./source-lexical.js";
import type {
  AvailabilityOverrideSource,
  BoundDirection,
  CalendarDaySource,
  CalendarExceptionSource,
  CalendarSourceModel,
  EventBoundSource,
  NamedZoneProfileSource,
  ResourceAvailabilitySource,
  TemporalCalendarProfileSource,
  TemporalInstantSource,
  TemporalScheduleSourceCapability,
  TemporalScheduleSourceModel,
  TemporalScheduleSourceResult,
  TemporalSourceDiagnostic,
  Weekday,
} from "./source-types.js";
import {
  compareInstants,
  knownZone,
  parseCalendarWindows,
  parsePositiveWorkday,
  parseQuotedString,
  parseTemporalInstant,
  TEMPORAL_TZDB_RELEASE,
  validIsoDate,
  zoneOffsetMatches,
} from "./source-values.js";

export const TEMPORAL_SCHEDULE_SOURCE_MODEL_VERSION = 1 as const;

export const TEMPORAL_SCHEDULE_SOURCE_CAPABILITY:
  TemporalScheduleSourceCapability = Object.freeze({
    id: "perttool.target-grammar-8-temporal-schedule-source",
    version: 1,
    grammarVersion: 8,
  });

export const TEMPORAL_SCHEDULE_SOURCE_LIMITS = Object.freeze({
  calendars: 256,
  weeklyWindowsPerCalendar: 64,
  exceptionsPerCalendar: 4_096,
  availabilityOverridesPerResource: 4_096,
  aggregateChangeInstants: 100_000,
});

interface ParseContext {
  readonly text: string;
  readonly blocks: readonly TemporalDeclarationBlock[];
  readonly baseDocument: readonly DeclarationNode[];
  readonly reservedIds: readonly string[];
  readonly diagnostics: Diagnostic[];
}

interface ParsedProject {
  readonly profile: TemporalCalendarProfileSource | null;
  readonly hasNamedFields: boolean;
}

type OwnedField = ReturnType<typeof fields>[number];
interface ProjectOwnedFields {
  readonly block: TemporalDeclarationBlock | undefined;
  readonly zone: OwnedField | null;
  readonly tzdb: OwnedField | null;
  readonly calendar: OwnedField | null;
  readonly workday: OwnedField | null;
}

const weekdays: readonly Weekday[] = Object.freeze([
  "mon", "tue", "wed", "thu", "fri", "sat", "sun",
]);
const weekdayRank = new Map(weekdays.map((value, index) => [value, index]));

function diagnostic(
  code: string,
  message: string,
  target: SourceSpan,
  entityId?: string,
): Diagnostic {
  return Object.freeze({
    code,
    severity: "error" as const,
    message,
    span: target,
    ...(entityId === undefined ? {} : { entityId }),
    helpTopic: "syntax",
    data: Object.freeze({}),
  });
}

function addDiagnostic(
  context: ParseContext,
  code: string,
  message: string,
  lineOrSpan: TemporalSourceLine | SourceSpan,
  entityId?: string,
): void {
  const target = "text" in lineOrSpan ? sourceLineSpan(lineOrSpan) : lineOrSpan;
  context.diagnostics.push(diagnostic(code, message, target, entityId));
}

function fields(
  block: TemporalDeclarationBlock | undefined,
  name: string,
): readonly Readonly<{
  line: TemporalSourceLine;
  rawValue: string;
  valueColumn: number;
}>[] {
  if (block === undefined) return Object.freeze([]);
  return Object.freeze(block.lines.flatMap((line) => {
    const field = fieldLine(line);
    return field?.name === name
      ? [{ line, rawValue: field.rawValue, valueColumn: field.valueColumn }]
      : [];
  }));
}

function singleField(
  context: ParseContext,
  block: TemporalDeclarationBlock | undefined,
  name: string,
  code: string,
): ReturnType<typeof fields>[number] | null {
  const occurrences = fields(block, name);
  if (occurrences.length > 1) {
    addDiagnostic(
      context,
      code,
      `Duplicate ${block?.kind ?? "declaration"}.${name}`,
      occurrences[1]!.line,
      block?.id,
    );
  }
  return occurrences[0] ?? null;
}

function parseCalendar(
  context: ParseContext,
  block: TemporalDeclarationBlock,
): CalendarSourceModel {
  const days: CalendarDaySource[] = [];
  const exceptions: CalendarExceptionSource[] = [];
  for (const line of block.lines) {
    const entry = calendarEntry(context, block, line);
    if (entry === null) continue;
    if ("weekday" in entry) days.push(entry);
    else exceptions.push(entry);
  }
  const seenDays = new Set<Weekday>();
  for (const day of days) {
    if (seenDays.has(day.weekday)) {
      addDiagnostic(context, "PTSCH-103", `Duplicate weekday ${day.weekday}`, day.span, block.id);
    }
    seenDays.add(day.weekday);
  }
  const seenDates = new Set<string>();
  for (const exception of exceptions) {
    if (seenDates.has(exception.date)) {
      addDiagnostic(context, "PTSCH-103", `Duplicate exception ${exception.date}`, exception.span, block.id);
    }
    seenDates.add(exception.date);
  }
  const weeklyWindowCount = days.reduce((sum, day) => sum + day.windows.length, 0);
  if (weeklyWindowCount > TEMPORAL_SCHEDULE_SOURCE_LIMITS.weeklyWindowsPerCalendar) {
    addDiagnostic(context, "PTSCH-109", `Calendar ${block.id} exceeds the weekly-window limit`, block.span, block.id);
  }
  if (exceptions.length > TEMPORAL_SCHEDULE_SOURCE_LIMITS.exceptionsPerCalendar) {
    addDiagnostic(context, "PTSCH-109", `Calendar ${block.id} exceeds the exception limit`, block.span, block.id);
  }
  return Object.freeze({
    id: block.id,
    span: block.span,
    idSpan: block.idSpan,
    weekdays: Object.freeze([...days].sort((left, right) =>
      weekdayRank.get(left.weekday)! - weekdayRank.get(right.weekday)!)),
    exceptions: Object.freeze([...exceptions].sort((left, right) =>
      left.date.localeCompare(right.date, "en"))),
  });
}

function parseCalendars(context: ParseContext): readonly CalendarSourceModel[] {
  const blocks = context.blocks.filter(({ kind }) => kind === "calendar");
  if (blocks.length > TEMPORAL_SCHEDULE_SOURCE_LIMITS.calendars) {
    addDiagnostic(context, "PTSCH-109", "Document exceeds the calendar limit", blocks.at(-1)!.span);
  }
  const existing = new Set([
    ...context.baseDocument.map(({ id }) => id),
    ...context.reservedIds,
  ]);
  const seen = new Set<string>();
  for (const block of blocks) {
    if (seen.has(block.id) || existing.has(block.id)) {
      addDiagnostic(context, "PTSCH-102", `Duplicate calendar identity ${block.id}`, block.idSpan, block.id);
    }
    seen.add(block.id);
  }
  return Object.freeze(blocks.map((block) => parseCalendar(context, block)));
}

function parsedStringField(
  context: ParseContext,
  field: ReturnType<typeof fields>[number] | null,
  code: string,
  label: string,
): string | null {
  if (field === null) return null;
  const value = parseQuotedString(field.rawValue);
  if (value === null) addDiagnostic(context, code, `Invalid ${label}`, field.line);
  return value;
}

function projectFieldValue(
  declaration: DeclarationNode | undefined,
  name: string,
): unknown {
  return declaration === undefined ? undefined : fieldNamed(declaration, name)?.value;
}

function needsWorkday(project: DeclarationNode | undefined): boolean {
  if (projectFieldValue(project, "duration_unit") === "day") return true;
  const velocity = projectFieldValue(project, "velocity");
  return typeof velocity === "object" && velocity !== null &&
    "period" in velocity &&
    (velocity as { readonly period?: { readonly suffix?: string } }).period?.suffix === "d";
}

function projectOwnedFields(context: ParseContext): ProjectOwnedFields {
  const block = context.blocks.find(({ kind }) => kind === "project");
  return Object.freeze({
    block,
    zone: singleField(context, block, "time_zone", "PTSCH-101"),
    tzdb: singleField(context, block, "tzdb", "PTSCH-101"),
    calendar: singleField(context, block, "calendar", "PTSCH-101"),
    workday: singleField(context, block, "workday", "PTSCH-101"),
  });
}

function continuousProject(
  context: ParseContext,
  calendars: readonly CalendarSourceModel[],
  owned: ProjectOwnedFields,
): ParsedProject {
  if (owned.workday !== null) {
    addDiagnostic(context, "PTSCH-101", "Project workday requires a named-zone profile", owned.workday.line);
  }
  if (calendars.length > 0) {
    addDiagnostic(context, "PTSCH-101", "Calendar declarations require a named-zone profile", calendars[0]!.span);
  }
  return {
    profile: Object.freeze({ kind: "continuous_fixed_offset" }),
    hasNamedFields: false,
  };
}

function namedProject(
  context: ParseContext,
  calendars: readonly CalendarSourceModel[],
  owned: ProjectOwnedFields,
): ParsedProject {
  const zoneId = parsedStringField(context, owned.zone, "PTSCH-105", "project time zone");
  const tzdb = parsedStringField(context, owned.tzdb, "PTSCH-105", "project tzdb release");
  const calendarId = owned.calendar!.rawValue;
  if (tzdb !== TEMPORAL_TZDB_RELEASE) {
    addDiagnostic(context, "PTSCH-105", `Project tzdb must be ${TEMPORAL_TZDB_RELEASE}`, owned.tzdb!.line);
  }
  if (zoneId !== null && !knownZone(zoneId)) {
    addDiagnostic(context, "PTSCH-105", `Unknown IANA time zone ${zoneId}`, owned.zone!.line);
  }
  if (!calendars.some(({ id }) => id === calendarId)) {
    addDiagnostic(context, "PTSCH-102", `Unknown project calendar ${calendarId}`, owned.calendar!.line);
  }
  const workday = owned.workday === null ? null : parsePositiveWorkday(owned.workday.rawValue);
  if (owned.workday !== null && workday === null) {
    addDiagnostic(context, "PTSCH-101", "Project workday must be an exact positive hour duration", owned.workday.line);
  }
  const project = context.baseDocument.find(({ kind }) => kind === "project");
  if (needsWorkday(project) && workday === null) {
    addDiagnostic(context, "PTSCH-101", "Calendar day work requires project workday", owned.block!.span);
  }
  const profile: NamedZoneProfileSource | null = zoneId === null || tzdb !== TEMPORAL_TZDB_RELEASE
    ? null
    : Object.freeze({ kind: "named_zone", zoneId, tzdbRelease: TEMPORAL_TZDB_RELEASE, calendarId, workdayHours: workday });
  return { profile, hasNamedFields: true };
}

function parseProject(
  context: ParseContext,
  calendars: readonly CalendarSourceModel[],
): ParsedProject {
  const owned = projectOwnedFields(context);
  const profileCount = [owned.zone, owned.tzdb, owned.calendar].filter(Boolean).length;
  if (profileCount !== 0 && profileCount !== 3) {
    addDiagnostic(context, "PTSCH-101", "Project calendar profile fields are all-or-none", owned.block?.span ?? sourceLineSpan(context.blocks[0]!.header));
    return { profile: null, hasNamedFields: true };
  }
  return profileCount === 0
    ? continuousProject(context, calendars, owned)
    : namedProject(context, calendars, owned);
}

function instantField(
  context: ParseContext,
  field: ReturnType<typeof fields>[number] | null,
  code: string,
): TemporalInstantSource | null {
  if (field === null) return null;
  const value = parseTemporalInstant(field.rawValue, field.line, field.valueColumn);
  if (value === null) addDiagnostic(context, code, "Invalid offset-bearing date-time", field.line);
  return value;
}

function validateZoneInstant(
  context: ParseContext,
  zoneId: string,
  value: TemporalInstantSource | null,
  entityId?: string,
): void {
  if (value !== null && !zoneOffsetMatches(zoneId, value)) {
    addDiagnostic(context, "PTSCH-105", "Date-time offset does not match the project zone or supported range", value.span, entityId);
  }
}

function parseAvailabilityOverride(
  context: ParseContext,
  block: TemporalDeclarationBlock,
  field: ReturnType<typeof fields>[number],
  nominalCapacity: number,
): AvailabilityOverrideSource | null {
  const match = /^(\S+)\.\.(\S+) capacity (\d+)$/u.exec(field.rawValue);
  if (match === null) {
    addDiagnostic(context, "PTSCH-104", "Invalid availability override", field.line, block.id);
    return null;
  }
  const start = parseTemporalInstant(match[1]!, field.line, field.valueColumn);
  const endColumn = field.valueColumn + match[1]!.length + 2;
  const end = parseTemporalInstant(match[2]!, field.line, endColumn);
  const capacity = Number(match[3]);
  if (
    start === null || end === null || compareInstants(start, end) >= 0 ||
    !Number.isSafeInteger(capacity) || capacity < 0 || capacity > nominalCapacity
  ) {
    addDiagnostic(context, "PTSCH-104", "Invalid availability interval or capacity", field.line, block.id);
    return null;
  }
  return Object.freeze({
    start,
    end,
    capacity,
    span: sourceLineSpan(field.line),
  });
}

function resourceCapacity(
  context: ParseContext,
  resourceId: string,
): number {
  const declaration = context.baseDocument.find(
    ({ kind, id }) => kind === "resource" && id === resourceId,
  );
  const value = declaration === undefined ? undefined : fieldNamed(declaration, "capacity")?.value;
  return typeof value === "number" ? value : 0;
}

interface ResourceOwnedFields {
  readonly calendar: OwnedField | null;
  readonly availableFrom: OwnedField | null;
  readonly availableUntil: OwnedField | null;
  readonly overrides: readonly OwnedField[];
}

function resourceOwnedFields(
  context: ParseContext,
  block: TemporalDeclarationBlock,
): ResourceOwnedFields {
  return Object.freeze({
    calendar: singleField(context, block, "calendar", "PTSCH-104"),
    availableFrom: singleField(context, block, "available_from", "PTSCH-104"),
    availableUntil: singleField(context, block, "available_until", "PTSCH-104"),
    overrides: fields(block, "availability"),
  });
}

function parseResourceOverrides(
  context: ParseContext,
  block: TemporalDeclarationBlock,
  sourceFields: readonly OwnedField[],
): readonly AvailabilityOverrideSource[] {
  if (sourceFields.length > TEMPORAL_SCHEDULE_SOURCE_LIMITS.availabilityOverridesPerResource) {
    addDiagnostic(context, "PTSCH-109", `Resource ${block.id} exceeds the availability limit`, block.span, block.id);
  }
  const nominalCapacity = resourceCapacity(context, block.id);
  const overrides = sourceFields.flatMap((field) => {
    const value = parseAvailabilityOverride(context, block, field, nominalCapacity);
    return value === null ? [] : [value];
  }).sort((left, right) => compareInstants(left.start, right.start) || compareInstants(left.end, right.end));
  for (let index = 1; index < overrides.length; index += 1) {
    if (compareInstants(overrides[index]!.start, overrides[index - 1]!.end) < 0) {
      addDiagnostic(context, "PTSCH-104", "Availability overrides overlap", overrides[index]!.span, block.id);
    }
  }
  return Object.freeze(overrides);
}

function validateResourceZone(
  context: ParseContext,
  block: TemporalDeclarationBlock,
  profile: ParsedProject,
  values: readonly (TemporalInstantSource | null)[],
): void {
  if (profile.profile?.kind !== "named_zone") return;
  for (const value of values) {
    validateZoneInstant(context, profile.profile.zoneId, value, block.id);
  }
}

function parseResource(
  context: ParseContext,
  block: TemporalDeclarationBlock,
  calendars: readonly CalendarSourceModel[],
  profile: ParsedProject,
): ResourceAvailabilitySource {
  const owned = resourceOwnedFields(context, block);
  const hasTemporal = owned.calendar !== null || owned.availableFrom !== null ||
    owned.availableUntil !== null || owned.overrides.length > 0;
  if (hasTemporal && !profile.hasNamedFields) {
    addDiagnostic(context, "PTSCH-104", "Resource availability requires a named-zone profile", block.span, block.id);
  }
  const calendarId = owned.calendar?.rawValue ?? null;
  if (calendarId !== null && !calendars.some(({ id }) => id === calendarId)) {
    addDiagnostic(context, "PTSCH-102", `Unknown resource calendar ${calendarId}`, owned.calendar!.line, block.id);
  }
  const availableFrom = instantField(context, owned.availableFrom, "PTSCH-104");
  const availableUntil = instantField(context, owned.availableUntil, "PTSCH-104");
  if (availableFrom !== null && availableUntil !== null && compareInstants(availableFrom, availableUntil) >= 0) {
    addDiagnostic(context, "PTSCH-104", "Resource validity interval is empty or reversed", block.span, block.id);
  }
  const overrides = parseResourceOverrides(context, block, owned.overrides);
  validateResourceZone(context, block, profile, [
    availableFrom,
    availableUntil,
    ...overrides.flatMap(({ start, end }) => [start, end]),
  ]);
  return Object.freeze({
    resourceId: block.id,
    calendarId,
    availableFrom,
    availableUntil,
    overrides: Object.freeze(overrides),
    span: block.span,
  });
}

function parseResources(
  context: ParseContext,
  calendars: readonly CalendarSourceModel[],
  profile: ParsedProject,
): readonly ResourceAvailabilitySource[] {
  return Object.freeze(context.blocks
    .filter(({ kind }) => kind === "resource")
    .map((block) => parseResource(context, block, calendars, profile)));
}

function eventBound(
  context: ParseContext,
  block: TemporalDeclarationBlock,
  field: ReturnType<typeof fields>[number],
  profile: ParsedProject,
): EventBoundSource | null {
  const task = block.kind === "task";
  const pattern = task
    ? /^(start|finish) (earliest|latest) (\S+)$/u
    : /^reach (earliest|latest) (\S+)$/u;
  const match = pattern.exec(field.rawValue);
  if (match === null) {
    addDiagnostic(context, "PTSCH-106", "Invalid when event bound", field.line, block.id);
    return null;
  }
  const event = task ? match[1]! : "reach";
  const direction = (task ? match[2] : match[1]) as BoundDirection;
  const rawInstant = task ? match[3]! : match[2]!;
  const instantColumn = field.valueColumn + field.rawValue.lastIndexOf(rawInstant);
  const value = parseTemporalInstant(rawInstant, field.line, instantColumn);
  if (value === null) {
    addDiagnostic(context, "PTSCH-106", "Invalid when date-time", field.line, block.id);
    return null;
  }
  if (profile.profile?.kind === "named_zone") {
    validateZoneInstant(context, profile.profile.zoneId, value, block.id);
  }
  return Object.freeze({
    entityKind: task ? "task" : "milestone",
    entityId: block.id,
    event: event as "start" | "finish" | "reach",
    direction,
    value,
    span: sourceLineSpan(field.line),
  });
}

function validateBoundPairs(
  context: ParseContext,
  block: TemporalDeclarationBlock,
  bounds: readonly EventBoundSource[],
): void {
  const seen = new Set<string>();
  for (const bound of bounds) {
    const key = `${bound.event}:${bound.direction}`;
    if (seen.has(key)) addDiagnostic(context, "PTSCH-106", `Duplicate when ${key}`, bound.span, block.id);
    seen.add(key);
  }
  for (const event of block.kind === "task" ? ["start", "finish"] : ["reach"]) {
    const earliest = bounds.find((bound) => bound.event === event && bound.direction === "earliest");
    const latest = bounds.find((bound) => bound.event === event && bound.direction === "latest");
    if (earliest !== undefined && latest !== undefined && compareInstants(earliest.value, latest.value) > 0) {
      addDiagnostic(context, "PTSCH-107", `Earliest ${event} is after latest ${event}`, latest.span, block.id);
    }
  }
}

function parseBounds(
  context: ParseContext,
  profile: ParsedProject,
): Readonly<{ task: readonly EventBoundSource[]; milestone: readonly EventBoundSource[] }> {
  const task: EventBoundSource[] = [];
  const milestone: EventBoundSource[] = [];
  for (const block of context.blocks.filter(({ kind }) =>
    kind === "task" || kind === "milestone")) {
    const parsed = fields(block, "when").flatMap((field) => {
      const value = eventBound(context, block, field, profile);
      return value === null ? [] : [value];
    });
    validateBoundPairs(context, block, parsed);
    (block.kind === "task" ? task : milestone).push(...parsed);
  }
  return Object.freeze({ task: Object.freeze(task), milestone: Object.freeze(milestone) });
}

function validateLegacyNotBefore(context: ParseContext): void {
  for (const declaration of context.baseDocument.filter(({ kind }) => kind === "task")) {
    const field = fieldNamed(declaration, "not_before");
    if (field !== undefined) {
      addDiagnostic(context, "PTSCH-108", "Grammar 8 requires when start earliest instead of not_before", field.span, declaration.id);
    }
  }
}

function validateAsOf(
  context: ParseContext,
  profile: ParsedProject,
): TemporalInstantSource | null {
  const named = profile.profile?.kind === "named_zone" ? profile.profile : null;
  const hasBounds = context.blocks.some((block) =>
    (block.kind === "task" || block.kind === "milestone") && fields(block, "when").length > 0);
  if (named === null && !hasBounds) return null;
  const project = context.blocks.find(({ kind }) => kind === "project");
  const code = named === null ? "PTSCH-106" : "PTSCH-105";
  const asOf = singleField(context, project, "as_of", code);
  const value = instantField(context, asOf, code);
  if (value === null) {
    if (asOf === null) addDiagnostic(context, code, "Temporal bounds require offset-bearing project as_of", project!.span);
    return null;
  }
  if (named !== null) validateZoneInstant(context, named.zoneId, value, project!.id);
  return value;
}

function validateAggregateLimit(
  context: ParseContext,
  calendars: readonly CalendarSourceModel[],
  resources: readonly ResourceAvailabilitySource[],
): void {
  const calendarInstants = calendars.reduce((sum, calendar) =>
    sum + calendar.weekdays.reduce((count, day) => count + day.windows.length * 2, 0) +
    calendar.exceptions.reduce((count, item) => count + item.windows.length * 2, 0), 0);
  const resourceInstants = resources.reduce((sum, resource) =>
    sum + (resource.availableFrom === null ? 0 : 1) +
    (resource.availableUntil === null ? 0 : 1) + resource.overrides.length * 2, 0);
  if (calendarInstants + resourceInstants > TEMPORAL_SCHEDULE_SOURCE_LIMITS.aggregateChangeInstants) {
    addDiagnostic(context, "PTSCH-109", "Document exceeds the aggregate calendar-change limit", context.blocks[0]!.span);
  }
}

function legacyDiagnostics(
  text: string,
  grammarVersion: number,
): Readonly<{ ok: boolean; documentId: string | null; diagnostics: readonly Diagnostic[] }> {
  if (grammarVersion === 7) {
    const checked = parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
    return {
      ok: checked.ok,
      documentId: checked.documentId,
      diagnostics: Object.freeze([
        ...(checked.baseDiagnostics as readonly Diagnostic[]),
        ...checked.diagnostics.map((item) => diagnostic(item.code, item.message, item.span)),
      ]),
    };
  }
  const checked = validateTargetGrammar6Document(text, TARGET_GRAMMAR_6_CAPABILITY, {
    maxDiagnostics: 1_000,
  });
  return { ok: checked.ok, documentId: checked.documentId, diagnostics: checked.diagnostics };
}

function result(
  grammarVersion: number | null,
  documentId: string | null,
  model: TemporalScheduleSourceModel | null,
  diagnostics: readonly Diagnostic[],
  maximum: number,
): TemporalScheduleSourceResult {
  const sorted = sortDiagnostics(diagnostics);
  const limited = limitDiagnostics(sorted, maximum);
  const counts = countDiagnostics(sorted);
  return Object.freeze({
    ok: counts.errors === 0,
    grammarVersion,
    documentId,
    model: counts.errors === 0 ? model : null,
    diagnostics: Object.freeze(limited.diagnostics as readonly TemporalSourceDiagnostic[]),
    diagnosticCounts: Object.freeze(counts),
    diagnosticsTruncated: limited.truncated,
  });
}

export function parseTemporalScheduleSource(
  text: string,
  capability: TemporalScheduleSourceCapability,
  options: Readonly<{ maxDiagnostics?: number }> = {},
): TemporalScheduleSourceResult {
  if (capability !== TEMPORAL_SCHEDULE_SOURCE_CAPABILITY) {
    throw new TypeError("the target Grammar 8 temporal schedule source capability is required");
  }
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const blocks = scanTemporalDeclarationBlocks(text);
  const grammarVersion = declaredTemporalGrammarVersion(blocks);
  if (!Number.isSafeInteger(grammarVersion) || grammarVersion < 1 || grammarVersion > 8) {
    const legacy = legacyDiagnostics(text, grammarVersion);
    return result(null, legacy.documentId, null, legacy.diagnostics, maximum);
  }
  if (grammarVersion < 8) {
    const legacy = legacyDiagnostics(text, grammarVersion);
    return result(grammarVersion, legacy.documentId, null, legacy.diagnostics, maximum);
  }
  const baseText = temporalScheduleBaseText(text, blocks);
  const milestoneBase = milestoneAcceptanceBaseText(baseText);
  const base = validateTargetGrammar6Document(
    milestoneBase,
    TARGET_GRAMMAR_6_CAPABILITY,
    { maxDiagnostics: 1_000 },
  );
  const acceptance = parseMilestoneAcceptanceSource(
    baseText,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  const diagnostics: Diagnostic[] = [
    ...base.diagnostics,
    ...acceptance.diagnostics.map((item) => diagnostic(item.code, item.message, item.span)),
  ];
  const context: ParseContext = {
    text,
    blocks,
    baseDocument: base.document.declarations as readonly DeclarationNode[],
    reservedIds: acceptance.records.map(({ id }) => id),
    diagnostics,
  };
  const calendars = parseCalendars(context);
  const project = parseProject(context, calendars);
  const asOf = validateAsOf(context, project);
  const resources = parseResources(context, calendars, project);
  const bounds = parseBounds(context, project);
  validateLegacyNotBefore(context);
  validateAggregateLimit(context, calendars, resources);
  const documentId = base.documentId;
  const model = documentId === null || project.profile === null
    ? null
    : Object.freeze({
        modelVersion: TEMPORAL_SCHEDULE_SOURCE_MODEL_VERSION,
        grammarVersion: 8 as const,
        documentId,
        asOf,
        profile: project.profile,
        calendars,
        resources,
        taskBounds: bounds.task,
        milestoneBounds: bounds.milestone,
      });
  return result(8, documentId, model, context.diagnostics, maximum);
}

export function temporalScheduleSourceModel(
  result: TemporalScheduleSourceResult,
): TemporalScheduleSourceModel {
  if (!result.ok || result.model === null) {
    throw new TypeError("a valid Grammar 8 temporal schedule source result is required");
  }
  return result.model;
}

export function compareTemporalSourceInstants(left: Rational, right: Rational): number {
  return compare(left, right);
}

function calendarEntry(
  context: ParseContext,
  block: TemporalDeclarationBlock,
  line: TemporalSourceLine,
): CalendarDaySource | CalendarExceptionSource | null {
  if (line.text === "" || /^  #/u.test(line.text)) return null;
  const weekday = /^  (mon|tue|wed|thu|fri|sat|sun) (.+)$/u.exec(line.text);
  if (weekday !== null) {
    const windows = parseCalendarWindows(weekday[2]!, line, 6);
    if (windows === null) {
      addDiagnostic(context, "PTSCH-103", "Invalid weekly calendar window", line, block.id);
      return null;
    }
    return Object.freeze({
      weekday: weekday[1] as Weekday,
      windows,
      span: sourceLineSpan(line),
    });
  }
  const exception = /^  except (\S+) (.+)$/u.exec(line.text);
  if (exception !== null && validIsoDate(exception[1]!)) {
    const windows = parseCalendarWindows(
      exception[2]!,
      line,
      9 + exception[1]!.length + 1,
    );
    if (windows !== null) {
      return Object.freeze({
        date: exception[1]!,
        windows,
        span: sourceLineSpan(line),
      });
    }
  }
  addDiagnostic(context, "PTSCH-103", "Invalid calendar entry", line, block.id);
  return null;
}
