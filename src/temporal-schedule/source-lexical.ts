import type { SourcePosition, SourceSpan } from "../model/diagnostics.js";

export interface TemporalSourceLine {
  readonly text: string;
  readonly start: number;
  readonly contentEnd: number;
  readonly end: number;
  readonly number: number;
}

export type TemporalDeclarationKind =
  | "project"
  | "resource"
  | "milestone"
  | "task"
  | "calendar"
  | "other";

export interface TemporalDeclarationBlock {
  readonly kind: TemporalDeclarationKind;
  readonly id: string;
  readonly header: TemporalSourceLine;
  readonly lines: readonly TemporalSourceLine[];
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
}

const identifier = "[A-Za-z][A-Za-z0-9_-]*";
const simpleHeader = new RegExp(`^(project|resource|milestone) (${identifier}):$`, "u");
const edgeHeader = new RegExp(`^(task|gate) (${identifier}) ${identifier} -> ${identifier}:$`, "u");
const otherHeader = new RegExp(`^[a-z_]+ (${identifier})(?: [^:]*)?:$`, "u");

export function splitTemporalSourceLines(text: string): readonly TemporalSourceLine[] {
  if (text.length === 0) return Object.freeze([]);
  const result: TemporalSourceLine[] = [];
  let start = 0;
  let number = 0;
  while (start < text.length) {
    const newline = text.indexOf("\n", start);
    const end = newline === -1 ? text.length : newline + 1;
    const rawContentEnd = newline === -1 ? text.length : newline;
    const contentEnd = rawContentEnd > start && text[rawContentEnd - 1] === "\r"
      ? rawContentEnd - 1
      : rawContentEnd;
    result.push(Object.freeze({
      text: text.slice(start, contentEnd),
      start,
      contentEnd,
      end,
      number,
    }));
    start = end;
    number += 1;
  }
  return Object.freeze(result);
}

export function sourcePosition(
  line: TemporalSourceLine,
  column: number,
): SourcePosition {
  return Object.freeze({
    offset: line.start + column,
    line: line.number,
    column,
  });
}

export function sourceLineSpan(line: TemporalSourceLine): SourceSpan {
  return Object.freeze({
    start: sourcePosition(line, 0),
    end: sourcePosition(line, line.text.length),
  });
}

export function sourceSliceSpan(
  line: TemporalSourceLine,
  start: number,
  end: number,
): SourceSpan {
  return Object.freeze({
    start: sourcePosition(line, start),
    end: sourcePosition(line, end),
  });
}

function headerIdentity(
  line: TemporalSourceLine,
): Readonly<{ kind: TemporalDeclarationKind; id: string }> | null {
  const text = line.number === 0 && line.text.startsWith("\uFEFF")
    ? line.text.slice(1)
    : line.text;
  const calendar = new RegExp(`^calendar (${identifier}):$`, "u").exec(text);
  if (calendar !== null) return { kind: "calendar", id: calendar[1]! };
  const simple = simpleHeader.exec(text);
  if (simple !== null) {
    return {
      kind: simple[1] as "project" | "resource" | "milestone",
      id: simple[2]!,
    };
  }
  const edge = edgeHeader.exec(text);
  if (edge !== null) {
    return { kind: edge[1] === "task" ? "task" : "other", id: edge[2]! };
  }
  const other = otherHeader.exec(text);
  return other === null ? null : { kind: "other", id: other[1]! };
}

function blockEnd(lines: readonly TemporalSourceLine[], start: number): number {
  let index = start + 1;
  while (index < lines.length) {
    const text = lines[index]!.text;
    if (text !== "" && !text.startsWith(" ") && !text.startsWith("\t")) break;
    index += 1;
  }
  return index;
}

export function scanTemporalDeclarationBlocks(
  text: string,
): readonly TemporalDeclarationBlock[] {
  const lines = splitTemporalSourceLines(text);
  const result: TemporalDeclarationBlock[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index]!;
    const identity = headerIdentity(header);
    if (identity === null) continue;
    const end = blockEnd(lines, index);
    const blockLines = lines.slice(index + 1, end);
    const idStart = header.text.indexOf(identity.id);
    const last = blockLines.at(-1) ?? header;
    result.push(Object.freeze({
      ...identity,
      header,
      lines: Object.freeze(blockLines),
      span: Object.freeze({
        start: sourcePosition(header, 0),
        end: sourcePosition(last, last.text.length),
      }),
      idSpan: sourceSliceSpan(header, idStart, idStart + identity.id.length),
    }));
    index = end - 1;
  }
  return Object.freeze(result);
}

export function fieldLine(
  line: TemporalSourceLine,
): Readonly<{ name: string; rawValue: string; valueColumn: number }> | null {
  const match = /^  ([a-z_]+)(?: (.*))?$/u.exec(line.text);
  if (match === null) return null;
  const name = match[1]!;
  const rawValue = match[2] ?? "";
  return { name, rawValue, valueColumn: rawValue === "" ? line.text.length : name.length + 3 };
}

function maskedLine(line: TemporalSourceLine): string {
  const endingLength = line.end - line.contentEnd;
  const ending = endingLength === 0 ? "" : endingLength === 2 ? "\r\n" : "\n";
  const contentLength = line.contentEnd - line.start;
  if (contentLength === 0) return ending;
  return `#${" ".repeat(contentLength - 1)}${ending}`;
}

const projectFields = new Set(["time_zone", "tzdb", "calendar", "workday"]);
const resourceFields = new Set([
  "calendar",
  "available_from",
  "available_until",
  "availability",
]);

function isOwnedField(kind: TemporalDeclarationKind, name: string): boolean {
  if (kind === "project") return projectFields.has(name);
  if (kind === "resource") return resourceFields.has(name);
  return (kind === "task" || kind === "milestone") && name === "when";
}

export function temporalScheduleBaseText(
  text: string,
  blocks: readonly TemporalDeclarationBlock[],
): string {
  const replacements = new Map<number, string>();
  for (const block of blocks) {
    if (block.kind === "calendar") {
      replacements.set(block.header.start, maskedLine(block.header));
      for (const line of block.lines) replacements.set(line.start, maskedLine(line));
      continue;
    }
    for (const line of block.lines) {
      const field = fieldLine(line);
      if (field !== null && isOwnedField(block.kind, field.name)) {
        replacements.set(line.start, maskedLine(line));
      } else if (block.kind === "project" && /^  version 8$/u.test(line.text)) {
        const ending = text.slice(line.contentEnd, line.end);
        replacements.set(line.start, `${line.text.slice(0, -1)}7${ending}`);
      }
    }
  }
  const lines = splitTemporalSourceLines(text);
  return lines.map((line) => replacements.get(line.start) ?? text.slice(line.start, line.end)).join("");
}

export function declaredTemporalGrammarVersion(
  blocks: readonly TemporalDeclarationBlock[],
): number {
  const project = blocks.find(({ kind }) => kind === "project");
  const version = project?.lines
    .map(fieldLine)
    .find((field) => field?.name === "version")?.rawValue;
  return version === undefined ? 1 : /^\d+$/u.test(version) ? Number(version) : Number.NaN;
}
