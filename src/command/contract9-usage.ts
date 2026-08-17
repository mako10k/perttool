import type { CommandOptionOccurrence, CommandUsageError } from "./usage.js";
import { commandUsageErrorToJsonForContract, renderCommandUsageError, validateCommandInvocationAgainstRegistry } from "./usage.js";
import { CONTRACT9_COMMAND_REGISTRY, type Contract9CommandDescriptor } from "./contract9-discovery.js";
import { validateAssuranceCommandInvocation } from "./assurance-usage.js";

export type Contract9CommandInvocationValidation =
  | { readonly ok: true; readonly descriptor: Contract9CommandDescriptor; readonly helpAlias: boolean; readonly operands: readonly string[]; readonly options: readonly CommandOptionOccurrence[] }
  | { readonly ok: false; readonly error: CommandUsageError };
export type Contract9ValidCommandInvocation = Extract<Contract9CommandInvocationValidation, { readonly ok: true }>;
export type Contract9InvalidCommandInvocation = Extract<Contract9CommandInvocationValidation, { readonly ok: false }>;
const contract9ExtendedOperations = new Set([
  "calendar.add", "calendar.set", "calendar.remove", "project.set", "resource.set", "task.set", "milestone.set", "document.migrate",
]);
export function validateContract9CommandInvocation(argv: readonly string[]): Contract9CommandInvocationValidation {
  const generic = validateCommandInvocationAgainstRegistry(argv, CONTRACT9_COMMAND_REGISTRY as never) as Contract9CommandInvocationValidation;
  if (!generic.ok || contract9ExtendedOperations.has(generic.descriptor.operation)) return generic;
  const legacy = validateAssuranceCommandInvocation(argv);
  if (!legacy.ok) return legacy as Contract9CommandInvocationValidation;
  return Object.freeze({ ...legacy, descriptor: generic.descriptor }) as Contract9CommandInvocationValidation;
}
export function serializeContract9CommandUsageError(error: CommandUsageError): string {
  return `${JSON.stringify(commandUsageErrorToJsonForContract(error, 9), null, 2)}\n`;
}
export function contract9CommandUsageErrorToJson(error: CommandUsageError): Readonly<Record<string, unknown>> {
  return commandUsageErrorToJsonForContract(error, 9);
}
export { renderCommandUsageError as renderContract9CommandUsageError };
