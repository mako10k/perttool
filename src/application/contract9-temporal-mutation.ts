import type { CommandOptionOccurrence } from "../command/usage.js";
import type { Contract9CommandInvocationValidation } from "../command/contract9-usage.js";
import { planCalendarMutation, type CalendarMutationRequest } from "../temporal-schedule/calendar-mutation.js";
import { planTemporalEntityMutation, type TemporalEntityMutation } from "../temporal-schedule/entity-mutation.js";
import { TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../temporal-schedule/source.js";
import type { TemporalScheduleMutationResult } from "../temporal-schedule/source-types.js";

export type Contract9TemporalMutationRequest =
  | Readonly<{ kind: "calendar"; request: CalendarMutationRequest }>
  | Readonly<{ kind: "entity"; request: TemporalEntityMutation }>;

function values(options: readonly CommandOptionOccurrence[], name: string): readonly string[] {
  return Object.freeze(options.flatMap((option) => option.name === name && option.value !== null ? [option.value] : []));
}

function cleared(options: readonly CommandOptionOccurrence[], name: string): boolean {
  return values(options, "clear").includes(name);
}

function optional(options: readonly CommandOptionOccurrence[], name: string, clearName = name.replaceAll("-", "_")): string | null | undefined {
  const selected = values(options, name);
  if (selected.length > 0 && cleared(options, clearName))
    throw new TypeError(`--${name} conflicts with --clear ${clearName}`);
  return selected[0] ?? (cleared(options, clearName) ? null : undefined);
}

function calendarRequest(operation: string, operands: readonly string[], options: readonly CommandOptionOccurrence[]): Contract9TemporalMutationRequest {
  return Object.freeze({ kind: "calendar", request: Object.freeze({
    action: operation.slice("calendar.".length) as CalendarMutationRequest["action"], id: operands[1]!,
    ...(operation === "calendar.remove" ? {} : {
      weekdays: values(options, "weekday"), exceptions: values(options, "except"),
    }),
  }) });
}

function entityRequest(operation: string, operands: readonly string[], options: readonly CommandOptionOccurrence[]): Contract9TemporalMutationRequest | null {
  if (operation === "project.set") {
    const set = { timeZone: optional(options, "time-zone"), tzdb: optional(options, "tzdb"),
      calendar: optional(options, "calendar"), workday: optional(options, "workday") };
    if (Object.values(set).every((value) => value === undefined)) return null;
    return Object.freeze({ kind: "entity", request: Object.freeze({ kind: "project.set", set: Object.freeze({
      ...(set.timeZone === undefined ? {} : { timeZone: set.timeZone === null ? null : JSON.stringify(set.timeZone) }),
      ...(set.tzdb === undefined ? {} : { tzdb: set.tzdb === null ? null : JSON.stringify(set.tzdb) }),
      ...(set.calendar === undefined ? {} : { calendar: set.calendar }),
      ...(set.workday === undefined ? {} : { workday: set.workday }),
    }) }) });
  }
  if (operation === "resource.set") {
    const set = { calendar: optional(options, "calendar"), availableFrom: optional(options, "available-from"),
      availableUntil: optional(options, "available-until") };
    const availability = values(options, "availability");
    if (availability.length > 0 && cleared(options, "availability"))
      throw new TypeError("--availability conflicts with --clear availability");
    if (Object.values(set).every((value) => value === undefined) && availability.length === 0 && !cleared(options, "availability")) return null;
    return Object.freeze({ kind: "entity", request: Object.freeze({ kind: "resource.set", id: operands[1]!, set: Object.freeze({
      ...(set.calendar === undefined ? {} : { calendar: set.calendar }),
      ...(set.availableFrom === undefined ? {} : { availableFrom: set.availableFrom }),
      ...(set.availableUntil === undefined ? {} : { availableUntil: set.availableUntil }),
      ...(availability.length > 0 || cleared(options, "availability") ? { availability } : {}),
    }) }) });
  }
  if (operation === "task.set" || operation === "milestone.set") {
    const when = values(options, "when");
    if (when.length > 0 && cleared(options, "when")) throw new TypeError("--when conflicts with --clear when");
    if (when.length === 0 && !cleared(options, "when")) return null;
    return Object.freeze({ kind: "entity", request: Object.freeze(operation === "task.set"
      ? { kind: "task.set", id: operands[1]!, when }
      : { kind: "milestone.set", id: operands[1]!, when }) });
  }
  return null;
}

export function contract9TemporalMutationRequest(
  invocation: Extract<Contract9CommandInvocationValidation, { readonly ok: true }>,
): Contract9TemporalMutationRequest | null {
  const { operation } = invocation.descriptor;
  if (operation.startsWith("calendar.")) return calendarRequest(operation, invocation.operands, invocation.options);
  return entityRequest(operation, invocation.operands, invocation.options);
}

export function planContract9TemporalMutation(text: string,
  invocation: Extract<Contract9CommandInvocationValidation, { readonly ok: true }>,
  options: Readonly<{ maxDiagnostics?: number }> = {}): TemporalScheduleMutationResult | null {
  const mutation = contract9TemporalMutationRequest(invocation);
  if (mutation === null) return null;
  return mutation.kind === "calendar"
    ? planCalendarMutation(text, mutation.request, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY, options)
    : planTemporalEntityMutation(text, mutation.request, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY, options);
}
