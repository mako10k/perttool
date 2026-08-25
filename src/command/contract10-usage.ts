import type { CommandOptionOccurrence, CommandUsageError } from "./usage.js";
import {
  commandUsageErrorToJsonForContract,
  renderCommandUsageError,
  validateCommandInvocationAgainstRegistry,
} from "./usage.js";
import {
  CONTRACT10_COMMAND_REGISTRY,
  type Contract10CommandDescriptor,
} from "./contract10-discovery.js";
import { validateContract9CommandInvocation } from "./contract9-usage.js";

export type Contract10CommandInvocationValidation =
  | {
      readonly ok: true;
      readonly descriptor: Contract10CommandDescriptor;
      readonly helpAlias: boolean;
      readonly operands: readonly string[];
      readonly options: readonly CommandOptionOccurrence[];
    }
  | { readonly ok: false; readonly error: CommandUsageError };
export type Contract10ValidCommandInvocation = Extract<Contract10CommandInvocationValidation, { readonly ok: true }>;
export type Contract10InvalidCommandInvocation = Extract<Contract10CommandInvocationValidation, { readonly ok: false }>;

const contract10GenericOperations = new Set([
  "calendar.add",
  "calendar.set",
  "calendar.remove",
  "project.set",
  "resource.set",
  "task.set",
  "milestone.set",
  "document.migrate",
  "work.list",
  "work.show",
  "work.observe",
  "work.reshape.preflight",
  "work.reshape.apply",
  "window.list",
  "window.show",
  "window.observe",
  "window.add",
  "window.set",
  "window.close",
]);

export function validateContract10CommandInvocation(
  argv: readonly string[],
): Contract10CommandInvocationValidation {
  const generic = validateCommandInvocationAgainstRegistry(
    argv,
    CONTRACT10_COMMAND_REGISTRY as never,
  ) as Contract10CommandInvocationValidation;
  if (!generic.ok || contract10GenericOperations.has(generic.descriptor.operation)) {
    return generic;
  }
  const legacy = validateContract9CommandInvocation(argv);
  if (!legacy.ok) return legacy as Contract10CommandInvocationValidation;
  return Object.freeze({
    ...legacy,
    descriptor: generic.descriptor,
  }) as Contract10CommandInvocationValidation;
}
export function serializeContract10CommandUsageError(error: CommandUsageError): string {
  return `${JSON.stringify(commandUsageErrorToJsonForContract(error, 10), null, 2)}\n`;
}
export function contract10CommandUsageErrorToJson(error: CommandUsageError): Readonly<Record<string, unknown>> {
  return commandUsageErrorToJsonForContract(error, 10);
}
export { renderCommandUsageError as renderContract10CommandUsageError };
