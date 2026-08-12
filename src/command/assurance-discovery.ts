import type { Diagnostic } from "../model/diagnostics.js";
import { TOOL_VERSION } from "../version.js";
import type {
  CommandHelpQuery,
  CommandResourceSummary,
} from "./discovery.js";
import type { OperandDescriptor } from "./registry.js";
import {
  ACTUALS_COMMAND_REGISTRY,
  getActualsCommandDiscovery,
  renderActualsCommandHelpResult,
  serializeActualsCommandHelpResult,
  actualsCommandHelpResultToJson,
  actualsCommandDescriptorToJson,
  type ActualsCommandDescriptor,
  type ActualsCommandHelpResult,
} from "./actuals-discovery.js";
import type { TargetGovernanceOptionDescriptor } from "./target-governance-discovery.js";

export interface AssuranceCommandDescriptor
  extends Omit<ActualsCommandDescriptor, "contractVersion" | "path"> {
  readonly contractVersion: 8;
  readonly path:
    | readonly [command: string]
    | readonly [resource: string, action: string]
    | readonly [resource: string, group: string, action: string];
}

export interface AssuranceCommandHelpResult
  extends Omit<ActualsCommandHelpResult, "cliContractVersion" | "commands"> {
  readonly cliContractVersion: 8;
  readonly commands: readonly AssuranceCommandDescriptor[];
}

function valueOption(
  name: string,
  valueType: string,
  config: {
    readonly required?: boolean;
    readonly repeatable?: boolean;
    readonly defaultValue?: string | number | boolean | null;
    readonly enumValues?: readonly string[];
    readonly conflicts?: readonly string[];
    readonly requires?: readonly string[];
    readonly description?: string;
  } = {},
): TargetGovernanceOptionDescriptor {
  return Object.freeze({
    name,
    kind: "value",
    valueType,
    required: config.required ?? false,
    repeatable: config.repeatable ?? false,
    defaultValue: config.defaultValue ?? null,
    enumValues: Object.freeze([...(config.enumValues ?? [])]),
    conflicts: Object.freeze([...(config.conflicts ?? [])]),
    requires: Object.freeze([...(config.requires ?? [])]),
    sharedGroup: null,
    description: config.description ?? null,
    spelling: Object.freeze({
      cli: `--${name}`,
      dsl: null,
      json: name.replaceAll("-", "_"),
    }),
  });
}

function flagOption(
  name: string,
  config: {
    readonly conflicts?: readonly string[];
    readonly requires?: readonly string[];
    readonly description?: string;
  } = {},
): TargetGovernanceOptionDescriptor {
  return Object.freeze({
    name,
    kind: "flag",
    valueType: null,
    required: false,
    repeatable: false,
    defaultValue: false,
    enumValues: Object.freeze([]),
    conflicts: Object.freeze([...(config.conflicts ?? [])]),
    requires: Object.freeze([...(config.requires ?? [])]),
    sharedGroup: null,
    description: config.description ?? null,
    spelling: Object.freeze({
      cli: `--${name}`,
      dsl: null,
      json: name.replaceAll("-", "_"),
    }),
  });
}

function operand(
  name: string,
  position: number,
  valueType = "identifier",
): OperandDescriptor {
  return Object.freeze({ name, position, valueType, required: true });
}

function contract7Schema(schema: string): string {
  return schema === "Perttool.CheckResult.v3"
    ? "Perttool.CheckResult.v4"
    : schema === "Perttool.ProjectResult.v3"
      ? "Perttool.ProjectResult.v4"
      : schema === "Perttool.AnalysisResult.v4"
        ? "Perttool.AnalysisResult.v5"
        : schema === "Perttool.NextResult.v5"
          ? "Perttool.NextResult.v6"
          : schema === "Perttool.MutationResult.v3"
            ? "Perttool.MutationResult.v4"
            : schema === "Perttool.AdvanceResult.v1"
              ? "Perttool.AdvanceResult.v2"
              : schema;
}

function contract7Descriptor(
  descriptor: ActualsCommandDescriptor,
): AssuranceCommandDescriptor {
  return Object.freeze({
    ...descriptor,
    contractVersion: 8,
    operands: descriptor.operation === "help"
      ? Object.freeze([
          ...descriptor.operands,
          Object.freeze({ name: "subaction", valueType: "command-action", required: false, position: 2 }),
        ])
      : descriptor.operands,
    resultSchemas: Object.freeze(descriptor.resultSchemas.map(contract7Schema).map((schema) =>
      schema === "Perttool.CheckResult.v4" ? "Perttool.CheckResult.v5"
        : schema === "Perttool.AnalysisResult.v5" ? "Perttool.AnalysisResult.v6"
          : schema === "Perttool.NextResult.v6" ? "Perttool.NextResult.v7"
            : schema === "Perttool.MutationResult.v4" ? "Perttool.MutationResult.v5"
              : schema === "Perttool.AdvanceResult.v2" ? "Perttool.AdvanceResult.v3"
                : schema
    )),
    examples: Object.freeze(descriptor.examples.map((example) =>
      Object.freeze({
        ...example,
        invocation: example.invocation
          .replaceAll("Perttool.NextResult.v5", "Perttool.NextResult.v6"),
      })
    )),
  });
}

const base = ACTUALS_COMMAND_REGISTRY.map(contract7Descriptor);
const readBase = base.find(({ operation }) => operation === "project.show");
const mutationBase = base.find(({ operation }) => operation === "task.add");
if (readBase === undefined || mutationBase === undefined) {
  throw new Error("Contract 7 descriptor bases are unavailable");
}
const readTemplate: AssuranceCommandDescriptor = readBase;
const mutationTemplate: AssuranceCommandDescriptor = mutationBase;
const readOptions = readTemplate.options.filter(({ sharedGroup }) =>
  sharedGroup === "diagnostics" || sharedGroup === "result"
);
const mutationOptions = mutationTemplate.options.filter(({ sharedGroup }) =>
  sharedGroup !== null
);
const file = operand("file", 0, "path-or-stdin");

const historicalGraphCommand: AssuranceCommandDescriptor = Object.freeze({
  ...readTemplate,
  path: Object.freeze(["dag", "history"] as const),
  operation: "dag.history",
  summary: "Reconstructs a bounded read-only first-parent historical DAG.",
  operands: Object.freeze([file]),
  options: Object.freeze([
    valueOption("rev", "git-revision", { defaultValue: "HEAD" }),
    valueOption("base", "git-revision"),
    valueOption("history", "historical-ancestry-profile", {
      defaultValue: "first-parent",
      enumValues: ["first-parent", "three-way"],
      description: "Selects the explicit ancestry profile; three-way fails closed in model 1.",
    }),
    valueOption("view", "historical-graph-view", {
      defaultValue: "lineage",
      enumValues: ["snapshot", "lineage", "timeline"],
    }),
    valueOption("snapshot", "full-git-object-id", {
      description: "Selects an inspected full commit ID and is valid only with --view snapshot.",
    }),
    valueOption("analysis", "graph-analysis-mode", {
      defaultValue: "none",
      enumValues: ["none", "precedence", "resource", "both"],
    }),
    ...readOptions,
  ]),
  stdin: Object.freeze({
    document: false,
    artifact: false,
    request: false,
    mutuallyExclusive: false,
  }),
  effect: "read",
  output: Object.freeze({
    formats: Object.freeze(["text", "json"] as const),
    payload: "result" as const,
    fileEffect: "none" as const,
  }),
  resultSchemas: Object.freeze([
    "Perttool.HistoricalGraphResult.v1",
    "Perttool.CliError.v1",
  ]),
  exitStatuses: Object.freeze([
    Object.freeze({ code: 0, meaning: "Historical graph result is available." }),
    Object.freeze({ code: 1, meaning: "Historical graph result is unavailable or warning policy failed." }),
    Object.freeze({ code: 2, meaning: "CLI usage error." }),
    Object.freeze({ code: 3, meaning: "Git process or filesystem input error." }),
    Object.freeze({ code: 70, meaning: "Internal invariant or programmer error." }),
  ]),
  examples: Object.freeze([
    Object.freeze({
      id: "lineage",
      invocation: "perttool dag history plan.pert --rev HEAD --history first-parent --view lineage --analysis none --format json",
      summary: "Return proved first-parent lineage without changing Git or the plan.",
    }),
  ]),
});

function milestoneAcceptanceDescriptor(
  action: "replace" | "verify" | "fail" | "unavailable" | "revoke" | "waive" | "show",
): AssuranceCommandDescriptor {
  const read = action === "show";
  return Object.freeze({
    ...(read ? readTemplate : mutationTemplate),
    contractVersion: 8,
    path: Object.freeze(["milestone", "acceptance", action] as const),
    operation: `milestone-acceptance.${action}`,
    summary: read ? "Shows milestone closure and acceptance separately." : `Previews or persists milestone acceptance ${action}.`,
    operands: Object.freeze(read
      ? [file]
      : action === "replace"
        ? [file, operand("milestone-id", 1), operand("set-id", 2), operand("revision-id", 3)]
        : [file, operand("set-id", 1), operand("criterion-id", 2), operand("receipt-id", 3)]),
    options: Object.freeze(read ? readOptions : [
      ...(action === "replace"
        ? [valueOption("criterion", "criterion-declaration", { required: true, repeatable: true })]
        : [
            ...(action === "verify" ? [
              valueOption("evidence-kind", "criterion-evidence-kind", { required: true, enumValues: ["test", "command", "artifact", "observation", "owner"] }),
              valueOption("evidence-reference", "text", { required: true }),
              valueOption("evidence-revision", "revision-or-none", { required: true }),
              valueOption("verifier", "principal-id", { required: true }),
              valueOption("occurred-at", "utc-z-time", { required: true }),
            ] : []),
            ...(action === "revoke" ? [valueOption("revokes", "receipt-id", { required: true })] : []),
            ...(["fail", "unavailable", "waive"].includes(action) ? [valueOption("reason", "text", { required: action === "waive" })] : []),
          ]),
      ...mutationOptions,
    ]),
    effect: read ? "read" : "write-or-create",
    resultSchemas: Object.freeze([read ? "Perttool.MilestoneAcceptanceResult.v1" : "Perttool.MutationResult.v5", "Perttool.CliError.v1"]),
    examples: Object.freeze([Object.freeze({
      id: "default",
      invocation: read
        ? "perttool milestone acceptance show plan.pert"
        : action === "replace"
          ? "perttool milestone acceptance replace plan.pert DONE DONE_R1 R1 --criterion COMPLETE:required:owner:Accepted"
          : action === "verify"
            ? "perttool milestone acceptance verify plan.pert DONE_R1 COMPLETE RCPT_DONE --evidence-kind owner --evidence-reference reviewed --evidence-revision none --verifier user --occurred-at 2026-08-12T12:00:00Z"
            : action === "revoke"
              ? "perttool milestone acceptance revoke plan.pert DONE_R1 COMPLETE REVOKE_DONE --revokes RCPT_DONE"
              : `perttool milestone acceptance ${action} plan.pert DONE_R1 COMPLETE ${action.toUpperCase()}_DONE${action === "waive" ? " --reason Accepted" : ""}`,
      summary: read ? "Show current milestone acceptance." : `Preview milestone acceptance ${action}.`,
    })]),
  });
}

const documentMigrateCommand: AssuranceCommandDescriptor = Object.freeze({
  ...mutationTemplate,
  contractVersion: 8,
  path: Object.freeze(["document", "migrate"] as const),
  operation: "document.migrate",
  summary: "Prepares an exact committed document for Grammar 7.",
  operands: Object.freeze([file]),
  options: Object.freeze([
    valueOption("target-grammar", "integer", { required: true, enumValues: ["7"] }),
    ...mutationOptions,
  ]),
  resultSchemas: Object.freeze(["Perttool.MilestoneAcceptanceMigrationResult.v1", "Perttool.CliError.v1"]),
  examples: Object.freeze([Object.freeze({
    id: "preview",
    invocation: "perttool document migrate plan.pert --target-grammar 7",
    summary: "Preview the Grammar 7 migration candidate.",
  })]),
});

function readDescriptor(
  action: "show" | "hash",
): AssuranceCommandDescriptor {
  const hash = action === "hash";
  return Object.freeze({
    ...readTemplate,
    path: Object.freeze(["plan-assurance", action] as const),
    operation: `plan-assurance.${action}`,
    summary: hash
      ? "Returns one current plan-assurance commitment hash."
      : "Shows the current plan-assurance projection.",
    operands: Object.freeze(hash
      ? [file, operand("task-id", 1)]
      : [file]),
    options: Object.freeze([
      ...(hash
        ? [valueOption("kind", "assurance-hash-kind", {
            required: true,
            enumValues: ["contract", "computed-basis", "exported"],
          })]
        : [valueOption("task", "task-id", { repeatable: true })]),
      ...readOptions,
    ]),
    effect: "read",
    output: Object.freeze({
      formats: Object.freeze(["text", "json"] as const),
      payload: "result" as const,
      fileEffect: "none" as const,
    }),
    resultSchemas: Object.freeze([
      "Perttool.PlanAssuranceResult.v1",
      "Perttool.CliError.v1",
    ]),
    examples: Object.freeze([
      Object.freeze({
        id: action,
        invocation: hash
          ? "perttool plan-assurance hash plan.pert BUILD --kind computed-basis"
          : "perttool plan-assurance show plan.pert --task BUILD --format json",
        summary: hash
          ? "Print exactly one computed planning-basis digest."
          : "Inspect one task without changing the plan.",
      }),
    ]),
  });
}

const assuranceMutationExampleInvocations = Object.freeze({
  "plan-assurance.seal": "perttool plan-assurance seal plan.pert --reason \"Initial reviewed baseline\" --diff",
  "plan-assurance.reseal": "perttool plan-assurance reseal plan.pert --task BUILD --reason \"Plan revised\" --diff",
  "plan-dependency.add": "perttool plan-dependency add plan.pert REL_BUILD_TEST BUILD TEST --mode both --reason \"Testing uses the build plan\" --diff",
  "plan-dependency.set": "perttool plan-dependency set plan.pert REL_BUILD_TEST --mode planning-only --reason \"Planning input only\" --diff",
  "plan-dependency.remove": "perttool plan-dependency remove plan.pert REL_BUILD_TEST --diff",
  "task-outcome.add": "perttool task-outcome add plan.pert OUTCOME_BUILD BUILD --status conformant --reason \"Accepted completion evidence\" --diff",
  "task-outcome.set": "perttool task-outcome set plan.pert OUTCOME_BUILD --status changed --summary \"Scope changed\" --reason \"Reviewed outcome\" --diff",
  "task-outcome.remove": "perttool task-outcome remove plan.pert OUTCOME_BUILD --diff",
});

function assuranceMutationDescriptor(
  path: readonly [string, string],
  operation: keyof typeof assuranceMutationExampleInvocations,
  summary: string,
  operands: readonly OperandDescriptor[],
  domainOptions: readonly TargetGovernanceOptionDescriptor[],
): AssuranceCommandDescriptor {
  return Object.freeze({
    ...mutationTemplate,
    path: Object.freeze(path),
    operation,
    summary,
    operands: Object.freeze([...operands]),
    options: Object.freeze([...domainOptions, ...mutationOptions]),
    resultSchemas: Object.freeze([
      "Perttool.MutationResult.v5",
      "Perttool.CliError.v1",
    ]),
    examples: Object.freeze([
      Object.freeze({
        id: "preview",
        invocation: assuranceMutationExampleInvocations[operation],
        summary: "Preview the governed assurance candidate.",
      }),
    ]),
  });
}

const assuranceCommands: readonly AssuranceCommandDescriptor[] = Object.freeze([
  readDescriptor("show"),
  readDescriptor("hash"),
  assuranceMutationDescriptor(
    ["plan-assurance", "seal"],
    "plan-assurance.seal",
    "Creates one complete initial plan-assurance baseline.",
    [file],
    [valueOption("reason", "text", { required: true })],
  ),
  assuranceMutationDescriptor(
    ["plan-assurance", "reseal"],
    "plan-assurance.reseal",
    "Reaccepts selected task planning bases in topological order.",
    [file],
    [
      valueOption("task", "task-id", { required: true, repeatable: true }),
      valueOption("reason", "text", { required: true }),
    ],
  ),
  assuranceMutationDescriptor(
    ["plan-dependency", "add"],
    "plan-dependency.add",
    "Adds an explicit execution/planning dependency relation.",
    [file, operand("id", 1), operand("predecessor", 2), operand("successor", 3)],
    [
      valueOption("mode", "dependency-mode", {
        required: true,
        enumValues: ["both", "execution-only", "planning-only"],
      }),
      valueOption("reason", "text"),
    ],
  ),
  assuranceMutationDescriptor(
    ["plan-dependency", "set"],
    "plan-dependency.set",
    "Changes one explicit dependency relation.",
    [file, operand("id", 1)],
    [
      valueOption("predecessor", "task-id"),
      valueOption("successor", "task-id"),
      valueOption("mode", "dependency-mode", {
        enumValues: ["both", "execution-only", "planning-only"],
      }),
      valueOption("reason", "text", { conflicts: ["clear=reason"] }),
      valueOption("clear", "field-name", {
        repeatable: true,
        enumValues: ["reason"],
        conflicts: ["reason"],
      }),
    ],
  ),
  assuranceMutationDescriptor(
    ["plan-dependency", "remove"],
    "plan-dependency.remove",
    "Removes one explicit dependency relation.",
    [file, operand("id", 1)],
    [],
  ),
  assuranceMutationDescriptor(
    ["task-outcome", "add"],
    "task-outcome.add",
    "Adds a task outcome bound to the current accepted basis.",
    [file, operand("id", 1), operand("task-id", 2)],
    [
      valueOption("status", "outcome-status", {
        required: true,
        enumValues: ["conformant", "changed"],
      }),
      valueOption("summary", "text"),
      valueOption("reason", "text", { required: true }),
    ],
  ),
  assuranceMutationDescriptor(
    ["task-outcome", "set"],
    "task-outcome.set",
    "Changes or rebinds one task outcome.",
    [file, operand("id", 1)],
    [
      valueOption("status", "outcome-status", {
        enumValues: ["conformant", "changed"],
      }),
      valueOption("summary", "text", { conflicts: ["clear=summary"] }),
      valueOption("clear", "field-name", {
        repeatable: true,
        enumValues: ["summary"],
        conflicts: ["summary"],
      }),
      valueOption("reason", "text"),
      flagOption("rebind-current-basis"),
    ],
  ),
  assuranceMutationDescriptor(
    ["task-outcome", "remove"],
    "task-outcome.remove",
    "Removes one task outcome record.",
    [file, operand("id", 1)],
    [],
  ),
]);

export const ASSURANCE_COMMAND_REGISTRY:
  readonly AssuranceCommandDescriptor[] = Object.freeze([
    ...base.flatMap((descriptor) => descriptor.operation === "dag.render"
      ? [descriptor, historicalGraphCommand]
      : [descriptor]),
    ...assuranceCommands,
    documentMigrateCommand,
    ...(["replace", "verify", "fail", "unavailable", "revoke", "waive", "show"] as const).map(milestoneAcceptanceDescriptor),
  ]);

const actualsCatalog = getActualsCommandDiscovery({ resource: null, action: null });
if (!actualsCatalog.ok) throw new Error("Contract 6 command catalog is unavailable");
const summaries = new Map(
  actualsCatalog.resources.map((resource) => [resource.name, resource] as const),
);
for (const [name, summary] of [
  ["plan-assurance", "Inspect, initialize, and reaccept conditional plan assurance."],
  ["plan-dependency", "Maintain explicit execution and planning relations."],
  ["task-outcome", "Maintain basis-bound completed-task outcomes."],
  ["milestone", "Maintain milestones and inspect milestone outcome acceptance."],
] as const) {
  summaries.set(name, Object.freeze({ name, summary, actions: Object.freeze([]) }));
}
const resourceSummaries: readonly CommandResourceSummary[] = Object.freeze(
  [...summaries.values()].map((resource) => Object.freeze({
    ...resource,
    actions: Object.freeze(ASSURANCE_COMMAND_REGISTRY
      .filter(({ path }) => path.length >= 2 && path[0] === resource.name)
      .map(({ path }) => path.slice(1).join(" "))
      .sort()),
  })),
);
const commandsByPath = new Map(ASSURANCE_COMMAND_REGISTRY.map((descriptor) => [
  descriptor.path.join("\0"),
  descriptor,
]));

function helpDiagnostic(
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
  resources: readonly CommandResourceSummary[],
  commands: readonly AssuranceCommandDescriptor[],
  diagnostics: readonly Diagnostic[],
): AssuranceCommandHelpResult {
  return Object.freeze({
    schemaVersion: "Perttool.CommandHelpResult.v1",
    cliContractVersion: 8,
    toolVersion: TOOL_VERSION,
    operation: "help",
    ok: diagnostics.length === 0,
    query: Object.freeze({ ...query }),
    resources: Object.freeze([...resources]),
    commands: Object.freeze([...commands]),
    diagnostics: Object.freeze([...diagnostics]),
  });
}

export function getAssuranceCommandDiscovery(
  query: CommandHelpQuery,
): AssuranceCommandHelpResult {
  if (query.resource === null) {
    return query.action === null
      ? result(query, resourceSummaries, ASSURANCE_COMMAND_REGISTRY, [])
      : result(query, [], [], [helpDiagnostic(
          "PTHLP-002", "a command action requires a resource", query,
        )]);
  }
  if (query.action === null) {
    const top = commandsByPath.get(query.resource);
    if (top !== undefined && top.path.length === 1) return result(query, [], [top], []);
    const resource = resourceSummaries.find(({ name }) => name === query.resource);
    return resource === undefined
      ? result(query, [], [], [helpDiagnostic(
          "PTHLP-002",
          `unknown command resource or top-level command: ${query.resource}`,
          query,
        )])
      : result(query, [resource], ASSURANCE_COMMAND_REGISTRY.filter(
          ({ path }) => path.length >= 2 && path[0] === query.resource,
        ), []);
  }
  const resource = resourceSummaries.find(({ name }) => name === query.resource);
  if (resource === undefined) {
    return result(query, [], [], [helpDiagnostic(
      "PTHLP-002", `unknown command resource: ${query.resource}`, query,
    )]);
  }
  const command = commandsByPath.get(`${query.resource}\0${query.action.replaceAll(" ", "\0")}`);
  return command === undefined
    ? result(query, [], [], [helpDiagnostic(
        "PTHLP-003",
        `unknown action ${query.action} for command resource ${query.resource}`,
        query,
      )])
    : result(query, [resource], [command], []);
}

export function assuranceCommandDescriptorToJson(
  descriptor: AssuranceCommandDescriptor,
): Readonly<Record<string, unknown>> {
  return actualsCommandDescriptorToJson(
    descriptor as unknown as ActualsCommandDescriptor,
  );
}

export function assuranceCommandRegistryToJson() {
  return ASSURANCE_COMMAND_REGISTRY.map(assuranceCommandDescriptorToJson);
}

export function assuranceCommandHelpResultToJson(
  value: AssuranceCommandHelpResult,
): Readonly<Record<string, unknown>> {
  return actualsCommandHelpResultToJson(
    value as unknown as ActualsCommandHelpResult,
  );
}

export function serializeAssuranceCommandHelpResult(
  value: AssuranceCommandHelpResult,
): string {
  return serializeActualsCommandHelpResult(
    value as unknown as ActualsCommandHelpResult,
  );
}

export function renderAssuranceCommandHelpResult(
  value: AssuranceCommandHelpResult,
): string {
  const renderable = Object.freeze({
    ...value,
    commands: Object.freeze(value.commands.map((descriptor) => descriptor.path.length === 3
      ? Object.freeze({
          ...descriptor,
          path: Object.freeze([descriptor.path[0], `${descriptor.path[1]} ${descriptor.path[2]}`] as const),
        })
      : descriptor)),
  });
  return renderActualsCommandHelpResult(
    renderable as unknown as ActualsCommandHelpResult,
  ).replaceAll("CLI Contract 6", "CLI Contract 8");
}
