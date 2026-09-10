import type { SourceSpan } from "../model/diagnostics.js";
import {
  maskSourceDeclarationBlocks,
  sourcePosition,
  scanSourceDeclarationSegments,
  sourceDeclarationBlockEnd,
  sourceSliceSpan,
  splitTemporalSourceLines,
  type TemporalSourceLine,
} from "../temporal-schedule/source-lexical.js";

export type PlanningDeclarationKind =
  | "work"
  | "event"
  | "activity"
  | "window"
  | "work_order";

export interface PlanningDeclarationBlock {
  readonly kind: PlanningDeclarationKind;
  readonly id: string | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly header: TemporalSourceLine;
  readonly lines: readonly TemporalSourceLine[];
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan | null;
  readonly fromSpan: SourceSpan | null;
  readonly toSpan: SourceSpan | null;
}

export interface PlanningFieldBlock {
  readonly name: string;
  readonly rawValue: string;
  readonly blockStyle: boolean;
  readonly line: TemporalSourceLine;
  readonly children: readonly TemporalSourceLine[];
  readonly span: SourceSpan;
  readonly valueSpan: SourceSpan;
}

const identifier = "[A-Za-z][A-Za-z0-9_-]*";
const simpleHeader = new RegExp(`^(work|event|window) (${identifier}):$`, "u");
const activityHeader = new RegExp(
  `^activity (${identifier}) (${identifier}) -> (${identifier}):$`,
  "u",
);

function headerText(line: TemporalSourceLine): string {
  return line.number === 0 && line.text.startsWith("\uFEFF")
    ? line.text.slice(1)
    : line.text;
}

function headerIdentity(line: TemporalSourceLine): Readonly<{
  kind: PlanningDeclarationKind;
  id: string | null;
  from: string | null;
  to: string | null;
}> | null {
  const text = headerText(line);
  if (text === "work_order:") {
    return { kind: "work_order", id: null, from: null, to: null };
  }
  const simple = simpleHeader.exec(text);
  if (simple !== null) {
    return {
      kind: simple[1] as "work" | "event" | "window",
      id: simple[2]!,
      from: null,
      to: null,
    };
  }
  const activity = activityHeader.exec(text);
  return activity === null
    ? null
    : {
        kind: "activity",
        id: activity[1]!,
        from: activity[2]!,
        to: activity[3]!,
      };
}

function tokenSpan(
  line: TemporalSourceLine,
  token: string | null,
  after = 0,
): SourceSpan | null {
  if (token === null) return null;
  const start = line.text.indexOf(token, after);
  return sourceSliceSpan(line, start, start + token.length);
}

export function scanPlanningDeclarationBlocks(
  text: string,
): readonly PlanningDeclarationBlock[] {
  return Object.freeze(scanSourceDeclarationSegments(text, headerIdentity).map((segment) => {
    const { identity, header, lines, span } = segment;
    const idSpan = tokenSpan(header, identity.id);
    const fromSpan = tokenSpan(
      header,
      identity.from,
      idSpan?.end.column ?? 0,
    );
    const toSpan = tokenSpan(
      header,
      identity.to,
      fromSpan?.end.column ?? 0,
    );
    return Object.freeze({
      ...identity,
      header,
      lines,
      span,
      idSpan,
      fromSpan,
      toSpan,
    });
  }));
}

function fieldHeader(line: TemporalSourceLine): Readonly<{
  name: string;
  rawValue: string;
  blockStyle: boolean;
  valueColumn: number;
}> | null {
  const block = /^  ([a-z_]+):$/u.exec(line.text);
  if (block !== null) {
    return {
      name: block[1]!,
      rawValue: "",
      blockStyle: true,
      valueColumn: line.text.length,
    };
  }
  const scalar = /^  ([a-z_]+) (.+)$/u.exec(line.text);
  if (scalar === null) return null;
  return {
    name: scalar[1]!,
    rawValue: scalar[2]!,
    blockStyle: false,
    valueColumn: scalar[1]!.length + 3,
  };
}

function childEnd(lines: readonly TemporalSourceLine[], start: number): number {
  let index = start + 1;
  while (index < lines.length) {
    const text = lines[index]!.text;
    if (/^  [a-z_]+(?::| )/u.test(text)) break;
    index += 1;
  }
  return index;
}

export function planningFields(
  block: PlanningDeclarationBlock,
): readonly PlanningFieldBlock[] {
  const result: PlanningFieldBlock[] = [];
  for (let index = 0; index < block.lines.length; index += 1) {
    const line = block.lines[index]!;
    if (line.text === "" || /^\s*#/u.test(line.text)) continue;
    const header = fieldHeader(line);
    if (header === null) continue;
    const end = header.blockStyle || header.rawValue === "|"
      ? childEnd(block.lines, index)
      : index + 1;
    const children = block.lines.slice(index + 1, end);
    const last = children.at(-1) ?? line;
    result.push(Object.freeze({
      ...header,
      line,
      children: Object.freeze(children),
      span: Object.freeze({
        start: sourcePosition(line, 0),
        end: sourcePosition(last, last.text.length),
      }),
      valueSpan: sourceSliceSpan(
        line,
        header.valueColumn,
        header.valueColumn + header.rawValue.length,
      ),
    }));
    index = end - 1;
  }
  return Object.freeze(result);
}

export function planningPoolBaseText(
  text: string,
  blocks: readonly PlanningDeclarationBlock[],
): string {
  return maskSourceDeclarationBlocks(text, blocks, 9, 8);
}

export function declaredPlanningGrammarVersion(text: string): number {
  const lines = splitTemporalSourceLines(text);
  const projectIndex = lines.findIndex((line) =>
    /^(?:\uFEFF)?project [A-Za-z][A-Za-z0-9_-]*:$/u.test(line.text));
  if (projectIndex < 0) return 1;
  const end = sourceDeclarationBlockEnd(lines, projectIndex);
  const value = lines.slice(projectIndex + 1, end)
    .map((line) => /^  version (.+)$/u.exec(line.text)?.[1])
    .find((item) => item !== undefined);
  return value === undefined ? 1 : /^\d+$/u.test(value) ? Number(value) : Number.NaN;
}

export function malformedPlanningHeaderLines(
  text: string,
  blocks: readonly PlanningDeclarationBlock[],
): readonly TemporalSourceLine[] {
  const known = new Set(blocks.map(({ header }) => header.start));
  return Object.freeze(splitTemporalSourceLines(text).filter((line) => {
    if (known.has(line.start) || /^\s/u.test(line.text)) return false;
    const value = headerText(line);
    return /^(?:work|event|activity|window|work_order)(?:\s|:|$)/u.test(value);
  }));
}
