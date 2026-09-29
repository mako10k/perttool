// R: Validate Contract 11 command arguments against the active closed registry.
import type { CommandOptionOccurrence, CommandUsageError } from "./usage.js";
import { commandUsageErrorToJsonForContract, renderCommandUsageError, validateCommandInvocationAgainstRegistry } from "./usage.js";
import { CONTRACT11_COMMAND_REGISTRY, type Contract11CommandDescriptor } from "./contract11-discovery.js";
import { validateContract10CommandInvocation } from "./contract10-usage.js";

export type Contract11CommandInvocationValidation =
  | { readonly ok: true; readonly descriptor: Contract11CommandDescriptor; readonly helpAlias: boolean; readonly operands: readonly string[]; readonly options: readonly CommandOptionOccurrence[] }
  | { readonly ok: false; readonly error: CommandUsageError };
export type Contract11ValidCommandInvocation = Extract<Contract11CommandInvocationValidation, { readonly ok: true }>;
export type Contract11InvalidCommandInvocation = Extract<Contract11CommandInvocationValidation, { readonly ok: false }>;

const genericOperations = new Set(["document.migrate", "plan.review-request", "plan.review-list", "plan.review-show", "plan.review-resolve"]);
function conditionalError(message: string, token: string, action: string): Contract11CommandInvocationValidation {
  return Object.freeze({ ok: false, error: Object.freeze({
    code: "PTCLI-001", kind: "option_conflict", message, operation: `plan.${action}`,
    token, helpTarget: Object.freeze({ resource: "plan", action }), suggestion: null,
  }) });
}
export function validateContract11CommandInvocation(argv: readonly string[]): Contract11CommandInvocationValidation {
  const generic = validateCommandInvocationAgainstRegistry(argv, CONTRACT11_COMMAND_REGISTRY as never) as Contract11CommandInvocationValidation;
  if (!generic.ok) return generic;
  if (generic.descriptor.operation === "plan.review-resolve") {
    const outcome = generic.options.find(({ name }) => name === "outcome")?.value;
    const request = generic.options.find(({ name }) => name === "request");
    if (outcome === "plan_changed" && request === undefined) {
      return conditionalError("plan_changed requires --request", "--request", "review-resolve");
    }
    if (outcome === "plan_retained" && request !== undefined) {
      return conditionalError("plan_retained forbids --request", "--request", "review-resolve");
    }
  }
  if (genericOperations.has(generic.descriptor.operation)) return generic;
  const legacy = validateContract10CommandInvocation(argv);
  if (!legacy.ok) return legacy as Contract11CommandInvocationValidation;
  return Object.freeze({ ...legacy, descriptor: generic.descriptor }) as Contract11CommandInvocationValidation;
}
export function serializeContract11CommandUsageError(error: CommandUsageError): string {
  return `${JSON.stringify(commandUsageErrorToJsonForContract(error, 11), null, 2)}\n`;
}
export function contract11CommandUsageErrorToJson(error: CommandUsageError): Readonly<Record<string, unknown>> {
  return commandUsageErrorToJsonForContract(error, 11);
}
export { renderCommandUsageError as renderContract11CommandUsageError };
