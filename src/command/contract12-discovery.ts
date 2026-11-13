// R: Publish Contract 12 discovery with the exact count-first Next result identity.
import * as previous from "./contract11-discovery.js";
import type { CommandHelpQuery } from "./discovery.js";
export type Contract12CommandDescriptor = Omit<previous.Contract11CommandDescriptor, "contractVersion"> & { readonly contractVersion: 12 };
export type Contract12CommandHelpResult = Omit<previous.Contract11CommandHelpResult, "cliContractVersion" | "commands"> & {
  readonly cliContractVersion: 12;
  readonly commands: readonly Contract12CommandDescriptor[];
};
export const CONTRACT12_COMMAND_REGISTRY: readonly Contract12CommandDescriptor[] = Object.freeze(previous.CONTRACT11_COMMAND_REGISTRY.map((command) =>
  Object.freeze({ ...command, contractVersion: 12,
    resultSchemas: Object.freeze(command.resultSchemas.map((schema) => schema === "Perttool.NextResult.v9" ? "Perttool.NextResult.v10" : schema)),
    ...(command.operation === "dag.next" ? {
      options: Object.freeze(command.options.map((option) => option.name === "capacity"
        ? Object.freeze({ ...option, description: "Available resource units for count-first selection, including zero." }) : option)),
      summary: "Selects the maximum number of eligible ready tasks within remaining resource capacity and explains equal-ranked boundary budgets." } : {}),
  })));
const commands = new Map(CONTRACT12_COMMAND_REGISTRY.map((command) => [command.operation, command]));
export function getContract12CommandDiscovery(query: CommandHelpQuery): Contract12CommandHelpResult {
  const result = previous.getContract11CommandDiscovery(query);
  return Object.freeze({ ...result, cliContractVersion: 12,
    commands: Object.freeze(result.commands.map((command) => commands.get(command.operation)!)),
  });
}
export function contract12CommandDescriptorToJson(value: Contract12CommandDescriptor): Readonly<Record<string, unknown>> {
  return previous.contract11CommandDescriptorToJson(value as unknown as previous.Contract11CommandDescriptor);
}
export function contract12CommandHelpResultToJson(value: Contract12CommandHelpResult): Readonly<Record<string, unknown>> {
  return previous.contract11CommandHelpResultToJson(value as unknown as previous.Contract11CommandHelpResult);
}
export function contract12CommandRegistryToJson(): readonly Readonly<Record<string, unknown>>[] {
  return CONTRACT12_COMMAND_REGISTRY.map(contract12CommandDescriptorToJson);
}
export function serializeContract12CommandHelpResult(value: Contract12CommandHelpResult): string {
  return `${JSON.stringify(contract12CommandHelpResultToJson(value), null, 2)}\n`;
}
export function renderContract12CommandHelpResult(value: Contract12CommandHelpResult): string {
  return previous.renderContract11CommandHelpResult(value as unknown as previous.Contract11CommandHelpResult)
    .replaceAll("CLI Contract 11", "CLI Contract 12");
}
