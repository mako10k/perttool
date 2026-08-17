import type { TextEdit } from "../mutation/text-edits.js";
import { planTemporalScheduleSourceMutation } from "./format.js";
import { scanTemporalDeclarationBlocks, type TemporalDeclarationBlock } from "./source-lexical.js";
import { parseTemporalScheduleSource, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "./source.js";
import type { TemporalScheduleMutationResult, TemporalScheduleSourceCapability } from "./source-types.js";

export interface CalendarMutationRequest {
  readonly action: "add" | "set" | "remove";
  readonly id: string;
  readonly weekdays?: readonly string[];
  readonly exceptions?: readonly string[];
}

function newline(text: string): "\n" | "\r\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

function entries(request: CalendarMutationRequest, ending: string): string {
  return [...(request.weekdays ?? []).map((value) => `  ${value}`),
    ...(request.exceptions ?? []).map((value) => `  except ${value}`)]
    .map((value) => `${value}${ending}`).join("");
}

function unavailable(text: string, request: CalendarMutationRequest, message: string, maxDiagnostics?: number): TemporalScheduleMutationResult {
  const checked = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
    maxDiagnostics === undefined ? {} : { maxDiagnostics });
  return Object.freeze({ ok: false, documentId: checked.documentId, changed: false, updatedText: null,
    edits: Object.freeze([]), diagnostics: Object.freeze([...checked.diagnostics, Object.freeze({
      code: "PTSCH-102", severity: "error" as const, message, entityId: request.id,
      data: Object.freeze({ action: `calendar.${request.action}`, calendar_id: request.id }),
    })]), diagnosticsTruncated: checked.diagnosticsTruncated });
}

function addEdit(text: string, request: CalendarMutationRequest, blocks: readonly TemporalDeclarationBlock[], ending: string): readonly TextEdit[] {
  const project = blocks.find(({ kind }) => kind === "project")!;
  const offset = blocks.find(({ header }) => header.start > project.header.start)?.header.start ?? text.length;
  return Object.freeze([Object.freeze({ startOffset: offset, endOffset: offset,
    replacement: `calendar ${request.id}:${ending}${entries(request, ending)}${ending}` })]);
}

function removeEdit(text: string, block: TemporalDeclarationBlock, blocks: readonly TemporalDeclarationBlock[]): readonly TextEdit[] {
  const following = blocks[blocks.indexOf(block) + 1];
  return Object.freeze([Object.freeze({ startOffset: block.header.start,
    endOffset: following?.header.start ?? text.length, replacement: "" })]);
}

function setEdits(request: CalendarMutationRequest, block: TemporalDeclarationBlock, ending: string): readonly TextEdit[] {
  const owned = block.lines.filter(({ text }) => /^  (?:mon|tue|wed|thu|fri|sat|sun|except) /u.test(text));
  const insertion = owned[0]?.start ?? block.header.end;
  return Object.freeze([...owned.map((line) => Object.freeze({ startOffset: line.start, endOffset: line.end, replacement: "" })),
    Object.freeze({ startOffset: insertion, endOffset: insertion, replacement: entries(request, ending) })]);
}

export function planCalendarMutation(text: string, request: CalendarMutationRequest,
  capability: TemporalScheduleSourceCapability, options: Readonly<{ maxDiagnostics?: number }> = {}): TemporalScheduleMutationResult {
  if (capability !== TEMPORAL_SCHEDULE_SOURCE_CAPABILITY)
    throw new TypeError("the target Grammar 8 temporal schedule source capability is required");
  const original = parseTemporalScheduleSource(text, capability, options);
  if (!original.ok || original.model === null) {
    return Object.freeze({ ok: false, documentId: original.documentId, changed: false, updatedText: null,
      edits: Object.freeze([]), diagnostics: original.diagnostics, diagnosticsTruncated: original.diagnosticsTruncated });
  }
  const blocks = scanTemporalDeclarationBlocks(text);
  const block = blocks.find(({ kind, id }) => kind === "calendar" && id === request.id);
  if (request.action === "add" && block !== undefined) {
    return unavailable(text, request, `calendar ${request.id} already exists`, options.maxDiagnostics);
  }
  if (request.action !== "add" && block === undefined) {
    return unavailable(text, request, `calendar ${request.id} does not exist`, options.maxDiagnostics);
  }
  const ending = newline(text);
  const edits = request.action === "add" ? addEdit(text, request, blocks, ending)
    : request.action === "remove" ? removeEdit(text, block!, blocks)
      : setEdits(request, block!, ending);
  return planTemporalScheduleSourceMutation(text, edits, capability, options);
}
