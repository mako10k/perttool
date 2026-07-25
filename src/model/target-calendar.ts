import {
  parseDeclaredCalendarValue,
  type DeclaredCalendarValue,
} from "./calendar.js";

export interface TargetExactFraction {
  readonly numerator: string;
  readonly denominator: string;
}

export interface TargetCalendarDate {
  readonly kind: "date";
  readonly sourceText: string | null;
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface TargetCalendarDateTime {
  readonly kind: "date_time";
  readonly sourceText: string | null;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: TargetExactFraction;
  readonly offsetMinutes: number;
}

export type TargetCalendarValue =
  | TargetCalendarDate
  | TargetCalendarDateTime;

function isDeclaredCalendarValue(
  value: unknown,
): value is DeclaredCalendarValue {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  const hasDate = (
    typeof candidate["sourceText"] === "string" &&
    Number.isInteger(candidate["year"]) &&
    Number.isInteger(candidate["month"]) &&
    Number.isInteger(candidate["day"])
  );
  if (candidate["kind"] === "date") return hasDate;
  if (candidate["kind"] !== "date_time") return false;
  const second = candidate["second"];
  return (
    hasDate &&
    Number.isInteger(candidate["hour"]) &&
    Number.isInteger(candidate["minute"]) &&
    Number.isInteger(candidate["offsetMinutes"]) &&
    second !== null &&
    typeof second === "object" &&
    typeof (second as Readonly<Record<string, unknown>>)["numerator"] === "bigint" &&
    typeof (second as Readonly<Record<string, unknown>>)["denominator"] === "bigint"
  );
}

export function projectDeclaredCalendarValue(
  value: unknown,
): TargetCalendarValue | null {
  const declared = typeof value === "string"
    ? parseDeclaredCalendarValue(value)
    : isDeclaredCalendarValue(value)
      ? value
      : undefined;
  if (declared === undefined) return null;
  if (declared.kind === "date") {
    return {
      kind: "date",
      sourceText: declared.sourceText,
      year: declared.year,
      month: declared.month,
      day: declared.day,
    };
  }
  return {
    kind: "date_time",
    sourceText: declared.sourceText,
    year: declared.year,
    month: declared.month,
    day: declared.day,
    hour: declared.hour,
    minute: declared.minute,
    second: {
      numerator: declared.second.numerator.toString(),
      denominator: declared.second.denominator.toString(),
    },
    offsetMinutes: declared.offsetMinutes,
  };
}
