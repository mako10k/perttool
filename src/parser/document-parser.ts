import type {
  Diagnostic,
  SourcePosition,
  SourceSpan,
} from "../model/diagnostics.js";
import {
  countDiagnostics,
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
} from "../model/diagnostics.js";
import type {
  DeclarationKind,
  DeclarationNode,
  DocumentNode,
  DurationValue,
  FieldNode,
  ParseResult,
  RequirementValue,
  TriviaNode,
  VelocityValue,
} from "../model/syntax.js";

interface SourceLine {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly prefixLength: number;
}

export interface ParseOptions {
  readonly maxDiagnostics?: number;
}

const identifierPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const declarationKinds = new Set<DeclarationKind>([
  "project",
  "resource",
  "milestone",
  "task",
  "gate",
]);

const allowedFields: Readonly<Record<DeclarationKind, ReadonlySet<string>>> = {
  project: new Set([
    "version",
    "title",
    "description",
    "as_of",
    "duration_unit",
    "velocity",
    "finish",
    "critical_epsilon",
    "target_duration",
  ]),
  resource: new Set(["title", "description", "capacity", "tags"]),
  milestone: new Set(["title", "description", "state", "tags"]),
  task: new Set([
    "title",
    "description",
    "duration",
    "estimate",
    "status",
    "priority",
    "requires",
    "owner",
    "tags",
    "blocked_reason",
    "source",
  ]),
  gate: new Set(["reason"]),
};

function splitLines(text: string): readonly SourceLine[] {
  if (text.length === 0) return [];
  const lines: SourceLine[] = [];
  let offset = 0;
  let lineNumber = 0;
  while (offset < text.length) {
    const newline = text.indexOf("\n", offset);
    const rawEnd = newline === -1 ? text.length : newline;
    const contentEnd = rawEnd > offset && text[rawEnd - 1] === "\r" ? rawEnd - 1 : rawEnd;
    const prefixLength = lineNumber === 0 && text[offset] === "\uFEFF" ? 1 : 0;
    lines.push({
      text: text.slice(offset + prefixLength, contentEnd),
      start: offset,
      end: contentEnd,
      line: lineNumber,
      prefixLength,
    });
    if (newline === -1) break;
    offset = newline + 1;
    lineNumber += 1;
  }
  return lines;
}

function position(line: SourceLine, column: number): SourcePosition {
  const adjusted = line.prefixLength + column;
  return {
    offset: line.start + adjusted,
    line: line.line,
    column: adjusted,
  };
}

function span(line: SourceLine, start: number, end: number): SourceSpan {
  return { start: position(line, start), end: position(line, end) };
}

function lineSpan(line: SourceLine): SourceSpan {
  return span(line, 0, line.text.length);
}

function joinSpan(start: SourceSpan, end: SourceSpan): SourceSpan {
  return { start: start.start, end: end.end };
}

function leadingIndent(line: SourceLine): { indent: number; hasTab: boolean } {
  let indent = 0;
  let hasTab = false;
  for (const character of line.text) {
    if (character === " ") {
      indent += 1;
      continue;
    }
    if (character === "\t") {
      hasTab = true;
      indent += 1;
      continue;
    }
    break;
  }
  return { indent, hasTab };
}

function diagnostic(
  code: string,
  message: string,
  diagnosticSpan: SourceSpan,
  helpTopic: string,
  entityId?: string,
): Diagnostic {
  return {
    code,
    severity: "error",
    message,
    span: diagnosticSpan,
    helpTopic,
    ...(entityId === undefined ? {} : { entityId }),
  };
}

function parseDuration(raw: string): DurationValue | undefined {
  const match = /^([0-9]+)(?:\.([0-9]+))?([dhp])$/.exec(raw);
  if (match === null) return undefined;
  const whole = match[1];
  if (whole === undefined) return undefined;
  const fraction = match[2] ?? "";
  const suffix = match[3];
  if (suffix !== "d" && suffix !== "h" && suffix !== "p") return undefined;
  return {
    text: raw,
    digits: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
    suffix,
  };
}

function parseVelocity(raw: string): VelocityValue | undefined {
  const match = /^([0-9]+(?:\.[0-9]+)?p)\/([0-9]+(?:\.[0-9]+)?[dh])$/.exec(raw);
  if (match === null) return undefined;
  const points = parseDuration(match[1]!);
  const period = parseDuration(match[2]!);
  if (points?.suffix !== "p" || (period?.suffix !== "d" && period?.suffix !== "h")) {
    return undefined;
  }
  return {
    text: raw,
    points: points as DurationValue & { readonly suffix: "p" },
    period: period as DurationValue & { readonly suffix: "d" | "h" },
  };
}

function parseInteger(raw: string): number | undefined {
  if (!/^[0-9]+$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value <= 2_147_483_647 ? value : undefined;
}

function parseString(raw: string): string | undefined {
  if (!raw.startsWith('"') || !raw.endsWith('"')) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function findInlineCommentStart(text: string): number | undefined {
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        quoted = false;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === "#") {
      return index;
    }
  }
  return undefined;
}

function inlineCommentDiagnostic(
  line: SourceLine,
  start: number,
  entityId?: string,
): Diagnostic {
  return diagnostic(
    "PTDSL-011",
    "inline commentは使用できません",
    span(line, start, line.text.length),
    "syntax.comments",
    entityId,
  );
}

function splitTagItems(raw: string): readonly string[] | undefined {
  if (!raw.startsWith("[") || !raw.endsWith("]")) return undefined;
  const body = raw.slice(1, -1).trim();
  if (body === "") return [];
  const items: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  for (let index = 0; index <= body.length; index += 1) {
    const character = body[index];
    if (index === body.length || (character === "," && !quoted)) {
      const item = body.slice(start, index).trim();
      if (item === "") return undefined;
      const stringValue = item.startsWith('"') ? parseString(item) : undefined;
      if (stringValue !== undefined) items.push(stringValue);
      else if (identifierPattern.test(item)) items.push(item);
      else return undefined;
      start = index + 1;
      continue;
    }
    if (character === "\\" && quoted && !escaped) {
      escaped = true;
      continue;
    }
    if (character === '"' && !escaped) quoted = !quoted;
    escaped = false;
  }
  return quoted ? undefined : items;
}

function scalarFieldValue(
  name: string,
  rawValue: string,
): { value: unknown; code?: string; topic?: string } {
  if (["title", "owner", "source"].includes(name)) {
    const value = parseString(rawValue);
    return value === undefined
      ? { value: rawValue, code: "PTDSL-006", topic: "syntax.string" }
      : { value };
  }
  if (["description", "blocked_reason", "reason"].includes(name)) {
    const value = parseString(rawValue);
    return value === undefined
      ? { value: rawValue, code: "PTDSL-006", topic: "syntax.text" }
      : { value };
  }
  if (["version", "capacity", "priority"].includes(name)) {
    const value = parseInteger(rawValue);
    return value === undefined
      ? { value: rawValue, code: "PTDSL-012", topic: "syntax" }
      : { value };
  }
  if (["duration", "critical_epsilon", "target_duration"].includes(name)) {
    const value = parseDuration(rawValue);
    return value === undefined
      ? { value: rawValue, code: "PTDSL-007", topic: "syntax.duration" }
      : { value };
  }
  if (name === "velocity") {
    const value = parseVelocity(rawValue);
    return value === undefined
      ? { value: rawValue, code: "PTDSL-007", topic: "syntax.velocity" }
      : { value };
  }
  if (name === "finish") {
    return identifierPattern.test(rawValue)
      ? { value: rawValue }
      : { value: rawValue, code: "PTDSL-004", topic: "syntax.project" };
  }
  if (name === "duration_unit") {
    return rawValue === "day" || rawValue === "hour" || rawValue === "point"
      ? { value: rawValue }
      : { value: rawValue, code: "PTDSL-012", topic: "syntax.duration" };
  }
  if (name === "state") {
    return rawValue === "planned" || rawValue === "reached"
      ? { value: rawValue }
      : { value: rawValue, code: "PTDSL-012", topic: "syntax.milestone" };
  }
  if (name === "status") {
    return ["planned", "active", "blocked", "done"].includes(rawValue)
      ? { value: rawValue }
      : { value: rawValue, code: "PTDSL-012", topic: "syntax.task" };
  }
  if (name === "tags") {
    const value = splitTagItems(rawValue);
    return value === undefined
      ? { value: rawValue, code: "PTDSL-009", topic: "syntax.tags" }
      : { value };
  }
  if (name === "as_of") return { value: rawValue };
  return { value: rawValue };
}

function parseNestedEstimate(
  lines: readonly SourceLine[],
  startIndex: number,
  diagnostics: Diagnostic[],
  trivia: TriviaNode[],
): { children: readonly FieldNode[]; nextIndex: number; endSpan: SourceSpan } {
  const children: FieldNode[] = [];
  let index = startIndex;
  let endSpan = lineSpan(lines[startIndex - 1]!);
  while (index < lines.length) {
    const line = lines[index]!;
    const trimmed = line.text.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      trivia.push({
        kind: trimmed === "" ? "blank" : "comment",
        text: line.text,
        span: lineSpan(line),
      });
      endSpan = lineSpan(line);
      index += 1;
      continue;
    }
    const { indent, hasTab } = leadingIndent(line);
    if (indent <= 2) break;
    if (hasTab || indent !== 4) {
      diagnostics.push(
        diagnostic(
          hasTab ? "PTDSL-001" : "PTDSL-002",
          "estimate blockは4 spacesでindentしてください",
          span(line, 0, indent),
          "syntax.indentation",
        ),
      );
      index += 1;
      if (indent > 4) index = skipIndentedRegion(lines, index, 4);
      continue;
    }
    const content = line.text.slice(4).trimEnd();
    const inlineCommentStart = findInlineCommentStart(content);
    if (inlineCommentStart !== undefined) {
      diagnostics.push(inlineCommentDiagnostic(line, 4 + inlineCommentStart));
      index += 1;
      continue;
    }
    const match = /^(optimistic|most_likely|pessimistic) (.+)$/.exec(content);
    if (match === null) {
      diagnostics.push(
        diagnostic(
          "PTDSL-005",
          "estimate blockのfieldが不正です",
          lineSpan(line),
          "syntax.estimate",
        ),
      );
      index += 1;
      continue;
    }
    const name = match[1]!;
    const rawValue = match[2]!;
    const valueOffset = line.text.indexOf(rawValue, 4 + name.length);
    const valueSpan = span(line, valueOffset, valueOffset + rawValue.length);
    const value = parseDuration(rawValue);
    if (value === undefined) {
      diagnostics.push(
        diagnostic(
          "PTDSL-007",
          `${name}のdurationが不正です`,
          valueSpan,
          "syntax.duration",
        ),
      );
    }
    children.push({
      name,
      rawValue,
      value: value ?? rawValue,
      span: lineSpan(line),
      valueSpan,
    });
    endSpan = lineSpan(line);
    index += 1;
  }
  return { children, nextIndex: index, endSpan };
}

function parseNestedRequirements(
  lines: readonly SourceLine[],
  startIndex: number,
  diagnostics: Diagnostic[],
  trivia: TriviaNode[],
): {
  requirements: readonly RequirementValue[];
  nextIndex: number;
  endSpan: SourceSpan;
} {
  const requirements: RequirementValue[] = [];
  let index = startIndex;
  let endSpan = lineSpan(lines[startIndex - 1]!);
  while (index < lines.length) {
    const line = lines[index]!;
    const trimmed = line.text.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      trivia.push({
        kind: trimmed === "" ? "blank" : "comment",
        text: line.text,
        span: lineSpan(line),
      });
      endSpan = lineSpan(line);
      index += 1;
      continue;
    }
    const { indent, hasTab } = leadingIndent(line);
    if (indent <= 2) break;
    if (hasTab || indent !== 4) {
      diagnostics.push(
        diagnostic(
          hasTab ? "PTDSL-001" : "PTDSL-002",
          "requires blockは4 spacesでindentしてください",
          span(line, 0, indent),
          "syntax.indentation",
        ),
      );
      index += 1;
      if (indent > 4) index = skipIndentedRegion(lines, index, 4);
      continue;
    }
    const content = line.text.slice(4).trimEnd();
    const inlineCommentStart = findInlineCommentStart(content);
    if (inlineCommentStart !== undefined) {
      diagnostics.push(inlineCommentDiagnostic(line, 4 + inlineCommentStart));
      index += 1;
      continue;
    }
    const match = /^([A-Za-z][A-Za-z0-9_-]*) ([0-9]+)$/.exec(content);
    if (match === null) {
      diagnostics.push(
        diagnostic(
          "PTDSL-005",
          "resource requirementは`RESOURCE_ID units`で記述してください",
          lineSpan(line),
          "syntax.task",
        ),
      );
      index += 1;
      continue;
    }
    const resourceId = match[1]!;
    const unitsRaw = match[2]!;
    const units = parseInteger(unitsRaw);
    const resourceOffset = line.text.indexOf(resourceId, 4);
    const unitsOffset = line.text.lastIndexOf(unitsRaw);
    const requirementSpan = lineSpan(line);
    if (units === undefined) {
      diagnostics.push(
        diagnostic(
          "PTSEM-109",
          "resource requirement unitsが範囲外です",
          span(line, unitsOffset, unitsOffset + unitsRaw.length),
          "syntax.resource",
        ),
      );
    } else {
      requirements.push({
        resourceId,
        units,
        span: requirementSpan,
        resourceSpan: span(line, resourceOffset, resourceOffset + resourceId.length),
        unitsSpan: span(line, unitsOffset, unitsOffset + unitsRaw.length),
      });
    }
    endSpan = requirementSpan;
    index += 1;
  }
  return { requirements, nextIndex: index, endSpan };
}

function parseBlockText(
  lines: readonly SourceLine[],
  startIndex: number,
  diagnostics: Diagnostic[],
): { value: string; nextIndex: number; endSpan: SourceSpan } {
  const contentLines: string[] = [];
  let index = startIndex;
  let endSpan = lineSpan(lines[startIndex - 1]!);
  let sawContent = false;
  let sawSyntaxError = false;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.text.trim() === "") {
      contentLines.push("");
      endSpan = lineSpan(line);
      index += 1;
      continue;
    }
    const { indent, hasTab } = leadingIndent(line);
    if (indent <= 2) break;
    if (hasTab || indent < 4) {
      diagnostics.push(
        diagnostic(
          hasTab ? "PTDSL-001" : "PTDSL-010",
          "block textはfieldより1 level以上深くindentしてください",
          span(line, 0, indent),
          "syntax.text",
        ),
      );
      sawSyntaxError = true;
      endSpan = lineSpan(line);
      index = skipIndentedRegion(lines, index + 1, 2);
      break;
    }
    contentLines.push(line.text.slice(4));
    sawContent ||= line.text.slice(4).trim() !== "";
    endSpan = lineSpan(line);
    index += 1;
  }
  while (contentLines.at(-1) === "") contentLines.pop();
  if (!sawContent && !sawSyntaxError) {
    diagnostics.push(
      diagnostic(
        "PTDSL-010",
        "block textは1行以上のnonblank contentを必要とします",
        lineSpan(lines[startIndex - 1]!),
        "syntax.text",
      ),
    );
  }
  return {
    value: sawContent ? contentLines.join("\n") : "",
    nextIndex: index,
    endSpan,
  };
}

function skipIndentedRegion(
  lines: readonly SourceLine[],
  startIndex: number,
  parentIndent: number,
): number {
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index]!;
    if (line.text.trim() === "") {
      index += 1;
      continue;
    }
    if (leadingIndent(line).indent <= parentIndent) break;
    index += 1;
  }
  return index;
}

function isKnownDeclarationHeader(text: string): boolean {
  return (
    /^(?:project|resource|milestone) [A-Za-z][A-Za-z0-9_-]*:$/.test(text) ||
    /^(?:task|gate) [A-Za-z][A-Za-z0-9_-]* [A-Za-z][A-Za-z0-9_-]* -> [A-Za-z][A-Za-z0-9_-]*:$/.test(text)
  );
}

function skipInvalidTopLevelRegion(
  lines: readonly SourceLine[],
  startIndex: number,
  trivia: TriviaNode[],
): number {
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index]!;
    const trimmed = line.text.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      trivia.push({
        kind: trimmed === "" ? "blank" : "comment",
        text: line.text,
        span: lineSpan(line),
      });
      index += 1;
      continue;
    }
    const indentation = leadingIndent(line);
    if (indentation.indent === 0 && isKnownDeclarationHeader(line.text)) break;
    index += 1;
  }
  return index;
}

function parseDeclarationHeader(
  line: SourceLine,
  diagnostics: Diagnostic[],
): Omit<DeclarationNode, "span" | "fields"> | undefined {
  const edge = /^(task|gate) ([A-Za-z][A-Za-z0-9_-]*) ([A-Za-z][A-Za-z0-9_-]*) -> ([A-Za-z][A-Za-z0-9_-]*):$/.exec(
    line.text,
  );
  if (edge !== null) {
    const kind = edge[1] as "task" | "gate";
    const id = edge[2]!;
    const from = edge[3]!;
    const to = edge[4]!;
    const idStart = line.text.indexOf(id, kind.length + 1);
    const fromStart = line.text.indexOf(from, idStart + id.length);
    const arrowStart = line.text.indexOf("->", fromStart + from.length);
    const toStart = line.text.indexOf(to, arrowStart + 2);
    return {
      kind,
      id,
      idSpan: span(line, idStart, idStart + id.length),
      headerSpan: lineSpan(line),
      from,
      fromSpan: span(line, fromStart, fromStart + from.length),
      to,
      toSpan: span(line, toStart, toStart + to.length),
      arrowSpan: span(line, arrowStart, arrowStart + 2),
    };
  }
  const simple = /^(project|resource|milestone) ([A-Za-z][A-Za-z0-9_-]*):$/.exec(
    line.text,
  );
  if (simple !== null) {
    const kind = simple[1] as "project" | "resource" | "milestone";
    const id = simple[2]!;
    const idStart = line.text.indexOf(id, kind.length + 1);
    return {
      kind,
      id,
      idSpan: span(line, idStart, idStart + id.length),
      headerSpan: lineSpan(line),
    };
  }
  const firstWord = line.text.trim().split(/\s+/, 1)[0] ?? "";
  diagnostics.push(
    diagnostic(
      declarationKinds.has(firstWord as DeclarationKind) ? "PTDSL-004" : "PTDSL-003",
      "top-level declaration headerが不正です",
      lineSpan(line),
      "syntax.top-level",
    ),
  );
  return undefined;
}

export function parseDocument(text: string, options: ParseOptions = {}): ParseResult {
  const maxDiagnostics = normalizeMaxDiagnostics(options.maxDiagnostics);
  const diagnostics: Diagnostic[] = [];
  const declarations: DeclarationNode[] = [];
  const trivia: TriviaNode[] = [];
  const lines = splitLines(text);
  let index = 0;
  while (index < lines.length) {
    const headerLine = lines[index]!;
    const trimmed = headerLine.text.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      trivia.push({
        kind: trimmed === "" ? "blank" : "comment",
        text: headerLine.text,
        span: lineSpan(headerLine),
      });
      index += 1;
      continue;
    }
    const { indent, hasTab } = leadingIndent(headerLine);
    if (hasTab || indent !== 0) {
      diagnostics.push(
        diagnostic(
          hasTab ? "PTDSL-001" : "PTDSL-002",
          "top-level declarationはcolumn 0から開始してください",
          span(headerLine, 0, indent),
          "syntax.indentation",
        ),
      );
      index += 1;
      continue;
    }
    const headerInlineCommentStart = findInlineCommentStart(headerLine.text);
    if (headerInlineCommentStart !== undefined) {
      diagnostics.push(inlineCommentDiagnostic(headerLine, headerInlineCommentStart));
      index += 1;
      index = skipInvalidTopLevelRegion(lines, index, trivia);
      continue;
    }
    const header = parseDeclarationHeader(headerLine, diagnostics);
    index += 1;
    if (header === undefined) {
      index = skipInvalidTopLevelRegion(lines, index, trivia);
      continue;
    }
    const fields: FieldNode[] = [];
    let declarationEnd = header.headerSpan;
    while (index < lines.length) {
      const line = lines[index]!;
      const bodyTrimmed = line.text.trim();
      if (bodyTrimmed === "" || bodyTrimmed.startsWith("#")) {
        trivia.push({
          kind: bodyTrimmed === "" ? "blank" : "comment",
          text: line.text,
          span: lineSpan(line),
        });
        declarationEnd = lineSpan(line);
        index += 1;
        continue;
      }
      const indentation = leadingIndent(line);
      if (indentation.indent === 0) break;
      if (indentation.hasTab || indentation.indent !== 2) {
        diagnostics.push(
          diagnostic(
            indentation.hasTab ? "PTDSL-001" : "PTDSL-002",
            "declaration fieldは2 spacesでindentしてください",
            span(line, 0, indentation.indent),
            "syntax.indentation",
            header.id,
          ),
        );
        index += 1;
        if (indentation.indent > 2) {
          index = skipIndentedRegion(lines, index, 2);
        }
        continue;
      }
      const content = line.text.slice(2).trimEnd();
      const inlineCommentStart = findInlineCommentStart(content);
      if (inlineCommentStart !== undefined) {
        diagnostics.push(inlineCommentDiagnostic(line, 2 + inlineCommentStart, header.id));
        index += 1;
        continue;
      }
      const blockMatch = /^([a-z_]+):$/.exec(content);
      if (blockMatch !== null) {
        const name = blockMatch[1]!;
        const isKnownBlock = name === "estimate" || name === "requires";
        if (!isKnownBlock || !allowedFields[header.kind].has(name)) {
          diagnostics.push(
            diagnostic(
              "PTDSL-005",
              `${header.kind}にunknown block field ${name}があります`,
              span(line, 2, 2 + name.length),
              `syntax.${header.kind}`,
              header.id,
            ),
          );
          index += 1;
          index = skipIndentedRegion(lines, index, 2);
          continue;
        }
        const keywordStart = 2;
        if (name === "estimate") {
          const parsed = parseNestedEstimate(lines, index + 1, diagnostics, trivia);
          fields.push({
            name,
            rawValue: "",
            value: Object.fromEntries(parsed.children.map((child) => [child.name, child.value])),
            span: joinSpan(lineSpan(line), parsed.endSpan),
            valueSpan: span(line, keywordStart, keywordStart + name.length),
            children: parsed.children,
          });
          declarationEnd = parsed.endSpan;
          index = parsed.nextIndex;
          continue;
        }
        const parsed = parseNestedRequirements(lines, index + 1, diagnostics, trivia);
        fields.push({
          name,
          rawValue: "",
          value: parsed.requirements,
          span: joinSpan(lineSpan(line), parsed.endSpan),
          valueSpan: span(line, keywordStart, keywordStart + name.length),
        });
        declarationEnd = parsed.endSpan;
        index = parsed.nextIndex;
        continue;
      }
      const textBlockMatch = /^(description|blocked_reason|reason) \|$/.exec(content);
      if (textBlockMatch !== null) {
        const name = textBlockMatch[1]!;
        if (!allowedFields[header.kind].has(name)) {
          diagnostics.push(
            diagnostic(
              "PTDSL-005",
              `${header.kind}に${name} fieldは使用できません`,
              lineSpan(line),
              `syntax.${header.kind}`,
              header.id,
            ),
          );
          index += 1;
          continue;
        }
        const parsed = parseBlockText(lines, index + 1, diagnostics);
        const valueStart = line.text.lastIndexOf("|");
        fields.push({
          name,
          rawValue: "|",
          value: parsed.value,
          span: joinSpan(lineSpan(line), parsed.endSpan),
          valueSpan: span(line, valueStart, valueStart + 1),
        });
        declarationEnd = parsed.endSpan;
        index = parsed.nextIndex;
        continue;
      }
      const scalar = /^([a-z_]+) (.+)$/.exec(content);
      if (scalar === null) {
        diagnostics.push(
          diagnostic(
            "PTDSL-004",
            "field syntaxが不正です",
            lineSpan(line),
            `syntax.${header.kind}`,
            header.id,
          ),
        );
        index += 1;
        continue;
      }
      const name = scalar[1]!;
      const rawValue = scalar[2]!;
      const nameStart = 2;
      const valueStart = line.text.indexOf(rawValue, nameStart + name.length);
      const valueSpan = span(line, valueStart, valueStart + rawValue.length);
      if (!allowedFields[header.kind].has(name)) {
        diagnostics.push(
          diagnostic(
            "PTDSL-005",
            `${header.kind}にunknown field ${name}があります`,
            span(line, nameStart, nameStart + name.length),
            `syntax.${header.kind}`,
            header.id,
          ),
        );
        index += 1;
        if (rawValue === "|") index = skipIndentedRegion(lines, index, 2);
        continue;
      }
      const parsed = scalarFieldValue(name, rawValue);
      if (parsed.code !== undefined) {
        diagnostics.push(
          diagnostic(
            parsed.code,
            `${name}の値が不正です`,
            valueSpan,
            parsed.topic ?? "syntax",
            header.id,
          ),
        );
      }
      fields.push({
        name,
        rawValue,
        value: parsed.value,
        span: lineSpan(line),
        valueSpan,
      });
      declarationEnd = lineSpan(line);
      index += 1;
    }
    declarations.push({
      ...header,
      fields,
      span: joinSpan(header.headerSpan, declarationEnd),
    });
  }
  const document: DocumentNode = { text, declarations, trivia };
  const sortedDiagnostics = sortDiagnostics(diagnostics);
  const limited = limitDiagnostics(sortedDiagnostics, maxDiagnostics);
  return {
    document,
    diagnostics: limited.diagnostics,
    diagnosticCounts: countDiagnostics(sortedDiagnostics),
    diagnosticsTruncated: limited.truncated,
  };
}
