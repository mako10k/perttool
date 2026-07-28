import { checkDocument, type CheckOptions } from "../application/check.js";
import type { Diagnostic } from "../model/diagnostics.js";
import {
  canonicalizeEventDateTimeSourceToken,
} from "../model/calendar.js";
import {
  canonicalizeExactPersonHoursSourceToken,
} from "../model/exact-person-hours-source.js";
import {
  TARGET_GRAMMAR_4_DECLARATION_FIELD_ORDER,
} from "../model/declaration-fields.js";
import type {
  DeclarationKind,
  DocumentNode,
  DurationFractionValue,
  DurationValue,
  ExactDurationValue,
  ExactPersonHoursValue,
  FieldNode,
  PersonHoursFractionValue,
  PersonHoursValue,
  RequirementValue,
  TargetDeclarationKind,
  VelocityValue,
} from "../model/syntax.js";
import {
  serializeExactDurationSource,
} from "../model/exact-duration-source.js";
import { rational } from "../model/rational.js";
import {
  applyTextEdits,
  normalizeTextEdits,
  type TextEdit,
} from "../mutation/text-edits.js";
export type { TextEdit } from "../mutation/text-edits.js";

export interface FormatOptions extends CheckOptions {}

export interface FormatResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly formattedText: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface FormatValidation {
  readonly ok: boolean;
  readonly document: DocumentNode<TargetDeclarationKind> | null;
  readonly documentId: string | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface SourceFormatProfile {
  readonly fieldOrder:
    Readonly<Record<DeclarationKind, readonly string[]>>
    & Partial<Readonly<Record<"work_event", readonly string[]>>>;
}

interface PhysicalLine {
  readonly text: string;
  readonly start: number;
  readonly end: number;
  readonly line: number;
}

const bareTagPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;

function splitPhysicalLines(text: string): readonly PhysicalLine[] {
  if (text.length === 0) return [];
  const lines: PhysicalLine[] = [];
  let start = 0;
  let line = 0;
  while (start < text.length) {
    const newline = text.indexOf("\n", start);
    const rawEnd = newline === -1 ? text.length : newline;
    const end = rawEnd > start && text[rawEnd - 1] === "\r" ? rawEnd - 1 : rawEnd;
    lines.push({ text: text.slice(start, end), start, end, line });
    if (newline === -1) break;
    start = newline + 1;
    line += 1;
  }
  return lines;
}

function majorLineEnding(text: string): "\n" | "\r\n" {
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
  if (crlf === lf) return first ?? "\n";
  return crlf > lf ? "\r\n" : "\n";
}

function canonicalDecimal(value: DurationValue): string {
  const digits = value.digits.toString().padStart(value.scale + 1, "0");
  const wholeEnd = digits.length - value.scale;
  const whole = digits.slice(0, wholeEnd).replace(/^0+(?=\d)/, "");
  const fraction = digits.slice(wholeEnd).replace(/0+$/, "");
  return fraction === "" ? whole : `${whole}.${fraction}`;
}

function canonicalDuration(value: ExactDurationValue): string {
  if ("numerator" in value) {
    return serializeExactDurationSource(
      { numerator: value.numerator, denominator: value.denominator },
      value.suffix === "d"
        ? "day"
        : value.suffix === "h"
          ? "hour"
          : "point",
    ).token;
  }
  return `${canonicalDecimal(value)}${value.suffix}`;
}

function isDurationValue(value: unknown): value is DurationValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "digits" in value &&
    typeof value.digits === "bigint" &&
    "scale" in value &&
    typeof value.scale === "number" &&
    "suffix" in value &&
    (value.suffix === "d" || value.suffix === "h" || value.suffix === "p")
  );
}

function isDurationFractionValue(
  value: unknown,
): value is DurationFractionValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "numerator" in value &&
    typeof value.numerator === "bigint" &&
    "denominator" in value &&
    typeof value.denominator === "bigint" &&
    value.denominator > 0n &&
    "suffix" in value &&
    (value.suffix === "d" || value.suffix === "h" || value.suffix === "p")
  );
}

function isExactDurationValue(value: unknown): value is ExactDurationValue {
  return isDurationValue(value) || isDurationFractionValue(value);
}

function isPersonHoursValue(value: unknown): value is PersonHoursValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "digits" in value &&
    typeof value.digits === "bigint" &&
    "scale" in value &&
    typeof value.scale === "number" &&
    "suffix" in value &&
    value.suffix === "ph"
  );
}

function isPersonHoursFractionValue(
  value: unknown,
): value is PersonHoursFractionValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "numerator" in value &&
    typeof value.numerator === "bigint" &&
    "denominator" in value &&
    typeof value.denominator === "bigint" &&
    value.denominator > 0n &&
    "suffix" in value &&
    value.suffix === "ph"
  );
}

function canonicalPersonHours(value: ExactPersonHoursValue): string {
  const canonical = canonicalizeExactPersonHoursSourceToken(value.text);
  if (canonical === null) {
    throw new Error("validated person-hours value is not canonicalizable");
  }
  return canonical;
}

function isVelocityValue(value: unknown): value is VelocityValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "points" in value &&
    isDurationValue(value.points) &&
    value.points.suffix === "p" &&
    "period" in value &&
    isDurationValue(value.period) &&
    (value.period.suffix === "d" || value.period.suffix === "h")
  );
}

function canonicalFieldValue(field: FieldNode): string | undefined {
  if (["title", "description", "owner", "source", "blocked_reason", "reason"].includes(field.name)) {
    return typeof field.value === "string" ? JSON.stringify(field.value) : undefined;
  }
  if (["version", "capacity", "priority", "model"].includes(field.name)) {
    return typeof field.value === "number" ? String(field.value) : undefined;
  }
  if (
    [
      "duration",
      "critical_epsilon",
      "target_duration",
      "optimistic",
      "most_likely",
      "pessimistic",
      "planned_value",
      "active_time",
    ].includes(field.name)
  ) {
    return isExactDurationValue(field.value)
      ? canonicalDuration(field.value)
      : undefined;
  }
  if (
    field.name === "effort" &&
    (
      isPersonHoursValue(field.value) ||
      isPersonHoursFractionValue(field.value)
    )
  ) {
    return canonicalPersonHours(field.value);
  }
  if (field.name === "occurred_at" && typeof field.rawValue === "string") {
    return canonicalizeEventDateTimeSourceToken(field.rawValue) ?? undefined;
  }
  if (field.name === "velocity") {
    return isVelocityValue(field.value)
      ? `${canonicalDuration(field.value.points)}/${canonicalDuration(field.value.period)}`
      : undefined;
  }
  if (field.name === "tags" && Array.isArray(field.value)) {
    const tags = field.value.filter((value): value is string => typeof value === "string");
    if (tags.length !== field.value.length) return undefined;
    return `[${tags.map((tag) => (bareTagPattern.test(tag) ? tag : JSON.stringify(tag))).join(", ")}]`;
  }
  if (
    (field.name === "goal_owner" || field.name === "dag_owner") &&
    typeof field.value === "string"
  ) {
    return field.value;
  }
  if (
    (field.name === "goal_delegates" || field.name === "dag_delegates") &&
    Array.isArray(field.value)
  ) {
    const principals = field.value.filter(
      (value): value is string => typeof value === "string",
    );
    return principals.length === field.value.length
      ? `[${principals.join(", ")}]`
      : undefined;
  }
  return field.rawValue === "" ? undefined : field.rawValue;
}

function requirementValues(field: FieldNode): readonly RequirementValue[] {
  if (field.name !== "requires" || !Array.isArray(field.value)) return [];
  return field.value.filter(
    (value): value is RequirementValue =>
      typeof value === "object" &&
      value !== null &&
      "units" in value &&
      typeof value.units === "number" &&
      "unitsSpan" in value,
  );
}

function pushEdit(edits: TextEdit[], text: string, edit: TextEdit): void {
  if (text.slice(edit.startOffset, edit.endOffset) !== edit.replacement) edits.push(edit);
}

export function formatValidatedSource(
  text: string,
  checked: FormatValidation,
  validateCandidate: (candidate: string) => FormatValidation,
  profile: SourceFormatProfile,
): FormatResult {
  if (!checked.ok || checked.document === null) {
    return {
      ok: false,
      documentId: checked.documentId,
      changed: false,
      formattedText: null,
      edits: [],
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  }

  const lines = splitPhysicalLines(text);
  const lineEnding = majorLineEnding(text);
  const edits: TextEdit[] = [];

  for (const declaration of checked.document.declarations) {
    const knownFields = new Set(
      profile.fieldOrder[declaration.kind] ?? [],
    );
    pushEdit(edits, text, {
      startOffset: declaration.headerSpan.start.offset,
      endOffset: declaration.headerSpan.end.offset,
      replacement:
        declaration.kind === "task" || declaration.kind === "gate"
          ? `${declaration.kind} ${declaration.id} ${declaration.from!} -> ${declaration.to!}:`
          : `${declaration.kind} ${declaration.id}:`,
    });

    for (const field of declaration.fields) {
      if (!knownFields.has(field.name)) {
        throw new Error(
          `formatter profile does not define ${declaration.kind}.${field.name}`,
        );
      }
      const fieldLine = lines[field.span.start.line]!;
      if (field.contentSpan !== undefined && typeof field.value === "string") {
        const firstLine = lines[field.contentSpan.start.line]!;
        const lastLine = lines[field.contentSpan.end.line]!;
        const decodedLines = field.value.split("\n");
        const physicalLines = lines.slice(firstLine.line, lastLine.line + 1);
        if (decodedLines.length !== physicalLines.length) {
          throw new Error("block text decoded line count does not match its source span");
        }
        pushEdit(edits, text, {
          startOffset: fieldLine.start,
          endOffset: fieldLine.end,
          replacement: `  ${field.name} |`,
        });
        const replacement = decodedLines
          .map((decoded, index) =>
            decoded === "" ? physicalLines[index]!.text : `    ${decoded}`,
          )
          .join(lineEnding);
        pushEdit(edits, text, {
          startOffset: firstLine.start,
          endOffset: lastLine.end,
          replacement,
        });
      } else if (field.children !== undefined || field.name === "requires") {
        pushEdit(edits, text, {
          startOffset: fieldLine.start,
          endOffset: fieldLine.end,
          replacement: `  ${field.name}:`,
        });
      } else {
        const replacement = canonicalFieldValue(field);
        if (replacement !== undefined) {
          pushEdit(edits, text, {
            startOffset: fieldLine.start,
            endOffset: fieldLine.end,
            replacement: `  ${field.name} ${replacement}`,
          });
        }
      }

      for (const child of field.children ?? []) {
        const replacement = canonicalFieldValue(child);
        if (replacement !== undefined) {
          const childLine = lines[child.span.start.line]!;
          pushEdit(edits, text, {
            startOffset: childLine.start,
            endOffset: childLine.end,
            replacement: `    ${child.name} ${replacement}`,
          });
        }
      }
      for (const requirement of requirementValues(field)) {
        const requirementLine = lines[requirement.span.start.line]!;
        pushEdit(edits, text, {
          startOffset: requirementLine.start,
          endOffset: requirementLine.end,
          replacement: `    ${requirement.resourceId} ${requirement.units}`,
        });
      }
    }
  }

  if (!text.endsWith("\n")) {
    edits.push({ startOffset: text.length, endOffset: text.length, replacement: lineEnding });
  }

  const normalizedEdits = normalizeTextEdits(text, edits, "formatter");
  const formattedText = applyTextEdits(text, normalizedEdits);
  const candidate = validateCandidate(formattedText);
  if (!candidate.ok || candidate.document === null) {
    throw new Error("formatter produced an invalid candidate document");
  }
  return {
    ok: true,
    documentId: candidate.documentId,
    changed: formattedText !== text,
    formattedText,
    edits: normalizedEdits,
    diagnostics: candidate.diagnostics,
    diagnosticsTruncated: candidate.diagnosticsTruncated,
  };
}

function activeValidation(
  text: string,
  options: FormatOptions,
): FormatValidation {
  const checked = checkDocument(text, options);
  return {
    ok: checked.ok,
    document: checked.ok ? checked.document : null,
    documentId: checked.documentId,
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  };
}

export function formatDocument(text: string, options: FormatOptions = {}): FormatResult {
  return formatValidatedSource(
    text,
    activeValidation(text, options),
    (candidate) => activeValidation(candidate, options),
    { fieldOrder: TARGET_GRAMMAR_4_DECLARATION_FIELD_ORDER },
  );
}
