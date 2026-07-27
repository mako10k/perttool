import type { Diagnostic } from "../model/diagnostics.js";
import { TOOL_VERSION } from "../version.js";
import {
  CONTRACT4_COMMAND_REGISTRY,
  getCommandDiscovery,
  type CommandHelpQuery,
  type CommandResourceSummary,
} from "./discovery.js";
import type {
  CommandExample,
  OptionDescriptor,
  ProjectedCommandDescriptor,
  SharedOptionGroup,
} from "./registry.js";

export type TargetGovernanceSharedOptionGroup =
  | SharedOptionGroup
  | "governance";

export interface TargetGovernanceOptionDescriptor
  extends Omit<OptionDescriptor, "sharedGroup"> {
  readonly sharedGroup: TargetGovernanceSharedOptionGroup | null;
  readonly description: string | null;
}

export interface TargetGovernanceCommandDescriptor
  extends Omit<
    ProjectedCommandDescriptor,
    "contractVersion" | "options"
  > {
  readonly contractVersion: 5;
  readonly options: readonly TargetGovernanceOptionDescriptor[];
}

export interface TargetGovernanceCommandHelpResult {
  readonly schemaVersion: "Perttool.CommandHelpResult.v1";
  readonly cliContractVersion: 5;
  readonly toolVersion: string;
  readonly operation: "help";
  readonly ok: boolean;
  readonly query: CommandHelpQuery;
  readonly resources: readonly CommandResourceSummary[];
  readonly commands: readonly TargetGovernanceCommandDescriptor[];
  readonly diagnostics: readonly Diagnostic[];
}

const commonProjectionOptionNames = new Set([
  "diff",
  "write",
  "expect-digest",
  "out",
  "max-diagnostics",
  "warnings-as-errors",
  "format",
  "color",
]);

const governedOperations = new Set([
  "project.set",
  "dag.advance",
  "task.add",
  "task.set",
  "task.remove",
  "gate.add",
  "gate.set",
  "gate.remove",
  "milestone.add",
  "milestone.remove",
  "batch.apply",
]);

function valueOption(
  name: string,
  valueType: string,
  config: {
    readonly repeatable?: boolean;
    readonly dsl?: string | null;
    readonly sharedGroup?: TargetGovernanceSharedOptionGroup | null;
    readonly description?: string;
  } = {},
): TargetGovernanceOptionDescriptor {
  return Object.freeze({
    name,
    kind: "value",
    valueType,
    required: false,
    repeatable: config.repeatable ?? false,
    defaultValue: null,
    enumValues: Object.freeze([]),
    conflicts: Object.freeze([]),
    requires: Object.freeze([]),
    sharedGroup: config.sharedGroup ?? null,
    description: config.description ?? null,
    spelling: Object.freeze({
      cli: `--${name}`,
      dsl: config.dsl ?? null,
      json: name.replaceAll("-", "_"),
    }),
  });
}

const governanceAssertionOptions = Object.freeze([
  valueOption("actor", "principal-id", {
    sharedGroup: "governance",
    description:
      "Caller principal evaluated against the pre-change owner and delegates.",
  }),
  valueOption("accepted-by-owner", "principal-id", {
    repeatable: true,
    sharedGroup: "governance",
    description:
      "Caller assertion that the named effective owner was consulted.",
  }),
]);

const governanceProjectOptions = Object.freeze([
  valueOption("goal-owner", "principal-id", {
    dsl: "goal_owner",
    description: "Declares the goal owner.",
  }),
  valueOption("goal-delegates", "principal-list", {
    dsl: "goal_delegates",
    description: "Declares the goal delegate set.",
  }),
  valueOption("dag-owner", "principal-id", {
    dsl: "dag_owner",
    description: "Declares the DAG owner.",
  }),
  valueOption("dag-delegates", "principal-list", {
    dsl: "dag_delegates",
    description: "Declares the DAG delegate set.",
  }),
]);

function insertDomainOptions(
  options: readonly TargetGovernanceOptionDescriptor[],
  additions: readonly TargetGovernanceOptionDescriptor[],
): readonly TargetGovernanceOptionDescriptor[] {
  const existing = new Set(options.map(({ name }) => name));
  for (const option of additions) {
    if (existing.has(option.name)) {
      throw new Error(`Contract 5 option --${option.name} already exists`);
    }
    existing.add(option.name);
  }
  const insertionIndex = options.findIndex(({ name }) =>
    commonProjectionOptionNames.has(name)
  );
  return Object.freeze(
    insertionIndex < 0
      ? [...options, ...additions]
      : [
          ...options.slice(0, insertionIndex),
          ...additions,
          ...options.slice(insertionIndex),
        ],
  );
}

function targetOptions(
  descriptor: ProjectedCommandDescriptor,
): readonly TargetGovernanceOptionDescriptor[] {
  let options = Object.freeze(
    descriptor.options.map(
      (option) =>
        Object.freeze({
          ...option,
          description: null,
        }) as TargetGovernanceOptionDescriptor,
    ),
  );
  if (
    descriptor.operation === "project.init" ||
    descriptor.operation === "project.set"
  ) {
    options = insertDomainOptions(options, governanceProjectOptions);
  }
  if (descriptor.operation === "project.set") {
    options = Object.freeze(
      options.map((option) =>
        option.name !== "clear"
          ? option
          : Object.freeze({
              ...option,
              enumValues: Object.freeze([
                ...option.enumValues,
                "goal_owner",
                "goal_delegates",
                "dag_owner",
                "dag_delegates",
              ]),
            }),
      ),
    );
  }
  if (governedOperations.has(descriptor.operation)) {
    options = insertDomainOptions(options, governanceAssertionOptions);
  }
  return options;
}

function targetExamples(
  descriptor: ProjectedCommandDescriptor,
): readonly CommandExample[] {
  if (descriptor.operation !== "project.set") {
    return descriptor.examples;
  }
  return Object.freeze([
    ...descriptor.examples,
    Object.freeze({
      id: "governed-preview",
      invocation:
        "perttool project set plan.pert --finish NEW_FINISH --actor codex --diff",
      summary:
        "Preview goal authority facts without requiring owner confirmation.",
    }),
    Object.freeze({
      id: "governed-write",
      invocation:
        "perttool project set plan.pert --finish NEW_FINISH --actor codex --accepted-by-owner user --write",
      summary:
        "Persist with a caller assertion that the effective owner was consulted.",
    }),
  ]);
}

function targetSchemas(
  descriptor: ProjectedCommandDescriptor,
): readonly string[] {
  return Object.freeze(
    descriptor.resultSchemas.map((schema) =>
      schema === "Perttool.ProjectResult.v2"
        ? "Perttool.ProjectResult.v3"
        : schema === "Perttool.MutationResult.v1"
          ? "Perttool.MutationResult.v2"
          : schema
    ),
  );
}

function targetDescriptor(
  descriptor: ProjectedCommandDescriptor,
): TargetGovernanceCommandDescriptor {
  return Object.freeze({
    ...descriptor,
    contractVersion: 5,
    options: targetOptions(descriptor),
    resultSchemas: targetSchemas(descriptor),
    examples: targetExamples(descriptor),
  });
}

export const TARGET_GOVERNANCE_COMMAND_REGISTRY:
readonly TargetGovernanceCommandDescriptor[] = Object.freeze(
  CONTRACT4_COMMAND_REGISTRY.map(targetDescriptor),
);

const activeCatalog = getCommandDiscovery({
  resource: null,
  action: null,
});
if (!activeCatalog.ok) {
  throw new Error("Contract 4 command catalog is unavailable");
}
const resourceSummaries = activeCatalog.resources;
const targetCommandsByPath = new Map(
  TARGET_GOVERNANCE_COMMAND_REGISTRY.map((descriptor) => [
    descriptor.path.join("\0"),
    descriptor,
  ]),
);

function diagnostic(
  code: "PTHLP-002" | "PTHLP-003",
  message: string,
  query: CommandHelpQuery,
): Diagnostic {
  return Object.freeze({
    code,
    severity: "error",
    message,
    data: Object.freeze({
      resource: query.resource,
      action: query.action,
    }),
  });
}

function result(
  query: CommandHelpQuery,
  resources: readonly CommandResourceSummary[],
  commands: readonly TargetGovernanceCommandDescriptor[],
  diagnostics: readonly Diagnostic[],
): TargetGovernanceCommandHelpResult {
  return Object.freeze({
    schemaVersion: "Perttool.CommandHelpResult.v1",
    cliContractVersion: 5,
    toolVersion: TOOL_VERSION,
    operation: "help",
    ok: diagnostics.length === 0,
    query: Object.freeze({ ...query }),
    resources: Object.freeze([...resources]),
    commands: Object.freeze([...commands]),
    diagnostics: Object.freeze([...diagnostics]),
  });
}

export function getTargetGovernanceCommandDiscovery(
  query: CommandHelpQuery,
): TargetGovernanceCommandHelpResult {
  if (query.resource === null) {
    if (query.action !== null) {
      return result(
        query,
        [],
        [],
        [
          diagnostic(
            "PTHLP-002",
            "a command action requires a resource",
            query,
          ),
        ],
      );
    }
    return result(
      query,
      resourceSummaries,
      TARGET_GOVERNANCE_COMMAND_REGISTRY,
      [],
    );
  }
  if (query.action === null) {
    const topLevel = targetCommandsByPath.get(query.resource);
    if (topLevel !== undefined && topLevel.path.length === 1) {
      return result(query, [], [topLevel], []);
    }
    const resource = resourceSummaries.find(
      ({ name }) => name === query.resource,
    );
    if (resource === undefined) {
      return result(
        query,
        [],
        [],
        [
          diagnostic(
            "PTHLP-002",
            `unknown command resource or top-level command: ${query.resource}`,
            query,
          ),
        ],
      );
    }
    return result(
      query,
      [resource],
      TARGET_GOVERNANCE_COMMAND_REGISTRY.filter(
        (descriptor) =>
          descriptor.path.length === 2 &&
          descriptor.path[0] === query.resource,
      ),
      [],
    );
  }
  const resource = resourceSummaries.find(
    ({ name }) => name === query.resource,
  );
  if (resource === undefined) {
    return result(
      query,
      [],
      [],
      [
        diagnostic(
          "PTHLP-002",
          `unknown command resource: ${query.resource}`,
          query,
        ),
      ],
    );
  }
  const command = targetCommandsByPath.get(
    `${query.resource}\0${query.action}`,
  );
  if (command === undefined) {
    return result(
      query,
      [],
      [],
      [
        diagnostic(
          "PTHLP-003",
          `unknown action ${query.action} for command resource ${query.resource}`,
          query,
        ),
      ],
    );
  }
  return result(query, [resource], [command], []);
}

function optionToJson(
  option: TargetGovernanceOptionDescriptor,
): Readonly<Record<string, unknown>> {
  return {
    name: option.name,
    kind: option.kind,
    value_type: option.valueType,
    required: option.required,
    repeatable: option.repeatable,
    default: option.defaultValue,
    enum_values: option.enumValues,
    conflicts: option.conflicts,
    requires: option.requires,
    shared_group: option.sharedGroup,
    description: option.description,
    spelling: option.spelling,
  };
}

export function targetGovernanceCommandDescriptorToJson(
  descriptor: TargetGovernanceCommandDescriptor,
): Readonly<Record<string, unknown>> {
  return {
    cli_contract_version: descriptor.contractVersion,
    path: descriptor.path,
    operation: descriptor.operation,
    summary: descriptor.summary,
    operands: descriptor.operands.map((operand) => ({
      name: operand.name,
      value_type: operand.valueType,
      required: operand.required,
      position: operand.position,
    })),
    options: descriptor.options.map(optionToJson),
    input: descriptor.input,
    output: {
      formats: descriptor.output.formats,
      payload: descriptor.output.payload,
      file_effect: descriptor.output.fileEffect,
    },
    stdin: {
      document: descriptor.stdin.document,
      artifact: descriptor.stdin.artifact,
      request: descriptor.stdin.request,
      mutually_exclusive: descriptor.stdin.mutuallyExclusive,
    },
    effect: descriptor.effect,
    result_schemas: descriptor.resultSchemas,
    exit_statuses: descriptor.exitStatuses,
    examples: descriptor.examples,
  };
}

function diagnosticToJson(
  value: Diagnostic,
): Readonly<Record<string, unknown>> {
  return {
    code: value.code,
    severity: value.severity,
    message: value.message,
    data: value.data ?? null,
  };
}

export function targetGovernanceCommandHelpResultToJson(
  value: TargetGovernanceCommandHelpResult,
): Readonly<Record<string, unknown>> {
  return {
    schema_version: value.schemaVersion,
    cli_contract_version: value.cliContractVersion,
    tool_version: value.toolVersion,
    operation: value.operation,
    ok: value.ok,
    query: {
      resource: value.query.resource,
      action: value.query.action,
    },
    resources: value.resources.map((resource) => ({
      name: resource.name,
      summary: resource.summary,
      actions: resource.actions,
    })),
    commands: value.commands.map(
      targetGovernanceCommandDescriptorToJson,
    ),
    diagnostics: value.diagnostics.map(diagnosticToJson),
  };
}

export function serializeTargetGovernanceCommandHelpResult(
  value: TargetGovernanceCommandHelpResult,
): string {
  return `${
    JSON.stringify(targetGovernanceCommandHelpResultToJson(value), null, 2)
  }\n`;
}

function list(values: readonly string[]): string {
  return values.length === 0 ? "-" : values.join(", ");
}

function renderDescriptor(
  descriptor: TargetGovernanceCommandDescriptor,
): readonly string[] {
  const lines = [
    `Command: perttool ${descriptor.path.join(" ")}`,
    `Summary: ${descriptor.summary}`,
    `Operation: ${descriptor.operation}`,
    `CLI contract: ${descriptor.contractVersion}`,
    "Operands:",
  ];
  if (descriptor.operands.length === 0) lines.push("  -");
  for (const operand of descriptor.operands) {
    lines.push(
      `  ${operand.position}: ${operand.name} type=${operand.valueType} required=${operand.required}`,
    );
  }
  lines.push("Options:");
  if (descriptor.options.length === 0) lines.push("  -");
  for (const option of descriptor.options) {
    lines.push(
      `  --${option.name} kind=${option.kind} type=${option.valueType ?? "-"} required=${option.required} repeatable=${option.repeatable}`,
      `    default=${JSON.stringify(option.defaultValue)} enum=${list(option.enumValues)} shared=${option.sharedGroup ?? "-"}`,
      `    description=${option.description ?? "-"}`,
      `    conflicts=${list(option.conflicts)} requires=${list(option.requires)}`,
      `    spelling cli=${option.spelling.cli} dsl=${option.spelling.dsl ?? "-"} json=${option.spelling.json}`,
    );
  }
  lines.push(
    `Input: ${descriptor.input}`,
    `Stdin: document=${descriptor.stdin.document} artifact=${descriptor.stdin.artifact} request=${descriptor.stdin.request} mutually-exclusive=${descriptor.stdin.mutuallyExclusive}`,
    `Effect: ${descriptor.effect}`,
    `Output: formats=${descriptor.output.formats.join(",")} payload=${descriptor.output.payload} file-effect=${descriptor.output.fileEffect}`,
    `Result schemas: ${list(descriptor.resultSchemas)}`,
    "Exit statuses:",
  );
  for (const status of descriptor.exitStatuses) {
    lines.push(`  ${status.code}: ${status.meaning}`);
  }
  lines.push("Examples:");
  for (const example of descriptor.examples) {
    lines.push(
      `  ${example.id}: ${example.invocation}`,
      `    ${example.summary}`,
    );
  }
  return lines;
}

export function renderTargetGovernanceCommandHelpResult(
  value: TargetGovernanceCommandHelpResult,
): string {
  if (!value.ok) {
    return `${[
      "Command help lookup failed.",
      ...value.diagnostics.map(
        ({ code, severity, message }) =>
          `${code} ${severity}: ${message}`,
      ),
    ].join("\n")}\n`;
  }
  if (value.query.resource === null) {
    const topLevel = value.commands.filter(({ path }) => path.length === 1);
    const lines = [
      "perttool command catalog (CLI Contract 5)",
      "",
      "Top-level commands:",
      ...topLevel.map(
        (descriptor) =>
          `  ${descriptor.path[0]}  ${descriptor.summary}`,
      ),
      "",
      "Resources:",
    ];
    for (const resource of value.resources) {
      lines.push(
        `  ${resource.name}  ${resource.summary}`,
        ...resource.actions.map((action) => {
          const command = value.commands.find(
            ({ path }) =>
              path.length === 2 &&
              path[0] === resource.name &&
              path[1] === action,
          );
          if (command === undefined) {
            throw new Error(
              "target command resource projection invariant failed",
            );
          }
          return `    ${action}  ${command.summary}`;
        }),
      );
    }
    return `${lines.join("\n")}\n`;
  }
  if (value.query.action === null && value.resources.length === 1) {
    const resource = value.resources[0];
    if (resource === undefined) {
      throw new Error(
        "target command resource projection invariant failed",
      );
    }
    return `${[
      `perttool ${resource.name} commands`,
      resource.summary,
      "",
      "Actions:",
      ...value.commands.map(
        (descriptor) =>
          `  ${descriptor.path[1]}  ${descriptor.summary}`,
      ),
    ].join("\n")}\n`;
  }
  const descriptor = value.commands[0];
  if (descriptor === undefined) {
    throw new Error("target command help result has no descriptor");
  }
  return `${renderDescriptor(descriptor).join("\n")}\n`;
}
