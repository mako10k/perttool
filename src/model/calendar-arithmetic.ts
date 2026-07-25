import type { DeclaredCalendarValue } from "./calendar.js";
import type { Rational } from "./rational.js";
import { add, compare, multiply, rational, subtract } from "./rational.js";

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
