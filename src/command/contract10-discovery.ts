import type { Diagnostic } from "../model/diagnostics.js";
import { TOOL_VERSION } from "../version.js";
import type { CommandHelpQuery, CommandResourceSummary } from "./discovery.js";
import {
  CONTRACT9_COMMAND_REGISTRY,
  contract9CommandDescriptorToJson,
  contract9CommandHelpResultToJson,
  renderContract9CommandHelpResult,
  type Contract9CommandDescriptor,
  type Contract9CommandHelpResult,
} from "./contract9-discovery.js";

export type Contract10CommandDescriptor =
  Omit<Contract9CommandDescriptor, "contractVersion"> & {
    readonly contractVersion: 10;
  };
export type Contract10CommandHelpResult =
  Omit<Contract9CommandHelpResult, "cliContractVersion" | "commands"> & {
    readonly cliContractVersion: 10;
    readonly commands: readonly Contract10CommandDescriptor[];
  };

function converted(descriptor: Contract9CommandDescriptor): Contract10CommandDescriptor {
  const migration = descriptor.operation === "document.migrate";
  const advance = descriptor.operation === "dag.advance";
  return Object.freeze({
    ...descriptor,
    contractVersion: 10 as const,
    ...(migration
      ? { summary: "Prepares a complete document for Grammar 7, Grammar 8, or Grammar 9." }
      : {}),
    options: Object.freeze([
      ...descriptor.options.map((option) =>
        migration && option.name === "target-grammar"
          ? Object.freeze({ ...option, enumValues: Object.freeze(["7", "8", "9"]) })
          : option
      ),
      ...(advance
        ? [flagOption("archive-empty-work", "Archive Work made empty by this advance.")]
        : []),
    ]),
    resultSchemas: Object.freeze(descriptor.resultSchemas.map((schema) =>
      schema === "Perttool.AdvanceResult.v3"
        ? "Perttool.AdvanceResult.v4"
        : schema === "Perttool.UnitMigrationResult.v4"
          ? "Perttool.UnitMigrationResult.v5"
          : schema
    )),
  });
}

const mutationTemplate = CONTRACT9_COMMAND_REGISTRY.find(
  ({ operation }) => operation === "task.add",
);
const readTemplate = CONTRACT9_COMMAND_REGISTRY.find(
  ({ operation }) => operation === "project.show",
);
if (mutationTemplate === undefined || readTemplate === undefined) {
  throw new Error("Contract 10 planning command templates are unavailable");
}
const mutationCommandTemplate = mutationTemplate;
const readCommandTemplate = readTemplate;

function planningOption(
  name: string,
  kind: "value" | "flag",
  valueType: string | null,
  required = false,
  repeatable = false,
  description: string | null = null,
): Contract10CommandDescriptor["options"][number] {
  return Object.freeze({
    name,
    kind,
    valueType,
    required,
    repeatable,
    defaultValue: null,
    enumValues: Object.freeze([]),
    conflicts: Object.freeze([]),
    requires: Object.freeze([]),
    sharedGroup: null,
    description,
    spelling: Object.freeze({
      cli: `--${name}`,
      dsl: null,
      json: name.replaceAll("-", "_"),
    }),
  });
}

function flagOption(
  name: string,
  description: string | null = null,
): Contract10CommandDescriptor["options"][number] {
  return Object.freeze({
    ...planningOption(name, "flag", null, false, false, description),
    defaultValue: false,
  });
}

const valueOption = (
  name: string,
  valueType: string,
  required = false,
  repeatable = false,
  description: string | null = null,
) => planningOption(name, "value", valueType, required, repeatable, description);

const readOptions = Object.freeze(readCommandTemplate.options);
const mutationSharedOptions = Object.freeze(mutationCommandTemplate.options.filter(
  ({ name }) => !["title", "duration", "estimate", "priority", "requires", "owner", "tags", "source"].includes(name),
));
const requestOption = valueOption("request", "json-path-or-stdin", true);
const residualOption = valueOption(
  "add-residual-description",
  "work-id=json-string-or-file",
  false,
  true,
  "Add residual description when projected meaning is not expression-identical.",
);

function operands(kind: "list" | "show" | "mutation") {
  return Object.freeze([
    Object.freeze({ name: "file", position: 0, valueType: "path-or-stdin", required: true }),
    ...(kind === "list"
      ? []
      : [Object.freeze({ name: "id", position: 1, valueType: "qualified-or-local-identifier", required: true })]),
  ]);
}

function planningCommand(
  path: readonly ["work" | "window", string] | readonly ["work", "reshape", "preflight" | "apply"],
  summary: string,
  kind: "read" | "observe" | "preflight" | "mutation",
): Contract10CommandDescriptor {
  const operation = path.join(".");
  const list = path.at(-1) === "list";
  const show = path.at(-1) === "show";
  const commandOptions = kind === "read"
    ? readOptions
    : kind === "observe"
      ? Object.freeze([requestOption, ...readOptions])
      : kind === "preflight"
        ? Object.freeze([requestOption, residualOption, ...readOptions])
        : Object.freeze([
            requestOption,
            ...(operation === "work.reshape.apply"
              ? [
                  valueOption("preflight-hash", "sha256-digest", true),
                  valueOption("preflight-token", "opaque-token", true),
                  residualOption,
                ]
              : []),
            ...mutationSharedOptions,
          ]);
  const resultSchema = kind === "preflight"
    ? "Perttool.PlanningReshapePreflightResult.v1"
    : kind === "mutation"
      ? "Perttool.PlanningMutationResult.v1"
      : "Perttool.PlanningPoolResult.v1";
  return Object.freeze({
    ...converted(kind === "mutation" ? mutationCommandTemplate : readCommandTemplate),
    path: Object.freeze(path),
    operation,
    summary,
    operands: operands(list ? "list" : show ? "show" : path[0] === "window" && kind === "mutation" ? "mutation" : "list"),
    options: commandOptions,
    input: "document",
    output: Object.freeze({
      formats: Object.freeze(["text", "json"] as const),
      payload: kind === "mutation" ? "candidate-document" as const : "result" as const,
      fileEffect: kind === "mutation" ? "optional-write-or-create" as const : "none" as const,
    }),
    stdin: Object.freeze({
      document: true,
      artifact: false,
      request: kind !== "read",
      mutuallyExclusive: kind !== "read",
    }),
    effect: kind === "mutation" ? "write-or-create" : kind === "preflight" ? "preview" : "read",
    resultSchemas: Object.freeze([resultSchema, "Perttool.CliError.v1"]),
    examples: Object.freeze([Object.freeze({
      id: operation,
      invocation: exampleInvocation(operation),
      summary,
    })]),
  });
}

function exampleInvocation(operation: string): string {
  switch (operation) {
    case "work.list": return "perttool work list plan.pert";
    case "work.show": return "perttool work show plan.pert WORK";
    case "work.observe": return "perttool work observe plan.pert --request observation.json";
    case "work.reshape.preflight": return "perttool work reshape preflight plan.pert --request reshape.json --format json";
    case "work.reshape.apply": return "perttool work reshape apply plan.pert --request reshape.json --preflight-hash sha256:DIGEST --preflight-token TOKEN --diff";
    case "window.list": return "perttool window list plan.pert";
    case "window.show": return "perttool window show plan.pert SPRINT";
    case "window.observe": return "perttool window observe plan.pert --request observation.json";
    default: return `perttool ${operation.replaceAll(".", " ")} plan.pert WINDOW --request window.json --diff`;
  }
}

export const CONTRACT10_COMMAND_REGISTRY: readonly Contract10CommandDescriptor[] = Object.freeze([
  ...CONTRACT9_COMMAND_REGISTRY.map(converted),
  planningCommand(["work", "list"], "Lists Work in global planning order.", "read"),
  planningCommand(["work", "show"], "Shows one Work and its typed planning relationships.", "read"),
  planningCommand(["work", "observe"], "Observes selected Work across independent planning and strict-execution axes.", "observe"),
  planningCommand(["work", "reshape", "preflight"], "Audits and binds one complete semantic reshape candidate.", "preflight"),
  planningCommand(["work", "reshape", "apply"], "Rebinds and applies an audited semantic reshape candidate.", "mutation"),
  planningCommand(["window", "list"], "Lists active persisted Windows.", "read"),
  planningCommand(["window", "show"], "Shows one active persisted Window.", "read"),
  planningCommand(["window", "observe"], "Observes one persisted or ad hoc Window.", "observe"),
  planningCommand(["window", "add"], "Adds one complete active Window.", "mutation"),
  planningCommand(["window", "set"], "Replaces one active Window definition.", "mutation"),
  planningCommand(["window", "close"], "Contracts one Window with explicit carry-over disposition.", "mutation"),
]);

const resources: readonly CommandResourceSummary[] = Object.freeze([
  ...new Set(CONTRACT10_COMMAND_REGISTRY
    .filter(({ path }) => path.length >= 2)
    .map(({ path }) => path[0])),
].sort().map((name) => Object.freeze({
  name,
  summary: name === "work"
    ? "Inspects, observes, and reshapes Work."
    : name === "window"
      ? "Inspects, observes, and maintains bounded planning Windows."
      : `${name} commands.`,
  actions: Object.freeze(CONTRACT10_COMMAND_REGISTRY
    .filter(({ path }) => path.length >= 2 && path[0] === name)
    .map(({ path }) => path.slice(1).join(" ")).sort()),
})));
const byPath = new Map(CONTRACT10_COMMAND_REGISTRY.map((descriptor) => [descriptor.path.join("\0"), descriptor]));

function diagnostic(
  code: "PTHLP-002" | "PTHLP-003",
  message: string,
  query: CommandHelpQuery,
): Diagnostic {
  return Object.freeze({
    code,
    severity: "error",
    message,
    data: Object.freeze({ resource: query.resource, action: query.action }),
  });
}

function result(
  query: CommandHelpQuery,
  selectedResources: readonly CommandResourceSummary[],
  commands: readonly Contract10CommandDescriptor[],
  diagnostics: readonly Diagnostic[],
): Contract10CommandHelpResult {
  return Object.freeze({
    schemaVersion: "Perttool.CommandHelpResult.v1",
    cliContractVersion: 10,
    toolVersion: TOOL_VERSION,
    operation: "help",
    ok: diagnostics.length === 0,
    query: Object.freeze({ ...query }),
    resources: Object.freeze([...selectedResources]),
    commands: Object.freeze([...commands]),
    diagnostics: Object.freeze([...diagnostics]),
  });
}

export function getContract10CommandDiscovery(query: CommandHelpQuery): Contract10CommandHelpResult {
  if (query.resource === null) {
    return query.action === null
      ? result(query, resources, CONTRACT10_COMMAND_REGISTRY, [])
      : result(query, [], [], [diagnostic("PTHLP-002", "a command action requires a resource", query)]);
  }
  if (query.action === null) {
    const top = byPath.get(query.resource);
    if (top?.path.length === 1) return result(query, [], [top], []);
    const resource = resources.find(({ name }) => name === query.resource);
    return resource === undefined
      ? result(query, [], [], [diagnostic("PTHLP-002", `unknown command resource or top-level command: ${query.resource}`, query)])
      : result(query, [resource], CONTRACT10_COMMAND_REGISTRY.filter(({ path }) => path.length >= 2 && path[0] === query.resource), []);
  }
  const resource = resources.find(({ name }) => name === query.resource);
  if (resource === undefined) {
    return result(query, [], [], [diagnostic("PTHLP-002", `unknown command resource: ${query.resource}`, query)]);
  }
  const command = byPath.get(`${query.resource}\0${query.action.replaceAll(" ", "\0")}`);
  return command === undefined
    ? result(query, [], [], [diagnostic("PTHLP-003", `unknown action ${query.action} for command resource ${query.resource}`, query)])
    : result(query, [resource], [command], []);
}

export function contract10CommandHelpResultToJson(value: Contract10CommandHelpResult): Readonly<Record<string, unknown>> {
  return contract9CommandHelpResultToJson(value as unknown as Contract9CommandHelpResult);
}
export function contract10CommandDescriptorToJson(value: Contract10CommandDescriptor): Readonly<Record<string, unknown>> {
  return contract9CommandDescriptorToJson(value as unknown as Contract9CommandDescriptor);
}
export function contract10CommandRegistryToJson(): readonly Readonly<Record<string, unknown>>[] {
  return CONTRACT10_COMMAND_REGISTRY.map(contract10CommandDescriptorToJson);
}
export function serializeContract10CommandHelpResult(value: Contract10CommandHelpResult): string {
  return `${JSON.stringify(contract10CommandHelpResultToJson(value), null, 2)}\n`;
}
export function renderContract10CommandHelpResult(value: Contract10CommandHelpResult): string {
  return renderContract9CommandHelpResult(value as unknown as Contract9CommandHelpResult)
    .replaceAll("CLI Contract 9", "CLI Contract 10");
}
