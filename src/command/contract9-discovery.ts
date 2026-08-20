import type { Diagnostic } from "../model/diagnostics.js";
import { TOOL_VERSION } from "../version.js";
import type { CommandHelpQuery, CommandResourceSummary } from "./discovery.js";
import type { AssuranceCommandDescriptor, AssuranceCommandHelpResult } from "./assurance-discovery.js";
import { ASSURANCE_COMMAND_REGISTRY, assuranceCommandDescriptorToJson, assuranceCommandHelpResultToJson, renderAssuranceCommandHelpResult } from "./assurance-discovery.js";

export type Contract9CommandDescriptor = Omit<AssuranceCommandDescriptor, "contractVersion"> & { readonly contractVersion: 9 };
export type Contract9CommandHelpResult = Omit<AssuranceCommandHelpResult, "cliContractVersion" | "commands"> & {
  readonly cliContractVersion: 9;
  readonly commands: readonly Contract9CommandDescriptor[];
};

const replacements = new Map([
  ["Perttool.ProjectResult.v4", "Perttool.ProjectResult.v5"],
  ["Perttool.CheckResult.v5", "Perttool.CheckResult.v6"],
  ["Perttool.AnalysisResult.v6", "Perttool.AnalysisResult.v7"],
  ["Perttool.NextResult.v7", "Perttool.NextResult.v8"],
  ["Perttool.MutationResult.v5", "Perttool.MutationResult.v6"],
  ["Perttool.PlanAssuranceResult.v1", "Perttool.PlanAssuranceResult.v2"],
  ["Perttool.UnitMigrationResult.v3", "Perttool.UnitMigrationResult.v4"],
]);

function temporalOption(name: string, valueType: string, repeatable = false): Contract9CommandDescriptor["options"][number] {
  return Object.freeze({
    name, kind: "value", valueType, required: false, repeatable, defaultValue: null,
    enumValues: Object.freeze(name === "tzdb" ? ["2026c"] : []), conflicts: Object.freeze([]), requires: Object.freeze([]),
    sharedGroup: null, description: null,
    spelling: Object.freeze({ cli: `--${name}`, dsl: name.replaceAll("-", "_"), json: name.replaceAll("-", "_") }),
  });
}

const temporalOptions = Object.freeze({
  "project.set": Object.freeze([
    temporalOption("time-zone", "iana-time-zone"), temporalOption("tzdb", "tzdb-release"),
    temporalOption("calendar", "calendar-id"), temporalOption("workday", "duration"),
  ]),
  "resource.set": Object.freeze([
    temporalOption("calendar", "calendar-id"), temporalOption("available-from", "date-time"),
    temporalOption("available-until", "date-time"), temporalOption("availability", "availability-window", true),
  ]),
  "task.set": Object.freeze([temporalOption("when", "task-event-bound", true)]),
  "milestone.set": Object.freeze([temporalOption("when", "milestone-event-bound", true)]),
} satisfies Readonly<Record<string, readonly Contract9CommandDescriptor["options"][number][]>>);

function contract9Options(descriptor: AssuranceCommandDescriptor): Contract9CommandDescriptor["options"] {
  const additions = temporalOptions[descriptor.operation as keyof typeof temporalOptions];
  if (additions === undefined) return descriptor.options;
  return Object.freeze(descriptor.options.map((option) => option.name !== "clear" ? option : Object.freeze({ ...option,
    enumValues: Object.freeze([...option.enumValues, ...additions.map(({ spelling }) => spelling.dsl!)]) }))
    .concat(additions));
}

function converted(descriptor: AssuranceCommandDescriptor): Contract9CommandDescriptor {
  const migration = descriptor.operation === "document.migrate";
  return Object.freeze({ ...descriptor, contractVersion: 9 as const,
    ...(migration ? { summary: "Prepares a complete document for Grammar 7 or Grammar 8." } : {}),
    options: Object.freeze(contract9Options(descriptor).map((option) => migration && option.name === "target-grammar"
      ? Object.freeze({ ...option, enumValues: Object.freeze(["7", "8"]) }) : option)),
    examples: migration ? Object.freeze([Object.freeze({ id: "milestone-acceptance",
      invocation: "perttool document migrate plan.pert --target-grammar 7",
      summary: "Preview the repository-bound Grammar 7 milestone-acceptance migration candidate." }), Object.freeze({ id: "temporal-schedule",
      invocation: "perttool document migrate plan.pert --target-grammar 8",
      summary: "Preview the Grammar 8 migration candidate." })]) : descriptor.examples,
    resultSchemas: Object.freeze(migration
      ? ["Perttool.MilestoneAcceptanceMigrationResult.v1", "Perttool.UnitMigrationResult.v4", "Perttool.CliError.v1"]
      : descriptor.resultSchemas.map((schema) => replacements.get(schema) ?? schema)) });
}

const template = ASSURANCE_COMMAND_REGISTRY.find(({ operation }) => operation === "task.add");
if (template === undefined) throw new Error("Contract 9 mutation descriptor template is unavailable");
const shared = template.options.filter(({ sharedGroup }) => sharedGroup !== null);
const calendarCommand = (action: "add" | "set" | "remove"): Contract9CommandDescriptor => Object.freeze({
  ...converted(template), path: Object.freeze(["calendar", action] as const), operation: `calendar.${action}`,
  summary: `${action === "remove" ? "Removes" : action === "add" ? "Adds" : "Changes"} one working-time calendar.`,
  operands: Object.freeze([
    Object.freeze({ name: "file", position: 0, valueType: "path-or-stdin", required: true }),
    Object.freeze({ name: "id", position: 1, valueType: "identifier", required: true }),
  ]),
  options: Object.freeze(action === "remove" ? shared : [
    Object.freeze({ ...template.options.find(({ name }) => name === "title")!, name: "weekday", required: false, repeatable: true,
      valueType: "weekday-windows", spelling: Object.freeze({ cli: "--weekday", dsl: "weekday windows", json: "weekday" }) }),
    Object.freeze({ ...template.options.find(({ name }) => name === "title")!, name: "except", required: false, repeatable: true,
      valueType: "date-windows", spelling: Object.freeze({ cli: "--except", dsl: "except date windows", json: "except" }) }),
    ...shared,
  ]),
  examples: Object.freeze([Object.freeze({ id: action, invocation: action === "remove"
    ? "perttool calendar remove plan.pert STANDARD --diff"
    : `perttool calendar ${action} plan.pert STANDARD --weekday 'mon 09:00..17:00' --diff`,
    summary: `${action} a source-preserving calendar declaration.` })]),
});

export const CONTRACT9_COMMAND_REGISTRY: readonly Contract9CommandDescriptor[] = Object.freeze([
  ...ASSURANCE_COMMAND_REGISTRY.map(converted), calendarCommand("add"), calendarCommand("set"), calendarCommand("remove"),
]);

const resources: readonly CommandResourceSummary[] = Object.freeze([...new Set(CONTRACT9_COMMAND_REGISTRY
  .filter(({ path }) => path.length >= 2).map(({ path }) => path[0]))].sort().map((name) => Object.freeze({
    name, summary: name === "calendar" ? "Maintains working-time calendars." : `${name} commands.`,
    actions: Object.freeze(CONTRACT9_COMMAND_REGISTRY.filter(({ path }) => path.length >= 2 && path[0] === name)
      .map(({ path }) => path.slice(1).join(" ")).sort()),
  })));
const byPath = new Map(CONTRACT9_COMMAND_REGISTRY.map((descriptor) => [descriptor.path.join("\0"), descriptor]));
function diagnostic(code: "PTHLP-002" | "PTHLP-003", message: string, query: CommandHelpQuery): Diagnostic {
  return Object.freeze({ code, severity: "error", message, data: Object.freeze({ resource: query.resource, action: query.action }) });
}
function result(query: CommandHelpQuery, selectedResources: readonly CommandResourceSummary[], commands: readonly Contract9CommandDescriptor[], diagnostics: readonly Diagnostic[]): Contract9CommandHelpResult {
  return Object.freeze({ schemaVersion: "Perttool.CommandHelpResult.v1", cliContractVersion: 9, toolVersion: TOOL_VERSION,
    operation: "help", ok: diagnostics.length === 0, query: Object.freeze({ ...query }), resources: Object.freeze([...selectedResources]),
    commands: Object.freeze([...commands]), diagnostics: Object.freeze([...diagnostics]) });
}
export function getContract9CommandDiscovery(query: CommandHelpQuery): Contract9CommandHelpResult {
  if (query.resource === null) return query.action === null ? result(query, resources, CONTRACT9_COMMAND_REGISTRY, [])
    : result(query, [], [], [diagnostic("PTHLP-002", "a command action requires a resource", query)]);
  if (query.action === null) {
    const top = byPath.get(query.resource); if (top?.path.length === 1) return result(query, [], [top], []);
    const resource = resources.find(({ name }) => name === query.resource);
    return resource === undefined ? result(query, [], [], [diagnostic("PTHLP-002", `unknown command resource or top-level command: ${query.resource}`, query)])
      : result(query, [resource], CONTRACT9_COMMAND_REGISTRY.filter(({ path }) => path.length >= 2 && path[0] === query.resource), []);
  }
  const resource = resources.find(({ name }) => name === query.resource);
  if (resource === undefined) return result(query, [], [], [diagnostic("PTHLP-002", `unknown command resource: ${query.resource}`, query)]);
  const command = byPath.get(`${query.resource}\0${query.action.replaceAll(" ", "\0")}`);
  return command === undefined ? result(query, [], [], [diagnostic("PTHLP-003", `unknown action ${query.action} for command resource ${query.resource}`, query)])
    : result(query, [resource], [command], []);
}
export function contract9CommandHelpResultToJson(value: Contract9CommandHelpResult): Readonly<Record<string, unknown>> {
  return assuranceCommandHelpResultToJson(value as unknown as AssuranceCommandHelpResult);
}
export function contract9CommandDescriptorToJson(value: Contract9CommandDescriptor): Readonly<Record<string, unknown>> {
  return assuranceCommandDescriptorToJson(value as unknown as AssuranceCommandDescriptor);
}
export function contract9CommandRegistryToJson(): readonly Readonly<Record<string, unknown>>[] {
  return CONTRACT9_COMMAND_REGISTRY.map(contract9CommandDescriptorToJson);
}
export function serializeContract9CommandHelpResult(value: Contract9CommandHelpResult): string {
  return `${JSON.stringify(contract9CommandHelpResultToJson(value), null, 2)}\n`;
}
export function renderContract9CommandHelpResult(value: Contract9CommandHelpResult): string {
  return renderAssuranceCommandHelpResult(value as unknown as AssuranceCommandHelpResult).replaceAll("CLI Contract 8", "CLI Contract 9");
}
