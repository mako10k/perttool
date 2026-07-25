import type { Rational } from "./rational.js";
import { rational } from "./rational.js";

export interface DeclaredCalendarDate {
  readonly kind: "date";
  readonly sourceText: string;
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface DeclaredCalendarDateTime {
  readonly kind: "date_time";
  readonly sourceText: string;
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: Rational;
  readonly offsetMinutes: number;
}

export type DeclaredCalendarValue =
  | DeclaredCalendarDate
  | DeclaredCalendarDateTime;

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

function validDate(year: number, month: number, day: number): boolean {
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

function exactSecond(whole: string, fraction: string | undefined): Rational {
  if (fraction === undefined) return rational(BigInt(whole));
  const denominator = 10n ** BigInt(fraction.length);
  return rational(BigInt(whole) * denominator + BigInt(fraction), denominator);
}

export function parseDeclaredCalendarValue(
  sourceText: string,
): DeclaredCalendarValue | undefined {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sourceText);
  if (dateMatch !== null) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    if (!validDate(year, month, day)) return undefined;
    return {
      kind: "date",
      sourceText,
      year,
      month,
      day,
    };
  }

  const dateTimeMatch =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
      sourceText,
    );
  if (dateTimeMatch === null) return undefined;

  const year = Number(dateTimeMatch[1]);
  const month = Number(dateTimeMatch[2]);
  const day = Number(dateTimeMatch[3]);
  const hour = Number(dateTimeMatch[4]);
  const minute = Number(dateTimeMatch[5]);
  const secondWhole = Number(dateTimeMatch[6]);
  const offsetHour = dateTimeMatch[9] === undefined
    ? 0
    : Number(dateTimeMatch[10]);
  const offsetMinute = dateTimeMatch[9] === undefined
    ? 0
    : Number(dateTimeMatch[11]);

  if (
    !validDate(year, month, day) ||
    hour > 23 ||
    minute > 59 ||
    secondWhole > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return undefined;
  }

  const offsetSign = dateTimeMatch[9] === "-" ? -1 : 1;
  const offsetMagnitude = offsetHour * 60 + offsetMinute;
  return {
    kind: "date_time",
    sourceText,
    year,
    month,
    day,
    hour,
    minute,
    second: exactSecond(dateTimeMatch[6]!, dateTimeMatch[7]),
    offsetMinutes: offsetMagnitude === 0 ? 0 : offsetSign * offsetMagnitude,
  };
}
