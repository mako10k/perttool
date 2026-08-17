import {
  formatTargetGrammar6Document,
} from "../formatter/target-source-formatter.js";
import { milestoneAcceptanceBaseText } from "../milestone-acceptance/source.js";
import {
  applyTextEdits,
  normalizeTextEdits,
  type TextEdit,
} from "../mutation/text-edits.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import {
  fieldLine,
  scanTemporalDeclarationBlocks,
  temporalScheduleBaseText,
  type TemporalDeclarationBlock,
  type TemporalSourceLine,
} from "./source-lexical.js";
import {
  parseTemporalScheduleSource,
  TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
} from "./source.js";
import type {
  CalendarSourceModel,
  EventBoundSource,
  ResourceAvailabilitySource,
  TemporalScheduleFormatResult,
  TemporalScheduleMutationResult,
  TemporalScheduleSourceCapability,
  TemporalScheduleSourceModel,
} from "./source-types.js";
import {
  canonicalInstant,
  canonicalWindows,
  canonicalWorkday,
} from "./source-values.js";

function lineEdit(line: TemporalSourceLine, replacement: string): TextEdit {
  return Object.freeze({
    startOffset: line.start,
    endOffset: line.contentEnd,
    replacement,
  });
}

function declarationFields(
  block: TemporalDeclarationBlock,
  name: string,
): readonly TemporalSourceLine[] {
  return Object.freeze(block.lines.filter((line) => fieldLine(line)?.name === name));
}

function calendarLines(block: TemporalDeclarationBlock): readonly TemporalSourceLine[] {
  return Object.freeze(block.lines.filter((line) =>
    /^  (?:mon|tue|wed|thu|fri|sat|sun|except) /u.test(line.text)));
}

function calendarEntries(calendar: CalendarSourceModel): readonly string[] {
  return Object.freeze([
    ...calendar.weekdays
      .filter(({ windows }) => windows.length > 0)
      .map(({ weekday, windows }) => `  ${weekday} ${canonicalWindows(windows)}`),
    ...calendar.exceptions.map(({ date, windows }) =>
      `  except ${date} ${canonicalWindows(windows)}`),
  ]);
}

function calendarEdits(
  block: TemporalDeclarationBlock,
  calendar: CalendarSourceModel,
): readonly TextEdit[] {
  const sourceLines = calendarLines(block);
  const canonical = calendarEntries(calendar);
  const edits: TextEdit[] = [];
  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = sourceLines[index]!;
    if (index < canonical.length) edits.push(lineEdit(line, canonical[index]!));
    else edits.push(Object.freeze({ startOffset: line.start, endOffset: line.end, replacement: "" }));
  }
  return Object.freeze(edits);
}

function uniqueFieldEdit(
  block: TemporalDeclarationBlock,
  name: string,
  replacement: string | null,
): TextEdit | null {
  const line = declarationFields(block, name)[0];
  return line === undefined || replacement === null
    ? null
    : lineEdit(line, `  ${name} ${replacement}`);
}

function projectEdits(
  block: TemporalDeclarationBlock,
  model: TemporalScheduleSourceModel,
): readonly TextEdit[] {
  if (model.profile.kind !== "named_zone") return Object.freeze([]);
  const candidates = [
    uniqueFieldEdit(block, "time_zone", JSON.stringify(model.profile.zoneId)),
    uniqueFieldEdit(block, "tzdb", JSON.stringify(model.profile.tzdbRelease)),
    uniqueFieldEdit(block, "calendar", model.profile.calendarId),
    uniqueFieldEdit(
      block,
      "workday",
      model.profile.workdayHours === null
        ? null
        : canonicalWorkday(model.profile.workdayHours),
    ),
  ];
  return Object.freeze(candidates.filter((edit): edit is TextEdit => edit !== null));
}

function availabilityText(value: ResourceAvailabilitySource["overrides"][number]): string {
  return `  availability ${canonicalInstant(value.start)}..${canonicalInstant(value.end)} capacity ${value.capacity}`;
}

function resourceEdits(
  block: TemporalDeclarationBlock,
  resource: ResourceAvailabilitySource,
): readonly TextEdit[] {
  const edits: TextEdit[] = [];
  const unique = [
    uniqueFieldEdit(block, "calendar", resource.calendarId),
    uniqueFieldEdit(
      block,
      "available_from",
      resource.availableFrom === null ? null : canonicalInstant(resource.availableFrom),
    ),
    uniqueFieldEdit(
      block,
      "available_until",
      resource.availableUntil === null ? null : canonicalInstant(resource.availableUntil),
    ),
  ];
  edits.push(...unique.filter((edit): edit is TextEdit => edit !== null));
  const lines = declarationFields(block, "availability");
  for (let index = 0; index < lines.length; index += 1) {
    edits.push(lineEdit(lines[index]!, availabilityText(resource.overrides[index]!)));
  }
  return Object.freeze(edits);
}

function eventRank(bound: EventBoundSource): number {
  const event = bound.event === "start" ? 0 : bound.event === "finish" ? 2 : 0;
  return event + (bound.direction === "earliest" ? 0 : 1);
}

function boundText(bound: EventBoundSource): string {
  return `  when ${bound.event} ${bound.direction} ${canonicalInstant(bound.value)}`;
}

function boundEdits(
  block: TemporalDeclarationBlock,
  bounds: readonly EventBoundSource[],
): readonly TextEdit[] {
  const lines = declarationFields(block, "when");
  const sorted = [...bounds].sort((left, right) => eventRank(left) - eventRank(right));
  return Object.freeze(lines.map((line, index) => lineEdit(line, boundText(sorted[index]!))));
}

function temporalOwnedEdits(
  text: string,
  model: TemporalScheduleSourceModel,
): readonly TextEdit[] {
  const blocks = scanTemporalDeclarationBlocks(text);
  const edits: TextEdit[] = [];
  for (const block of blocks) {
    if (block.kind === "project") edits.push(...projectEdits(block, model));
    if (block.kind === "calendar") {
      const calendar = model.calendars.find(({ id }) => id === block.id)!;
      edits.push(...calendarEdits(block, calendar));
    }
    if (block.kind === "resource") {
      const resource = model.resources.find(({ resourceId }) => resourceId === block.id)!;
      edits.push(...resourceEdits(block, resource));
    }
    if (block.kind === "task" || block.kind === "milestone") {
      const bounds = block.kind === "task" ? model.taskBounds : model.milestoneBounds;
      edits.push(...boundEdits(block, bounds.filter(({ entityId }) => entityId === block.id)));
    }
  }
  return Object.freeze(edits);
}

function legacyFormatEdits(text: string): readonly TextEdit[] {
  const blocks = scanTemporalDeclarationBlocks(text);
  const base = temporalScheduleBaseText(text, blocks);
  const grammar6 = milestoneAcceptanceBaseText(base);
  const formatted = formatTargetGrammar6Document(
    grammar6,
    TARGET_GRAMMAR_6_CAPABILITY,
    { maxDiagnostics: 1_000 },
  );
  if (!formatted.ok) throw new Error("validated Grammar 8 base failed legacy formatting");
  return formatted.edits;
}

function formatFailure(
  checked: ReturnType<typeof parseTemporalScheduleSource>,
): TemporalScheduleFormatResult {
  return Object.freeze({
    ok: false,
    documentId: checked.documentId,
    changed: false,
    formattedText: null,
    edits: Object.freeze([]),
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  });
}

export function formatTemporalScheduleSource(
  text: string,
  capability: TemporalScheduleSourceCapability,
  options: Readonly<{ maxDiagnostics?: number }> = {},
): TemporalScheduleFormatResult {
  if (capability !== TEMPORAL_SCHEDULE_SOURCE_CAPABILITY) {
    throw new TypeError("the target Grammar 8 temporal schedule source capability is required");
  }
  const checked = parseTemporalScheduleSource(text, capability, options);
  if (!checked.ok || checked.model === null) return formatFailure(checked);
  const edits = normalizeTextEdits(
    text,
    [...legacyFormatEdits(text), ...temporalOwnedEdits(text, checked.model)],
    "Grammar 8 temporal formatter",
  );
  const formattedText = applyTextEdits(text, edits);
  const repeated = parseTemporalScheduleSource(formattedText, capability, options);
  if (!repeated.ok || repeated.model === null) {
    throw new Error("Grammar 8 temporal formatter produced an invalid candidate");
  }
  return Object.freeze({
    ok: true,
    documentId: checked.documentId,
    changed: formattedText !== text,
    formattedText,
    edits: Object.freeze(edits),
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  });
}

export function planTemporalScheduleSourceMutation(
  text: string,
  requestedEdits: readonly TextEdit[],
  capability: TemporalScheduleSourceCapability,
  options: Readonly<{ maxDiagnostics?: number }> = {},
): TemporalScheduleMutationResult {
  if (capability !== TEMPORAL_SCHEDULE_SOURCE_CAPABILITY) {
    throw new TypeError("the target Grammar 8 temporal schedule source capability is required");
  }
  const original = parseTemporalScheduleSource(text, capability, options);
  if (!original.ok || original.model === null) {
    return Object.freeze({
      ok: false,
      documentId: original.documentId,
      changed: false,
      updatedText: null,
      edits: Object.freeze([]),
      diagnostics: original.diagnostics,
      diagnosticsTruncated: original.diagnosticsTruncated,
    });
  }
  const edits = normalizeTextEdits(text, requestedEdits, "Grammar 8 temporal mutation");
  const candidate = applyTextEdits(text, edits);
  const checked = parseTemporalScheduleSource(candidate, capability, options);
  return Object.freeze({
    ok: checked.ok && checked.model !== null,
    documentId: checked.documentId,
    changed: candidate !== text,
    updatedText: checked.ok && checked.model !== null ? candidate : null,
    edits: checked.ok && checked.model !== null ? Object.freeze(edits) : Object.freeze([]),
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  });
}
