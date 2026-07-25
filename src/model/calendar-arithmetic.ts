import type { DeclaredCalendarValue } from "./calendar.js";
import type { Rational } from "./rational.js";
import { add, compare, multiply, rational, subtract } from "./rational.js";
import type { TargetCalendarValue } from "./target-calendar.js";
import type { CalendarUnit } from "./units.js";

export const CALENDAR_ARITHMETIC_IDENTITY = Object.freeze({
  id: "perttool.calendar-projection" as const,
  version: 1 as const,
  profileId: "perttool.calendar.continuous-fixed-offset" as const,
  profileVersion: 1 as const,
});

export type CalendarUnavailableCause =
  | "missing_temporal_anchor"
  | "incomparable_temporal_kinds"
  | "date_anchor_has_no_clock"
  | "fractional_date_projection"
  | "calendar_range_overflow"
  | "exact_datetime_text_unavailable";

export interface CalendarDifference {
  readonly kind: "calendar_days" | "si_seconds";
  readonly exact: Rational;
}

export interface UnavailableCalendarRelationship {
  readonly state: "unavailable";
  readonly difference: null;
  readonly cause: CalendarUnavailableCause;
}

export interface AvailableCalendarRelationship {
  readonly state: "available";
  readonly difference: CalendarDifference;
  readonly cause: null;
}

export type CalendarRelationship =
  | UnavailableCalendarRelationship
  | AvailableCalendarRelationship;

export interface AvailableProjectedCalendarValue {
  readonly state: "available";
  readonly value: TargetCalendarValue;
  readonly unavailableCauses: readonly CalendarUnavailableCause[];
}

export interface UnavailableProjectedCalendarValue {
  readonly state: "unavailable";
  readonly value: null;
  readonly unavailableCauses: readonly CalendarUnavailableCause[];
}

export type ProjectedCalendarValue =
  | AvailableProjectedCalendarValue
  | UnavailableProjectedCalendarValue;

function leapYearsBefore(year: number): number {
  return (
    Math.floor((year + 3) / 4) -
    Math.floor((year + 99) / 100) +
    Math.floor((year + 399) / 400)
  );
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

const monthOffsets = Object.freeze([
  0,
  31,
  59,
  90,
  120,
  151,
  181,
  212,
  243,
  273,
  304,
  334,
]);

export function civilDayNumber(
  value: Pick<DeclaredCalendarValue, "year" | "month" | "day">,
): bigint {
  const beforeMonth = monthOffsets[value.month - 1]!;
  const leapAdjustment = value.month > 2 && isLeapYear(value.year) ? 1 : 0;
  return (
    BigInt(value.year * 365 + leapYearsBefore(value.year)) +
    BigInt(beforeMonth + leapAdjustment + value.day - 1)
  );
}

export function instantKey(
  value: Extract<DeclaredCalendarValue, { readonly kind: "date_time" }>,
): Rational {
  const wholeSeconds =
    civilDayNumber(value) * 86_400n +
    BigInt(value.hour * 3_600 + value.minute * 60) -
    BigInt(value.offsetMinutes * 60);
  return add(rational(wholeSeconds), value.second);
}

export function compareCalendarValues(
  left: DeclaredCalendarValue,
  right: DeclaredCalendarValue,
): "less" | "equal" | "greater" | "incomparable_temporal_kinds" {
  if (left.kind !== right.kind) return "incomparable_temporal_kinds";
  const order = left.kind === "date"
    ? compare(rational(civilDayNumber(left)), rational(civilDayNumber(right)))
    : compare(instantKey(left), instantKey(
        right as Extract<DeclaredCalendarValue, { readonly kind: "date_time" }>,
      ));
  return order < 0 ? "less" : order > 0 ? "greater" : "equal";
}

export function subtractCalendarValues(
  left: DeclaredCalendarValue,
  right: DeclaredCalendarValue,
): CalendarRelationship {
  if (left.kind !== right.kind) {
    return Object.freeze({
      state: "unavailable",
      difference: null,
      cause: "incomparable_temporal_kinds",
    });
  }
  const difference = left.kind === "date"
    ? {
        kind: "calendar_days" as const,
        exact: subtract(
          rational(civilDayNumber(left)),
          rational(civilDayNumber(right)),
        ),
      }
    : {
        kind: "si_seconds" as const,
        exact: subtract(
          instantKey(left),
          instantKey(
            right as Extract<
              DeclaredCalendarValue,
              { readonly kind: "date_time" }
            >,
          ),
        ),
      };
  return Object.freeze({
    state: "available",
    difference: Object.freeze(difference),
    cause: null,
  });
}

export function scaleCalendarDifference(
  difference: CalendarDifference,
  scalar: Rational,
): CalendarDifference {
  return Object.freeze({
    kind: difference.kind,
    exact: multiply(difference.exact, scalar),
  });
}

function floorRational(value: Rational): bigint {
  const quotient = value.numerator / value.denominator;
  const remainder = value.numerator % value.denominator;
  return value.numerator < 0n && remainder !== 0n
    ? quotient - 1n
    : quotient;
}

function dateFromCivilDayNumber(
  dayNumber: bigint,
): { readonly year: number; readonly month: number; readonly day: number } | null {
  const maximumDay = civilDayNumber({ year: 9999, month: 12, day: 31 });
  if (dayNumber < 0n || dayNumber > maximumDay) return null;
  let lower = 0;
  let upper = 10_000;
  while (lower + 1 < upper) {
    const middle = Math.floor((lower + upper) / 2);
    const firstDay = civilDayNumber({ year: middle, month: 1, day: 1 });
    if (firstDay <= dayNumber) lower = middle;
    else upper = middle;
  }
  const year = lower;
  const dayOfYear = Number(
    dayNumber - civilDayNumber({ year, month: 1, day: 1 }),
  );
  let month = 1;
  while (month < 12) {
    const nextMonth = civilDayNumber({ year, month: month + 1, day: 1 });
    if (nextMonth > dayNumber) break;
    month += 1;
  }
  const day = Number(
    dayNumber - civilDayNumber({ year, month, day: 1 }) + 1n,
  );
  if (dayOfYear < 0) return null;
  return { year, month, day };
}

function finiteDecimal(value: Rational): string | null {
  let denominator = value.denominator;
  let twos = 0;
  let fives = 0;
  while (denominator % 2n === 0n) {
    denominator /= 2n;
    twos += 1;
  }
  while (denominator % 5n === 0n) {
    denominator /= 5n;
    fives += 1;
  }
  if (denominator !== 1n) return null;
  const scale = Math.max(twos, fives);
  const scaled = value.numerator *
    2n ** BigInt(scale - twos) *
    5n ** BigInt(scale - fives);
  if (scale === 0) return scaled.toString();
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled)
    .toString()
    .padStart(scale + 1, "0");
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${
    fraction.length === 0 ? "" : `.${fraction}`
  }`;
}

function pad(value: number, width = 2): string {
  return value.toString().padStart(width, "0");
}

function normalizedDateTimeText(
  value: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
    readonly hour: number;
    readonly minute: number;
    readonly second: Rational;
    readonly offsetMinutes: number;
  },
): string | null {
  const second = finiteDecimal(value.second);
  if (second === null) return null;
  const [whole, fraction] = second.split(".");
  const offset = value.offsetMinutes === 0
    ? "Z"
    : `${value.offsetMinutes < 0 ? "-" : "+"}${
        pad(Math.floor(Math.abs(value.offsetMinutes) / 60))
      }:${pad(Math.abs(value.offsetMinutes) % 60)}`;
  return `${pad(value.year, 4)}-${pad(value.month)}-${pad(value.day)}T${
    pad(value.hour)
  }:${pad(value.minute)}:${pad(Number(whole))}${
    fraction === undefined ? "" : `.${fraction}`
  }${offset}`;
}

export function projectRelativeCalendarValue(
  anchor: DeclaredCalendarValue,
  effectiveUnit: CalendarUnit,
  relative: Rational,
): ProjectedCalendarValue {
  if (anchor.kind === "date") {
    if (effectiveUnit === "hour") {
      return Object.freeze({
        state: "unavailable",
        value: null,
        unavailableCauses: Object.freeze([
          "date_anchor_has_no_clock",
        ] as const),
      });
    }
    if (relative.denominator !== 1n) {
      return Object.freeze({
        state: "unavailable",
        value: null,
        unavailableCauses: Object.freeze([
          "fractional_date_projection",
        ] as const),
      });
    }
    const projected = dateFromCivilDayNumber(
      civilDayNumber(anchor) + relative.numerator,
    );
    if (projected === null) {
      return Object.freeze({
        state: "unavailable",
        value: null,
        unavailableCauses: Object.freeze(["calendar_range_overflow"] as const),
      });
    }
    return Object.freeze({
      state: "available",
      value: Object.freeze({
        kind: "date",
        sourceText: `${pad(projected.year, 4)}-${pad(projected.month)}-${
          pad(projected.day)
        }`,
        ...projected,
      }),
      unavailableCauses: Object.freeze([]),
    });
  }

  const scalar = rational(effectiveUnit === "day" ? 86_400n : 3_600n);
  const projectedInstant = add(
    instantKey(anchor),
    multiply(relative, scalar),
  );
  const localSeconds = add(
    projectedInstant,
    rational(BigInt(anchor.offsetMinutes * 60)),
  );
  const dayNumber = floorRational(
    rational(localSeconds.numerator, localSeconds.denominator * 86_400n),
  );
  const projected = dateFromCivilDayNumber(dayNumber);
  if (projected === null) {
    return Object.freeze({
      state: "unavailable",
      value: null,
      unavailableCauses: Object.freeze(["calendar_range_overflow"] as const),
    });
  }
  let secondOfDay = subtract(
    localSeconds,
    rational(dayNumber * 86_400n),
  );
  const hour = Number(floorRational(
    rational(secondOfDay.numerator, secondOfDay.denominator * 3_600n),
  ));
  secondOfDay = subtract(secondOfDay, rational(BigInt(hour * 3_600)));
  const minute = Number(floorRational(
    rational(secondOfDay.numerator, secondOfDay.denominator * 60n),
  ));
  const second = subtract(secondOfDay, rational(BigInt(minute * 60)));
  const text = normalizedDateTimeText({
    ...projected,
    hour,
    minute,
    second,
    offsetMinutes: anchor.offsetMinutes,
  });
  return Object.freeze({
    state: "available",
    value: Object.freeze({
      kind: "date_time",
      sourceText: text,
      ...projected,
      hour,
      minute,
      second: Object.freeze({
        numerator: second.numerator.toString(),
        denominator: second.denominator.toString(),
      }),
      offsetMinutes: anchor.offsetMinutes,
    }),
    unavailableCauses: text === null
      ? Object.freeze(["exact_datetime_text_unavailable"] as const)
      : Object.freeze([]),
  });
}
