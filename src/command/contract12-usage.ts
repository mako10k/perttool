// R: Preserve argument validation and project its descriptors and errors as Contract 12.
import * as previous from "./contract11-usage.js";
import { commandUsageErrorToJsonForContract } from "./usage.js";
import type { CommandUsageError } from "./usage.js";
import { CONTRACT12_COMMAND_REGISTRY, type Contract12CommandDescriptor } from "./contract12-discovery.js";
export type Contract12CommandInvocationValidation =
  | (Omit<previous.Contract11ValidCommandInvocation, "descriptor"> & { readonly descriptor: Contract12CommandDescriptor })
  | previous.Contract11InvalidCommandInvocation;
export type Contract12ValidCommandInvocation = Extract<Contract12CommandInvocationValidation, { readonly ok: true }>;
export type Contract12InvalidCommandInvocation = Extract<Contract12CommandInvocationValidation, { readonly ok: false }>;
const descriptors = new Map(CONTRACT12_COMMAND_REGISTRY.map((descriptor) => [descriptor.operation, descriptor]));
export function validateContract12CommandInvocation(argv: readonly string[]): Contract12CommandInvocationValidation {
  const result = previous.validateContract11CommandInvocation(argv);
  return result.ok ? Object.freeze({ ...result, descriptor: descriptors.get(result.descriptor.operation)! }) : result;
}
export function contract12CommandUsageErrorToJson(error: CommandUsageError): Readonly<Record<string, unknown>> {
  return commandUsageErrorToJsonForContract(error, 12);
}
export function serializeContract12CommandUsageError(error: CommandUsageError): string {
  return `${JSON.stringify(contract12CommandUsageErrorToJson(error), null, 2)}\n`;
}
export { renderContract11CommandUsageError as renderContract12CommandUsageError } from "./contract11-usage.js";
