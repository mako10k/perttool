import type { SourceSpan } from "../model/diagnostics.js";
import {
  maskSourceDeclarationBlocks,
  sourceDeclarationBlockEnd,
  sourcePosition,
  sourceSliceSpan,
  splitTemporalSourceLines,
  type TemporalSourceLine,
} from "../temporal-schedule/source-lexical.js";

export interface PlanReviewDeclarationBlock {
  readonly id: string;
  readonly taskId: string;
  readonly header: TemporalSourceLine;
  readonly lines: readonly TemporalSourceLine[];
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
  readonly taskIdSpan: SourceSpan;
}

export interface PlanReviewFieldBlock {
  readonly name: string;
  readonly rawValue: string;
  readonly line: TemporalSourceLine;
  readonly span: SourceSpan;
  readonly valueSpan: SourceSpan;
}

const identifier = "[A-Za-z][A-Za-z0-9_-]*";
const headerPattern = new RegExp(
  `^plan_review_request (${identifier}) (${identifier}):$`,
  "u",
);

function headerText(line: TemporalSourceLine): string {
  return line.number === 0 && line.text.startsWith("\uFEFF")
    ? line.text.slice(1)
    : line.text;
}

function headerSpan(
  line: TemporalSourceLine,
  token: string,
  after = 0,
): SourceSpan {
  const start = line.text.indexOf(token, after);
  return sourceSliceSpan(line, start, start + token.length);
}

export function scanPlanReviewDeclarationBlocks(
  text: string,
): readonly PlanReviewDeclarationBlock[] {
  const lines = splitTemporalSourceLines(text);
  const blocks: PlanReviewDeclarationBlock[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index]!;
    if (/^\s/u.test(header.text)) continue;
    const match = headerPattern.exec(headerText(header));
    if (match === null) continue;
    const end = sourceDeclarationBlockEnd(lines, index);
    const body = lines.slice(index + 1, end);
    const last = body.at(-1) ?? header;
    const id = match[1]!;
    const taskId = match[2]!;
    const idSpan = headerSpan(header, id);
    blocks.push(Object.freeze({
      id,
      taskId,
      header,
      lines: Object.freeze(body),
      span: Object.freeze({
        start: sourcePosition(header, 0),
        end: sourcePosition(last, last.text.length),
      }),
      idSpan,
      taskIdSpan: headerSpan(header, taskId, idSpan.end.column),
    }));
    index = end - 1;
  }
  return Object.freeze(blocks);
}

export function planReviewFields(
  block: PlanReviewDeclarationBlock,
): readonly PlanReviewFieldBlock[] {
  return Object.freeze(block.lines.flatMap((line) => {
    if (line.text === "" || /^\s*#/u.test(line.text)) return [];
    const match = /^  ([a-z_]+) (.+)$/u.exec(line.text);
    if (match === null) return [];
    const name = match[1]!;
    const rawValue = match[2]!;
    const valueColumn = name.length + 3;
    return [Object.freeze({
      name,
      rawValue,
      line,
      span: sourceSliceSpan(line, 0, line.text.length),
      valueSpan: sourceSliceSpan(line, valueColumn, valueColumn + rawValue.length),
    })];
  }));
}

export function malformedPlanReviewHeaderLines(
  text: string,
  blocks: readonly PlanReviewDeclarationBlock[],
): readonly TemporalSourceLine[] {
  const known = new Set(blocks.map(({ header }) => header.start));
  return Object.freeze(splitTemporalSourceLines(text).filter((line) => {
    if (known.has(line.start) || /^\s/u.test(line.text)) return false;
    return /^(?:\uFEFF)?plan_review_request(?:\s|:|$)/u.test(line.text);
  }));
}

export function planReviewBaseText(
  text: string,
  blocks: readonly PlanReviewDeclarationBlock[],
): string {
  return maskSourceDeclarationBlocks(text, blocks, 10, 9);
}
