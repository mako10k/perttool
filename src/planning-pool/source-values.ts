import {
  canonicalizeEventDateTimeSourceToken,
  parseDeclaredCalendarValue,
  type DeclaredCalendarValue,
} from "../model/calendar.js";
import {
  canonicalizeExactDurationSourceToken,
  parseExactDurationSourceToken,
} from "../model/exact-duration-source.js";
import { compare, rational, type Rational } from "../model/rational.js";
import { splitTagItems } from "../parser/document-parser.js";
import {
  sourceSliceSpan,
  type TemporalSourceLine,
} from "../temporal-schedule/source-lexical.js";
import { parseTemporalInstant } from "../temporal-schedule/source-values.js";
import type {
  PlanningDescriptionSource,
  PlanningDurationSource,
  PlanningWhenSource,
} from "./source-types.js";
import type { PlanningFieldBlock } from "./source-lexical.js";

export const planningIdentifierPattern = /^[A-Za-z][A-Za-z0-9_-]*$/u;

export function parsePlanningString(value: string): string | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function parsePlanningTags(value: string): readonly string[] | null {
  const parsed = splitTagItems(value);
  return parsed === undefined ? null : Object.freeze(parsed);
}

export function parsePlanningInteger(value: string): number | null {
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= 2_147_483_647
    ? parsed
    : null;
}

function blockDescription(field: PlanningFieldBlock): PlanningDescriptionSource | null {
  const content = field.children.filter((line) => line.text.trim() !== "");
  if (content.length === 0) return null;
  const indents = content.map((line) => /^ */u.exec(line.text)![0].length);
  const indent = Math.min(...indents);
  if (indent < 4 || content.some((line) => line.text.includes("\t"))) return null;
  const value = field.children.map((line) =>
    line.text.trim() === "" ? "" : line.text.slice(indent)).join("\n");
  if (value.length === 0) return null;
  const first = content[0]!;
  const last = content.at(-1)!;
  return Object.freeze({
    value,
    style: "block" as const,
    span: field.span,
    contentSpan: Object.freeze({
      start: sourceSliceSpan(first, indent, indent).start,
      end: sourceSliceSpan(last, last.text.length, last.text.length).end,
    }),
  });
}

export function parsePlanningDescription(
  field: PlanningFieldBlock,
): PlanningDescriptionSource | null {
  if (field.blockStyle || field.rawValue === "|") {
    return blockDescription(field);
  }
  const value = parsePlanningString(field.rawValue);
  return value === null || value.length === 0
    ? null
    : Object.freeze({
        value,
        style: "quoted" as const,
        span: field.span,
        contentSpan: field.valueSpan,
      });
}

export function parsePlanningDuration(
  value: string,
  span: PlanningDurationSource["span"],
): PlanningDurationSource | null {
  const parsed = parseExactDurationSourceToken(value);
  if (parsed === null || parsed.value.numerator <= 0n) return null;
  return Object.freeze({
    sourceText: value,
    value: parsed.value,
    unit: parsed.unit,
    span,
  });
}

export function canonicalPlanningDuration(value: string): string | null {
  return canonicalizeExactDurationSourceToken(value)?.token ?? null;
}

export function parsePlanningWhen(
  value: string,
  line: TemporalSourceLine,
): PlanningWhenSource | null {
  const match = /^(start|finish) (earliest|latest) (.+)$/u.exec(value);
  if (match === null) return null;
  const instant = match[3]!;
  const parsed = parseTemporalInstant(instant, line, line.text.lastIndexOf(instant));
  if (parsed === null) return null;
  return Object.freeze({
    event: match[1] as "start" | "finish",
    direction: match[2] as "earliest" | "latest",
    value: parsed,
    span: sourceSliceSpan(line, 0, line.text.length),
  });
}

function seconds(value: DeclaredCalendarValue & { readonly kind: "date_time" }): Rational {
  const whole = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    0,
  ) / 1_000 - value.offsetMinutes * 60;
  return rational(
    BigInt(whole) * value.second.denominator + value.second.numerator,
    value.second.denominator,
  );
}

export function comparePlanningCalendarValues(
  left: DeclaredCalendarValue,
  right: DeclaredCalendarValue,
): number | null {
  if (left.kind !== right.kind) return null;
  if (left.kind === "date" && right.kind === "date") {
    return left.sourceText.localeCompare(right.sourceText, "en");
  }
  return left.kind === "date_time" && right.kind === "date_time"
    ? compare(seconds(left), seconds(right))
    : null;
}

export function canonicalPlanningCalendar(value: string): string | null {
  const parsed = parseDeclaredCalendarValue(value);
  if (parsed === undefined) return null;
  return parsed.kind === "date"
    ? parsed.sourceText
    : canonicalizeEventDateTimeSourceToken(parsed.sourceText);
}

export function canonicalPlanningTags(values: readonly string[]): string {
  return `[${values.map((value) =>
    planningIdentifierPattern.test(value) ? value : JSON.stringify(value)).join(", ")}]`;
}
