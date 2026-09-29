// R: Publish the closed CLI Contract 11 Plan Review command and Help surface.
import type { Diagnostic } from "../model/diagnostics.js";
import { TOOL_VERSION } from "../version.js";
import type { CommandHelpQuery, CommandResourceSummary } from "./discovery.js";
import {
  CONTRACT10_COMMAND_REGISTRY,
  getContract10CommandDiscovery,
  contract10CommandDescriptorToJson,
  contract10CommandHelpResultToJson,
  renderContract10CommandHelpResult,
  type Contract10CommandDescriptor,
  type Contract10CommandHelpResult,
} from "./contract10-discovery.js";

export type Contract11CommandDescriptor = Omit<Contract10CommandDescriptor, "contractVersion"> & {
  readonly contractVersion: 11;
};
export type Contract11CommandHelpResult = Omit<Contract10CommandHelpResult, "cliContractVersion" | "commands"> & {
  readonly cliContractVersion: 11;
  readonly commands: readonly Contract11CommandDescriptor[];
};

const createTemplate = CONTRACT10_COMMAND_REGISTRY.find(({ operation }) => operation === "task.add");
const readTemplate = CONTRACT10_COMMAND_REGISTRY.find(({ operation }) => operation === "project.show");
if (createTemplate === undefined || readTemplate === undefined) throw new Error("Contract 11 templates are unavailable");
const mutationCommandTemplate = createTemplate;
const readCommandTemplate = readTemplate;

type Option = Contract11CommandDescriptor["options"][number];
function option(name: string, valueType: string, required = false, repeatable = false, enumValues: readonly string[] = []): Option {
  return Object.freeze({
    name, kind: "value" as const, valueType, required, repeatable, defaultValue: null,
    enumValues: Object.freeze([...enumValues]), conflicts: Object.freeze([]), requires: Object.freeze([]),
    sharedGroup: null, description: null,
    spelling: Object.freeze({ cli: `--${name}`, dsl: null, json: name.replaceAll("-", "_") }),
  });
}
function flag(name: string): Option {
  return Object.freeze({ ...option(name, "boolean"), kind: "flag" as const, valueType: null, defaultValue: false });
}
const format = option("format", "output-format", false, false, ["text", "json"]);
const mutationOptions = Object.freeze([
  flag("preview"), flag("diff"),
  Object.freeze({ ...option("output", "path"), conflicts: Object.freeze(["in-place"]) }),
  Object.freeze({ ...flag("in-place"), conflicts: Object.freeze(["output"]) }),
  option("expected-digest", "sha256-digest"), format,
]);
function operand(name: string, position: number, valueType: string) {
  return Object.freeze({ name, position, valueType, required: true });
}
function reviewCommand(
  action: "review-request" | "review-list" | "review-show" | "review-resolve",
  summary: string,
  options: readonly Option[],
  example: string,
): Contract11CommandDescriptor {
  const read = action === "review-list" || action === "review-show";
  const template = read ? readCommandTemplate : mutationCommandTemplate;
  return Object.freeze({
    ...template,
    contractVersion: 11,
    path: Object.freeze(["plan", action] as const),
    operation: `plan.${action}`,
    summary,
    operands: Object.freeze([
      operand("document", 0, "path-or-stdin"),
      ...(action === "review-list" ? [] : [operand("request-id", 1, "identifier")]),
      ...(action === "review-request" ? [operand("task-id", 2, "identifier")] : []),
    ]),
    options: Object.freeze(options),
    input: "document",
    output: Object.freeze({ formats: Object.freeze(["text", "json"] as const), payload: read ? "result" as const : "candidate-document" as const, fileEffect: read ? "none" as const : "optional-write-or-create" as const }),
    stdin: Object.freeze({ document: true, artifact: false, request: action === "review-resolve", mutuallyExclusive: action === "review-resolve" }),
    effect: read ? "read" : "write-or-create",
    resultSchemas: Object.freeze([read ? "Perttool.PlanReviewResult.v1" : "Perttool.PlanReviewMutationResult.v1", "Perttool.CliError.v1"]),
    examples: Object.freeze([Object.freeze({ id: `plan.${action}`, invocation: example, summary })]),
  });
}

export const CONTRACT11_COMMAND_REGISTRY: readonly Contract11CommandDescriptor[] = Object.freeze([
  ...CONTRACT10_COMMAND_REGISTRY.map((descriptor) => Object.freeze({
    ...descriptor, contractVersion: 11 as const,
    resultSchemas: Object.freeze(descriptor.resultSchemas.map((schema) => schema === "Perttool.NextResult.v8"
      ? "Perttool.NextResult.v9" : schema)),
    ...(descriptor.operation === "document.migrate" ? {
      summary: "Prepares a complete document for Grammar 7, Grammar 8, Grammar 9, or Grammar 10.",
      options: Object.freeze(descriptor.options.map((entry) => entry.name === "target-grammar"
        ? Object.freeze({ ...entry, enumValues: Object.freeze(["7", "8", "9", "10"]) }) : entry)),
    } : {}),
  })),
  reviewCommand("review-request", "Creates one task-bound Plan Review Request as a preview by default.", [
    option("reason", "text", true), option("created-at", "date-time", true), option("actor", "principal", true),
    option("locator", "text"), ...mutationOptions,
  ], "perttool plan review-request plan.pert REVIEW_1 TASK_1 --reason 'Recheck task scope' --created-at 2026-09-29T09:00:00+09:00 --actor alice"),
  reviewCommand("review-list", "Lists Plan Review Requests in declaration order.", [
    option("state", "review-state", false, false, ["open", "resolved", "all"]), format,
  ], "perttool plan review-list plan.pert --state open"),
  reviewCommand("review-show", "Shows one Plan Review Request.", [format],
    "perttool plan review-show plan.pert REVIEW_1"),
  reviewCommand("review-resolve", "Resolves one Plan Review Request with one complete candidate.", [
    option("outcome", "review-outcome", true, false, ["plan_retained", "plan_changed"]),
    option("resolved-at", "date-time", true), option("actor", "principal", true),
    option("resolution-reason", "text", true), option("accepted-owner", "principal", false, true),
    option("request", "json-path-or-stdin"), ...mutationOptions,
  ], "perttool plan review-resolve plan.pert REVIEW_1 --outcome plan_retained --resolved-at 2026-09-29T10:00:00+09:00 --actor alice --resolution-reason 'Current plan retained'"),
]);

const contract10Resources = getContract10CommandDiscovery({ resource: null, action: null }).resources;
const resources: readonly CommandResourceSummary[] = Object.freeze([...new Set(CONTRACT11_COMMAND_REGISTRY
  .filter(({ path }) => path.length >= 2).map(({ path }) => path[0]))].sort().map((name) => Object.freeze({
  name,
  summary: name === "plan" ? "Creates, inspects, and resolves task-bound Plan Review Requests."
    : contract10Resources.find((resource) => resource.name === name)?.summary ?? `${name} commands.`,
  actions: Object.freeze(CONTRACT11_COMMAND_REGISTRY.filter(({ path }) => path.length >= 2 && path[0] === name)
    .map(({ path }) => path.slice(1).join(" ")).sort()),
})));
const byPath = new Map(CONTRACT11_COMMAND_REGISTRY.map((descriptor) => [descriptor.path.join("\0"), descriptor]));
function diagnostic(code: "PTHLP-002" | "PTHLP-003", message: string, query: CommandHelpQuery): Diagnostic {
  return Object.freeze({ code, severity: "error", message, data: Object.freeze({ resource: query.resource, action: query.action }) });
}
function result(query: CommandHelpQuery, selectedResources: readonly CommandResourceSummary[], commands: readonly Contract11CommandDescriptor[], diagnostics: readonly Diagnostic[]): Contract11CommandHelpResult {
  return Object.freeze({ schemaVersion: "Perttool.CommandHelpResult.v1", cliContractVersion: 11, toolVersion: TOOL_VERSION,
    operation: "help", ok: diagnostics.length === 0, query: Object.freeze({ ...query }),
    resources: Object.freeze([...selectedResources]), commands: Object.freeze([...commands]), diagnostics: Object.freeze([...diagnostics]) });
}
export function getContract11CommandDiscovery(query: CommandHelpQuery): Contract11CommandHelpResult {
  if (query.resource === null && query.action === null) {
    return result(query, resources, CONTRACT11_COMMAND_REGISTRY, []);
  }
  if (query.resource === "plan") {
    const planResource = resources.find(({ name }) => name === "plan")!;
    if (query.action === null) {
      return result(query, [planResource], CONTRACT11_COMMAND_REGISTRY.filter(({ path }) => path[0] === "plan"), []);
    }
    const command = byPath.get(`plan\0${query.action.replaceAll(" ", "\0")}`);
    return command === undefined
      ? result(query, [], [], [diagnostic("PTHLP-003", `unknown action ${query.action} for command resource plan`, query)])
      : result(query, [planResource], [command], []);
  }
  const legacy = getContract10CommandDiscovery(query);
  return result(query, legacy.resources,
    legacy.commands.map((descriptor) => byPath.get(descriptor.path.join("\0"))!), legacy.diagnostics);
}
export function contract11CommandHelpResultToJson(value: Contract11CommandHelpResult): Readonly<Record<string, unknown>> {
  return contract10CommandHelpResultToJson(value as unknown as Contract10CommandHelpResult);
}
export function contract11CommandDescriptorToJson(value: Contract11CommandDescriptor): Readonly<Record<string, unknown>> {
  return contract10CommandDescriptorToJson(value as unknown as Contract10CommandDescriptor);
}
export function contract11CommandRegistryToJson(): readonly Readonly<Record<string, unknown>>[] {
  return CONTRACT11_COMMAND_REGISTRY.map(contract11CommandDescriptorToJson);
}
export function serializeContract11CommandHelpResult(value: Contract11CommandHelpResult): string {
  return `${JSON.stringify(contract11CommandHelpResultToJson(value), null, 2)}\n`;
}
export function renderContract11CommandHelpResult(value: Contract11CommandHelpResult): string {
  return renderContract10CommandHelpResult(value as unknown as Contract10CommandHelpResult).replaceAll("CLI Contract 10", "CLI Contract 11");
}
