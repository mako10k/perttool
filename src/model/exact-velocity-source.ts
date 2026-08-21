import {
  parseExactDurationSourceToken,
} from "./exact-duration-source.js";
import { divide, rational } from "./rational.js";
import type { Rational } from "./rational.js";
import type { CalendarUnit } from "./units.js";
import { durationSuffix } from "./units.js";

export interface ParsedExactVelocitySourceToken {
  readonly token: string;
  readonly points: Rational;
  readonly period: Rational;
  readonly periodUnit: CalendarUnit;
  readonly rate: Rational | null;
}

export function parseExactVelocitySourceToken(
  source: string,
): ParsedExactVelocitySourceToken | null {
  const match = /^(.+p)\/(.+[dh])$/.exec(source);
  if (match === null) return null;
  const points = parseExactDurationSourceToken(match[1]!);
  const period = parseExactDurationSourceToken(match[2]!);
  if (
    points?.unit !== "point" ||
    (period?.unit !== "day" && period?.unit !== "hour") ||
    points.value.numerator < 0n ||
    period.value.numerator < 0n
  ) {
    return null;
  }
  return {
    token: source,
    points: points.value,
    period: period.value,
    periodUnit: period.unit,
    rate: period.value.numerator === 0n
      ? null
      : divide(points.value, period.value),
  };
}

export function serializeCanonicalVelocitySourceToken(
  rate: Rational,
  periodUnit: CalendarUnit,
): string | null {
  if (rate.numerator <= 0n) return null;
  const normalized = rational(rate.numerator, rate.denominator);
  return `${normalized.numerator}p/${normalized.denominator}${
    durationSuffix(periodUnit)
  }`;
}

export function canonicalizeExactVelocitySourceToken(
  source: string,
): string | null {
  const parsed = parseExactVelocitySourceToken(source);
  return parsed === null || parsed.rate === null
    ? null
    : serializeCanonicalVelocitySourceToken(parsed.rate, parsed.periodUnit);
}
