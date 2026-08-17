import type { TextEdit } from "../mutation/text-edits.js";
import { planTemporalScheduleSourceMutation } from "./format.js";
import { fieldLine, scanTemporalDeclarationBlocks, type TemporalDeclarationBlock } from "./source-lexical.js";
import { parseTemporalScheduleSource, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "./source.js";
import type { TemporalScheduleMutationResult, TemporalScheduleSourceCapability } from "./source-types.js";

export type TemporalEntityMutation =
  | { readonly kind: "project.set"; readonly set: Readonly<{
      timeZone?: string | null; tzdb?: string | null; calendar?: string | null; workday?: string | null;
    }> }
  | { readonly kind: "resource.set"; readonly id: string; readonly set: Readonly<{
      calendar?: string | null; availableFrom?: string | null; availableUntil?: string | null;
      availability?: readonly string[];
    }> }
  | { readonly kind: "task.set"; readonly id: string; readonly when: readonly string[] }
  | { readonly kind: "milestone.set"; readonly id: string; readonly when: readonly string[] };

const owned = Object.freeze({
  project: Object.freeze(["time_zone", "tzdb", "calendar", "workday"]),
  resource: Object.freeze(["calendar", "available_from", "available_until", "availability"]),
  task: Object.freeze(["when"]), milestone: Object.freeze(["when"]),
});
const completeOrder = Object.freeze({
  project: Object.freeze(["version", "title", "description", "as_of", "duration_unit", "velocity", "finish",
    "goal_owner", "goal_delegates", "dag_owner", "dag_delegates", "plan_assurance_model", "plan_assurance_hash_model",
    "time_zone", "tzdb", "calendar", "workday", "critical_epsilon", "target_duration"]),
  resource: Object.freeze(["title", "description", "capacity", "calendar", "available_from", "available_until", "availability", "tags"]),
  task: Object.freeze(["title", "description", "duration", "estimate", "when", "deadline", "status", "priority", "requires",
    "owner", "tags", "blocked_reason", "source"]),
  milestone: Object.freeze(["title", "description", "state", "deadline", "when", "tags"]),
});

function lineEnding(text: string): "\n" | "\r\n" { return text.includes("\r\n") ? "\r\n" : "\n"; }
function targetBlock(blocks: readonly TemporalDeclarationBlock[], mutation: TemporalEntityMutation) {
  const kind = mutation.kind.slice(0, mutation.kind.indexOf(".")) as "project" | "resource" | "task" | "milestone";
  return blocks.find((block) => block.kind === kind && (kind === "project" || block.id === (mutation as { id: string }).id));
}

function desiredValues(block: TemporalDeclarationBlock, mutation: TemporalEntityMutation): Map<string, string[]> {
  const kind = block.kind as keyof typeof owned;
  const values = new Map(owned[kind].map((name) => [name, block.lines.flatMap((line) => {
    const field = fieldLine(line); return field?.name === name ? [field.rawValue] : [];
  })]));
  if (mutation.kind === "project.set") {
    for (const [name, value] of [["time_zone", mutation.set.timeZone], ["tzdb", mutation.set.tzdb],
      ["calendar", mutation.set.calendar], ["workday", mutation.set.workday]] as const) {
      if (value !== undefined) values.set(name, value === null ? [] : [value]);
    }
  } else if (mutation.kind === "resource.set") {
    for (const [name, value] of [["calendar", mutation.set.calendar], ["available_from", mutation.set.availableFrom],
      ["available_until", mutation.set.availableUntil]] as const) {
      if (value !== undefined) values.set(name, value === null ? [] : [value]);
    }
    if (mutation.set.availability !== undefined) values.set("availability", [...mutation.set.availability]);
  } else values.set("when", [...mutation.when]);
  return values;
}

function fieldEdits(name: string, lines: readonly TemporalDeclarationBlock["lines"][number][],
  desired: readonly string[]): Readonly<{ edits: readonly TextEdit[]; missing: readonly string[] }> {
  return Object.freeze({
    edits: Object.freeze(lines.map((line, index) => index < desired.length
      ? Object.freeze({ startOffset: line.start, endOffset: line.contentEnd, replacement: `  ${name} ${desired[index]!}` })
      : Object.freeze({ startOffset: line.start, endOffset: line.end, replacement: "" }))),
    missing: Object.freeze(desired.slice(lines.length).map((value) => `  ${name} ${value}`)),
  });
}

function temporalEntityMutationEdits(text: string, block: TemporalDeclarationBlock,
  mutation: TemporalEntityMutation): readonly TextEdit[] {
  const kind = block.kind as keyof typeof owned;
  const ownedLines = block.lines.filter((line) => {
    const field = fieldLine(line); return field !== null && owned[kind].includes(field.name as never);
  });
  const ranks = new Map(completeOrder[kind].map((name, index) => [name, index]));
  const firstOwnedRank = Math.min(...owned[kind].map((name) => ranks.get(name)!));
  const later = block.lines.find((line) => {
    const field = fieldLine(line); return field !== null && (ranks.get(field.name) ?? -1) > firstOwnedRank;
  });
  const trailingSeparator = block.lines.find((line, index) => line.text === "" &&
    block.lines.slice(index).every((candidate) => candidate.text === ""));
  const defaultInsertion = later?.start ?? trailingSeparator?.start ?? block.lines.at(-1)?.end ?? block.header.end;
  const values = desiredValues(block, mutation);
  const edits: TextEdit[] = [];
  const missing: string[] = [];
  for (const name of owned[kind]) {
    const lines = ownedLines.filter((line) => fieldLine(line)?.name === name);
    const field = fieldEdits(name, lines, values.get(name) ?? []);
    edits.push(...field.edits);
    missing.push(...field.missing);
  }
  if (missing.length > 0) {
    const insertion = ownedLines.at(-1)?.end ?? defaultInsertion;
    edits.push(Object.freeze({ startOffset: insertion, endOffset: insertion,
      replacement: `${missing.join(lineEnding(text))}${lineEnding(text)}` }));
  }
  return Object.freeze(edits);
}

function unavailable(text: string, mutation: TemporalEntityMutation,
  maxDiagnostics?: number): TemporalScheduleMutationResult {
  const checked = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY,
    maxDiagnostics === undefined ? {} : { maxDiagnostics });
  const entityId = mutation.kind === "project.set" ? checked.documentId : mutation.id;
  return Object.freeze({ ok: false, documentId: checked.documentId, changed: false, updatedText: null,
    edits: Object.freeze([]), diagnostics: Object.freeze([...checked.diagnostics, Object.freeze({
      code: "PTSCH-102", severity: "error" as const,
      message: `${mutation.kind.slice(0, mutation.kind.indexOf("."))} ${entityId ?? "<unknown>"} does not exist`,
      ...(entityId === null ? {} : { entityId }), data: Object.freeze({ action: mutation.kind }),
    })]), diagnosticsTruncated: checked.diagnosticsTruncated });
}

export function planTemporalEntityMutation(text: string, mutation: TemporalEntityMutation,
  capability: TemporalScheduleSourceCapability, options: Readonly<{ maxDiagnostics?: number }> = {}): TemporalScheduleMutationResult {
  if (capability !== TEMPORAL_SCHEDULE_SOURCE_CAPABILITY)
    throw new TypeError("the target Grammar 8 temporal schedule source capability is required");
  const blocks = scanTemporalDeclarationBlocks(text);
  const block = targetBlock(blocks, mutation);
  if (block === undefined) return unavailable(text, mutation, options.maxDiagnostics);
  return planTemporalScheduleSourceMutation(text, temporalEntityMutationEdits(text, block, mutation), capability, options);
}
