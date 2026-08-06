import type {
  DeclarationNode,
  DocumentNode,
  FieldNode,
  RequirementValue,
  TargetDeclarationKind,
} from "../model/syntax.js";
import type { TextEdit } from "./text-edits.js";

export interface PhysicalLine {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly endWithEnding: number;
}

const bareTagPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function splitPhysicalLines(text: string): readonly PhysicalLine[] {
  if (text.length === 0) return [];
  const lines: PhysicalLine[] = [];
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf("\n", start);
    if (newline === -1) {
      lines.push({ text: text.slice(start), start, end: text.length, endWithEnding: text.length });
      break;
    }
    const end = newline > start && text[newline - 1] === "\r" ? newline - 1 : newline;
    lines.push({ text: text.slice(start, end), start, end, endWithEnding: newline + 1 });
    start = newline + 1;
  }
  return lines;
}

export function majorLineEnding(text: string): "\n" | "\r\n" {
  let lf = 0;
  let crlf = 0;
  let first: "\n" | "\r\n" | undefined;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "\n") continue;
    const ending = index > 0 && text[index - 1] === "\r" ? "\r\n" : "\n";
    first ??= ending;
    if (ending === "\r\n") crlf += 1;
    else lf += 1;
  }
  if (lf === crlf) return first ?? "\n";
  return crlf > lf ? "\r\n" : "\n";
}

export function lineIndexAt(lines: readonly PhysicalLine[], offset: number): number {
  const index = lines.findIndex(
    (line, lineIndex) =>
      offset >= line.start &&
      (offset < line.endWithEnding ||
        (lineIndex === lines.length - 1 && offset === line.endWithEnding)),
  );
  if (index === -1) throw new Error("mutation span does not resolve to a physical line");
  return index;
}

export function contentEndOffset(
  field: FieldNode,
  lines: readonly PhysicalLine[],
): number {
  let offset = field.span.end.offset;
  if (field.children !== undefined && field.children.length > 0) {
    offset = field.children[field.children.length - 1]!.span.end.offset;
  } else if (field.name === "requires" && Array.isArray(field.value) && field.value.length > 0) {
    offset = (field.value[field.value.length - 1] as RequirementValue).span.end.offset;
  } else if (field.contentSpan !== undefined) {
    offset = field.contentSpan.end.offset;
  }
  return lines[lineIndexAt(lines, offset)]!.endWithEnding;
}

export function contentTextEndOffset(
  field: FieldNode,
  lines: readonly PhysicalLine[],
): number {
  let offset = field.span.end.offset;
  if (field.children !== undefined && field.children.length > 0) {
    offset = field.children[field.children.length - 1]!.span.end.offset;
  } else if (field.name === "requires" && Array.isArray(field.value) && field.value.length > 0) {
    offset = (field.value[field.value.length - 1] as RequirementValue).span.end.offset;
  } else if (field.contentSpan !== undefined) {
    offset = field.contentSpan.end.offset;
  }
  return lines[lineIndexAt(lines, offset)]!.end;
}

function declarationContentEndOffset(
  declaration: DeclarationNode<TargetDeclarationKind>,
  lines: readonly PhysicalLine[],
): number {
  const lastField = declaration.fields[declaration.fields.length - 1];
  const offset = lastField?.span.end.offset ?? declaration.headerSpan.end.offset;
  return lastField === undefined
    ? lines[lineIndexAt(lines, offset)]!.endWithEnding
    : contentEndOffset(lastField, lines);
}

export function leadingCommentStart(
  lines: readonly PhysicalLine[],
  elementStart: number,
  indentation: number,
): number {
  let index = lineIndexAt(lines, elementStart) - 1;
  let start = elementStart;
  while (index >= 0) {
    const line = lines[index]!;
    const match = /^( *)(#.*)$/.exec(line.text);
    if (match === null || match[1]!.length !== indentation) break;
    start = line.start;
    index -= 1;
  }
  return start;
}

export function deleteFieldEdit(
  field: FieldNode,
  lines: readonly PhysicalLine[],
): TextEdit {
  return {
    startOffset: leadingCommentStart(lines, field.span.start.offset, 2),
    endOffset: contentEndOffset(field, lines),
    replacement: "",
  };
}

export function deleteDeclarationEdit(
  declaration: DeclarationNode<TargetDeclarationKind>,
  lines: readonly PhysicalLine[],
): TextEdit {
  return {
    startOffset: leadingCommentStart(lines, declaration.headerSpan.start.offset, 0),
    endOffset: declarationContentEndOffset(declaration, lines),
    replacement: "",
  };
}

function serializeTag(tag: string): string {
  return bareTagPattern.test(tag) ? tag : JSON.stringify(tag);
}

export function serializeTags(tags: readonly string[]): string {
  return `[${tags.map(serializeTag).join(", ")}]`;
}

export function serializeTextField(
  name: string,
  value: string,
  lineEnding: string,
): string {
  if (
    !value.includes("\n") ||
    value.includes("\r") ||
    value.startsWith("\n") ||
    value.endsWith("\n")
  ) {
    return `  ${name} ${JSON.stringify(value)}`;
  }
  return [
    `  ${name} |`,
    ...value.split("\n").map((line) => (line === "" ? "" : `    ${line}`)),
  ].join(lineEnding);
}

export function fieldInsertionOffset(
  declaration: DeclarationNode<TargetDeclarationKind>,
  name: string,
  deleted: ReadonlySet<string>,
  lines: readonly PhysicalLine[],
  fieldRank: ReadonlyMap<string, number>,
): number {
  const rank = fieldRank.get(name)!;
  const later = declaration.fields.find(
    (field) => !deleted.has(field.name) && (fieldRank.get(field.name) ?? 99) > rank,
  );
  if (later !== undefined) {
    return leadingCommentStart(lines, later.span.start.offset, 2);
  }
  const surviving = declaration.fields.filter((field) => !deleted.has(field.name)).at(-1);
  if (surviving === undefined) throw new Error("mutation removed every required field");
  return contentEndOffset(surviving, lines);
}

export function insertionText(
  text: string,
  offset: number,
  serializedFields: readonly string[],
  lineEnding: string,
): string {
  const prefix = offset > 0 && text[offset - 1] !== "\n" ? lineEnding : "";
  const suffix = offset < text.length || text.endsWith("\n") ? lineEnding : "";
  return `${prefix}${serializedFields.join(lineEnding)}${suffix}`;
}

export function appendDeclarationEdit(
  text: string,
  serialized: string,
  lineEnding = majorLineEnding(text),
): TextEdit {
  const lines = splitPhysicalLines(text);
  const trailingBlank =
    text.endsWith("\n") && lines.length > 0 && lines[lines.length - 1]!.text.trim() === "";
  const prefix = text.length === 0
    ? ""
    : trailingBlank
      ? ""
      : text.endsWith("\n")
        ? lineEnding
        : `${lineEnding}${lineEnding}`;
  return {
    startOffset: text.length,
    endOffset: text.length,
    replacement: `${prefix}${serialized}${lineEnding}`,
  };
}

export function insertDeclarationsBeforeKinds<Kind extends TargetDeclarationKind>(
  text: string,
  document: DocumentNode<Kind>,
  serialized: readonly string[],
  beforeKinds: ReadonlySet<TargetDeclarationKind>,
): TextEdit {
  const lineEnding = majorLineEnding(text);
  const later = document.declarations.find((declaration) =>
    beforeKinds.has(declaration.kind)
  );
  if (later === undefined) {
    return appendDeclarationEdit(
      text,
      serialized.join(`${lineEnding}${lineEnding}`),
      lineEnding,
    );
  }
  const lines = splitPhysicalLines(text);
  const offset = leadingCommentStart(lines, later.headerSpan.start.offset, 0);
  return {
    startOffset: offset,
    endOffset: offset,
    replacement: `${serialized.join(`${lineEnding}${lineEnding}`)}${lineEnding}${lineEnding}`,
  };
}
