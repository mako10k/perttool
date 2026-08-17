import {
  canonicalizeEventDateTimeSourceToken,
  parseDeclaredCalendarValue,
  parseEventDateTimeValue,
} from "../model/calendar.js";
import {
  canonicalizeExactDurationSourceToken,
} from "../model/exact-duration-source.js";
import { add, compare, rational, type Rational } from "../model/rational.js";
import type {
  CalendarWindowSource,
  TemporalInstantSource,
} from "./source-types.js";
import {
  sourceSliceSpan,
  type TemporalSourceLine,
} from "./source-lexical.js";
import {
  TZDB_2026C_RANGE,
  TZDB_2026C_TRANSITIONS,
} from "./tzdb-2026c.js";

export const TEMPORAL_TZDB_RELEASE = "2026c" as const;

export function parseQuotedString(value: string): string | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function epochSeconds(value: ReturnType<typeof parseEventDateTimeValue>): Rational {
  if (value === undefined) throw new Error("date-time is required");
  const minuteEpoch = Date.UTC(
    value.year,
    value.month - 1,
    value.day,
    value.hour,
    value.minute,
    0,
  ) / 1000 - value.offsetMinutes * 60;
  return add(rational(BigInt(minuteEpoch)), value.second);
}

export function parseTemporalInstant(
  value: string,
  line: TemporalSourceLine,
  column: number,
): TemporalInstantSource | null {
  const parsed = parseEventDateTimeValue(value);
  if (parsed === undefined) return null;
  return Object.freeze({
    sourceText: value,
    instantSeconds: epochSeconds(parsed),
    offsetMinutes: parsed.offsetMinutes,
    span: sourceSliceSpan(line, column, column + value.length),
  });
}

export function canonicalInstant(value: TemporalInstantSource): string {
  const canonical = canonicalizeEventDateTimeSourceToken(value.sourceText);
  if (canonical === null) throw new Error("validated instant lost canonical source");
  return canonical;
}

export function compareInstants(
  left: TemporalInstantSource,
  right: TemporalInstantSource,
): number {
  return compare(left.instantSeconds, right.instantSeconds);
}

function clockMinute(value: string, allowEndOfDay: boolean): number | null {
  if (allowEndOfDay && value === "24:00") return 24 * 60;
  const match = /^(\d{2}):(\d{2})$/u.exec(value);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

export function parseCalendarWindows(
  value: string,
  line: TemporalSourceLine,
  column: number,
): readonly CalendarWindowSource[] | null {
  if (value === "off") return Object.freeze([]);
  const result: CalendarWindowSource[] = [];
  let cursor = 0;
  for (const rawPart of value.split(",")) {
    const leading = /^\s*/u.exec(rawPart)![0].length;
    const trailing = /\s*$/u.exec(rawPart)![0].length;
    const part = rawPart.slice(leading, rawPart.length - trailing);
    const match = /^(\d{2}:\d{2})\.\.(\d{2}:\d{2}|24:00)$/u.exec(part);
    if (match === null) return null;
    const start = clockMinute(match[1]!, false);
    const end = clockMinute(match[2]!, true);
    if (start === null || end === null || start >= end) return null;
    const partStart = column + cursor + leading;
    result.push(Object.freeze({
      startMinute: start,
      endMinute: end,
      span: sourceSliceSpan(line, partStart, partStart + part.length),
    }));
    cursor += rawPart.length + 1;
  }
  for (let index = 1; index < result.length; index += 1) {
    if (result[index - 1]!.endMinute >= result[index]!.startMinute) return null;
  }
  return Object.freeze(result);
}

export function canonicalWindows(
  windows: readonly CalendarWindowSource[],
): string {
  if (windows.length === 0) return "off";
  const clock = (value: number) =>
    `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
  return windows.map(({ startMinute, endMinute }) =>
    `${clock(startMinute)}..${clock(endMinute)}`).join(", ");
}

export function validIsoDate(value: string): boolean {
  return parseDeclaredCalendarValue(value)?.kind === "date";
}

export function parsePositiveWorkday(value: string): Rational | null {
  const token = canonicalizeExactDurationSourceToken(value);
  if (token === null || !token.token.endsWith("h")) return null;
  const match = /^(\d+)(?:\.(\d+)|\/(\d+))?h$/u.exec(token.token)!;
  const whole = BigInt(match[1]!);
  const parsed = match[3] === undefined
    ? rational(BigInt(`${match[1]}${match[2] ?? ""}`), 10n ** BigInt((match[2] ?? "").length))
    : rational(whole, BigInt(match[3]));
  return parsed.numerator > 0n ? parsed : null;
}

export function canonicalWorkday(value: Rational): string {
  const token = canonicalizeExactDurationSourceToken(
    value.denominator === 1n
      ? `${value.numerator}h`
      : `${value.numerator}/${value.denominator}h`,
  );
  if (token === null) throw new Error("validated workday lost canonical form");
  return token.token;
}

export function zoneOffsetSeconds(
  zoneId: string,
  instant: Rational,
): number | null {
  const transitions = TZDB_2026C_TRANSITIONS[zoneId];
  if (transitions === undefined) return null;
  if (
    compare(instant, rational(BigInt(TZDB_2026C_RANGE.start))) < 0 ||
    compare(instant, rational(BigInt(TZDB_2026C_RANGE.end))) >= 0
  ) {
    return null;
  }
  let low = 0;
  let high = transitions.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (compare(instant, rational(BigInt(transitions[middle]![0]))) >= 0) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return transitions[Math.max(0, low - 1)]![1];
}

export function zoneOffsetMatches(
  zoneId: string,
  instant: TemporalInstantSource,
): boolean {
  const seconds = zoneOffsetSeconds(zoneId, instant.instantSeconds);
  return seconds !== null && seconds === instant.offsetMinutes * 60;
}

export function knownZone(zoneId: string): boolean {
  return TZDB_2026C_TRANSITIONS[zoneId] !== undefined;
}
