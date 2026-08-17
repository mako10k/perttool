import type { Rational } from "../model/rational.js";
import { add, compare, rational } from "../model/rational.js";
import type {
  CalendarSourceModel,
  ResourceAvailabilitySource,
  TemporalScheduleSourceModel,
} from "./source-types.js";
import { zoneOffsetSeconds } from "./source-values.js";
import { TZDB_2026C_TRANSITIONS } from "./tzdb-2026c.js";

const DAY_SECONDS = 86_400;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export interface CapacitySpan {
  readonly start: Rational;
  readonly end: Rational;
  readonly capacity: number;
}

function floorRational(value: Rational): bigint {
  const quotient = value.numerator / value.denominator;
  return value.numerator < 0n && value.numerator % value.denominator !== 0n
    ? quotient - 1n
    : quotient;
}

function secondNumber(value: Rational): number | null {
  const whole = floorRational(value);
  const result = Number(whole);
  return Number.isSafeInteger(result) ? result : null;
}

function localParts(zoneId: string, instant: Rational): Readonly<{
  date: string;
  weekday: (typeof WEEKDAYS)[number];
  minute: number;
}> | null {
  const epoch = secondNumber(instant);
  const offset = zoneOffsetSeconds(zoneId, instant);
  if (epoch === null || offset === null) return null;
  const date = new Date((epoch + offset) * 1_000);
  return Object.freeze({
    date: date.toISOString().slice(0, 10),
    weekday: WEEKDAYS[date.getUTCDay()]!,
    minute: date.getUTCHours() * 60 + date.getUTCMinutes(),
  });
}

function selectedWindows(
  calendar: CalendarSourceModel,
  date: string,
  weekday: string,
) {
  const exception = calendar.exceptions.find((item) => item.date === date);
  return exception?.windows ??
    calendar.weekdays.find((item) => item.weekday === weekday)?.windows ?? [];
}

export function calendarOpenAt(
  model: TemporalScheduleSourceModel,
  calendarId: string,
  instant: Rational,
): boolean | null {
  if (model.profile.kind !== "named_zone") return true;
  const calendar = model.calendars.find(({ id }) => id === calendarId);
  const local = localParts(model.profile.zoneId, instant);
  if (calendar === undefined || local === null) return null;
  return selectedWindows(calendar, local.date, local.weekday).some(
    ({ startMinute, endMinute }) =>
      local.minute >= startMinute && local.minute < endMinute,
  );
}

function offsetCandidates(zoneId: string): readonly number[] {
  return Object.freeze([...new Set(
    (TZDB_2026C_TRANSITIONS[zoneId] ?? []).map((entry) => entry[1]),
  )].sort((left, right) => left - right));
}

function localBoundaryInstants(
  zoneId: string,
  localDayEpoch: number,
  minute: number,
): readonly number[] {
  const localEpoch = localDayEpoch + minute * 60;
  return Object.freeze(offsetCandidates(zoneId).flatMap((offset) => {
    const candidate = localEpoch - offset;
    return zoneOffsetSeconds(zoneId, rational(BigInt(candidate))) === offset
      ? [candidate]
      : [];
  }));
}

function calendarBoundarySeconds(
  model: TemporalScheduleSourceModel,
  calendar: CalendarSourceModel,
  start: number,
  end: number,
): readonly number[] {
  if (model.profile.kind !== "named_zone") return Object.freeze([]);
  const zoneId = model.profile.zoneId;
  const offsets = offsetCandidates(zoneId);
  const margin = Math.max(...offsets.map(Math.abs), 0) + DAY_SECONDS;
  const firstDay = Math.floor((start - margin) / DAY_SECONDS) * DAY_SECONDS;
  const lastDay = Math.ceil((end + margin) / DAY_SECONDS) * DAY_SECONDS;
  const result: number[] = [];
  for (let localDay = firstDay; localDay <= lastDay; localDay += DAY_SECONDS) {
    const date = new Date(localDay * 1_000);
    const dateText = date.toISOString().slice(0, 10);
    const weekday = WEEKDAYS[date.getUTCDay()]!;
    for (const window of selectedWindows(calendar, dateText, weekday)) {
      result.push(...localBoundaryInstants(zoneId, localDay, window.startMinute));
      result.push(...localBoundaryInstants(zoneId, localDay, window.endMinute));
    }
  }
  for (const [transition] of TZDB_2026C_TRANSITIONS[zoneId] ?? []) {
    if (transition > start && transition < end) result.push(transition);
  }
  return Object.freeze(result.filter((value) => value > start && value < end));
}

function availabilityFor(
  model: TemporalScheduleSourceModel,
  resourceId: string,
): ResourceAvailabilitySource | undefined {
  return model.resources.find((item) => item.resourceId === resourceId);
}

function appendAvailabilityBoundaries(
  availability: ResourceAvailabilitySource | undefined,
  calendarIds: Set<string>,
  values: Rational[],
): void {
  if (availability?.calendarId !== null && availability?.calendarId !== undefined) {
    calendarIds.add(availability.calendarId);
  }
  if (availability?.availableFrom !== null && availability?.availableFrom !== undefined) {
    values.push(availability.availableFrom.instantSeconds);
  }
  if (availability?.availableUntil !== null && availability?.availableUntil !== undefined) {
    values.push(availability.availableUntil.instantSeconds);
  }
  for (const override of availability?.overrides ?? []) {
    values.push(override.start.instantSeconds, override.end.instantSeconds);
  }
}

export function effectiveCapacityAt(
  model: TemporalScheduleSourceModel,
  resourceId: string,
  nominalCapacity: number,
  instant: Rational,
): number | null {
  const availability = availabilityFor(model, resourceId);
  if (
    availability?.availableFrom !== null &&
    availability?.availableFrom !== undefined &&
    compare(instant, availability.availableFrom.instantSeconds) < 0
  ) return 0;
  if (
    availability?.availableUntil !== null &&
    availability?.availableUntil !== undefined &&
    compare(instant, availability.availableUntil.instantSeconds) >= 0
  ) return 0;
  const replacement = availability?.overrides.find(({ start, end }) =>
    compare(instant, start.instantSeconds) >= 0 &&
    compare(instant, end.instantSeconds) < 0);
  if (replacement !== undefined) return Math.min(nominalCapacity, replacement.capacity);
  const calendarId = availability?.calendarId ??
    (model.profile.kind === "named_zone" ? model.profile.calendarId : null);
  if (calendarId === null) return nominalCapacity;
  const open = calendarOpenAt(model, calendarId, instant);
  return open === null ? null : open ? nominalCapacity : 0;
}

function sourceBoundaries(
  model: TemporalScheduleSourceModel,
  resourceIds: readonly string[],
  start: Rational,
  end: Rational,
): readonly Rational[] | null {
  const first = secondNumber(start);
  const last = secondNumber(end);
  if (first === null || last === null || compare(start, end) >= 0) return null;
  const calendarIds = new Set<string>();
  if (model.profile.kind === "named_zone") calendarIds.add(model.profile.calendarId);
  const values: Rational[] = [start, end];
  for (const resourceId of resourceIds) {
    appendAvailabilityBoundaries(availabilityFor(model, resourceId), calendarIds, values);
  }
  for (const calendarId of calendarIds) {
    const calendar = model.calendars.find(({ id }) => id === calendarId);
    if (calendar !== undefined) {
      values.push(...calendarBoundarySeconds(model, calendar, first, last)
        .map((value) => rational(BigInt(value))));
    }
  }
  return Object.freeze(values
    .filter((value) => compare(value, start) >= 0 && compare(value, end) <= 0)
    .sort(compare)
    .filter((value, index, all) => index === 0 || compare(value, all[index - 1]!) !== 0));
}

export function resourceCapacitySpans(
  model: TemporalScheduleSourceModel,
  resourceId: string,
  nominalCapacity: number,
  start: Rational,
  end: Rational,
): readonly CapacitySpan[] | null {
  const boundaries = sourceBoundaries(model, [resourceId], start, end);
  if (boundaries === null) return null;
  const result: CapacitySpan[] = [];
  for (let index = 0; index + 1 < boundaries.length; index += 1) {
    const left = boundaries[index]!;
    const right = boundaries[index + 1]!;
    const capacity = effectiveCapacityAt(model, resourceId, nominalCapacity, left);
    if (capacity === null) return null;
    const previous = result.at(-1);
    if (previous !== undefined && previous.capacity === capacity) {
      result[result.length - 1] = Object.freeze({ ...previous, end: right });
    } else {
      result.push(Object.freeze({ start: left, end: right, capacity }));
    }
  }
  return Object.freeze(result);
}

export function taskChangeBoundaries(
  model: TemporalScheduleSourceModel,
  resourceIds: readonly string[],
  start: Rational,
  end: Rational,
): readonly Rational[] | null {
  return sourceBoundaries(model, resourceIds, start, end);
}

export function projectOpenAt(
  model: TemporalScheduleSourceModel,
  instant: Rational,
): boolean | null {
  return model.profile.kind === "continuous_fixed_offset"
    ? true
    : calendarOpenAt(model, model.profile.calendarId, instant);
}

export function nextBoundary(
  boundaries: readonly Rational[],
  instant: Rational,
): Rational | null {
  return boundaries.find((value) => compare(value, instant) > 0) ?? null;
}

export function midpoint(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    2n * left.denominator * right.denominator,
  );
}

export function plusSeconds(value: Rational, seconds: number): Rational {
  return add(value, rational(BigInt(seconds)));
}
