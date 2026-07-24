import type { Diagnostic } from "../model/diagnostics.js";
import { TOOL_VERSION } from "../version.js";
import {
  COMMAND_REGISTRY,
  commandDescriptorToJson,
} from "./registry.js";
import type {
  CommandDescriptor,
  CommandExample,
  OperandDescriptor,
  OptionDescriptor,
  ProjectedCommandDescriptor,
} from "./registry.js";

export interface CommandHelpQuery {
  readonly resource: string | null;
  readonly action: string | null;
}

export interface CommandResourceSummary {
  readonly name: string;
  readonly summary: string;
  readonly actions: readonly string[];
}

export interface CommandHelpResult {
  readonly schemaVersion: "Perttool.CommandHelpResult.v1";
  readonly cliContractVersion: 3;
  readonly toolVersion: string;
  readonly operation: "help";
  readonly ok: boolean;
  readonly query: CommandHelpQuery;
  readonly resources: readonly CommandResourceSummary[];
  readonly commands: readonly ProjectedCommandDescriptor[];
  readonly diagnostics: readonly Diagnostic[];
}

interface Contract3Mapping {
  readonly path:
    | readonly [command: string]
    | readonly [resource: string, action: string];
  readonly operation: string;
  readonly resultSchemaReplacements?: Readonly<Record<string, string>>;
}

interface ResourceDefinition {
  readonly name: string;
  readonly summary: string;
  readonly actionOrder: readonly string[];
}

const contract3Mappings: Readonly<Record<string, Contract3Mapping>> =
  Object.freeze({
    "dsl.check": {
      path: ["document", "check"],
      operation: "document.check",
    },
    "dsl.format": {
      path: ["document", "format"],
      operation: "document.format",
    },
    "dsl.help": {
      path: ["guide"],
      operation: "guide",
      resultSchemaReplacements: {
        "Perttool.HelpResult.v1": "Perttool.GuideResult.v1",
      },
    },
    "mutation.apply": {
      path: ["batch", "apply"],
      operation: "batch.apply",
    },
  });

const resourceDefinitions: readonly ResourceDefinition[] = Object.freeze([
  Object.freeze({
    name: "document",
    summary: "Validate and source-format PERT documents.",
    actionOrder: Object.freeze(["check", "format"]),
  }),
  Object.freeze({
    name: "project",
    summary: "Inspect and maintain effective project metadata.",
    actionOrder: Object.freeze(["init", "show", "set"]),
  }),
  Object.freeze({
    name: "dag",
    summary: "Analyze, select, advance, and convert the project graph.",
    actionOrder: Object.freeze(["analyze", "next", "advance", "render", "import"]),
  }),
  Object.freeze({
    name: "task",
    summary: "Maintain task edges through source-preserving previews.",
    actionOrder: Object.freeze(["add", "set", "remove", "finish"]),
  }),
  Object.freeze({
    name: "gate",
    summary: "Maintain zero-duration dependency edges through source-preserving previews.",
    actionOrder: Object.freeze(["add", "set", "remove"]),
  }),
  Object.freeze({
    name: "milestone",
    summary: "Maintain milestone nodes through source-preserving previews.",
    actionOrder: Object.freeze(["add", "set", "remove"]),
  }),
  Object.freeze({
    name: "resource",
    summary: "Maintain resource capacities through source-preserving previews.",
    actionOrder: Object.freeze(["add", "set", "remove"]),
  }),
  Object.freeze({
    name: "batch",
    summary: "Apply one typed atomic mutation request as a preview.",
    actionOrder: Object.freeze(["apply"]),
  }),
  Object.freeze({
    name: "agent",
    summary: "Inspect bundled offline AI agent guidance.",
    actionOrder: Object.freeze(["help"]),
  }),
]);

const helpDescriptor: ProjectedCommandDescriptor = Object.freeze({
  contractVersion: 3,
  path: Object.freeze(["help"] as const),
  operation: "help",
  summary: "Discovers the complete implemented command contract.",
  operands: Object.freeze([
    Object.freeze({
      name: "resource",
      valueType: "command-resource",
      required: false,
      position: 0,
    }),
    Object.freeze({
      name: "action",
      valueType: "command-action",
      required: false,
      position: 1,
    }),
  ]),
  options: Object.freeze([
    Object.freeze({
      name: "format",
      kind: "value",
      valueType: "output-format",
      required: false,
      repeatable: false,
      defaultValue: "text",
      enumValues: Object.freeze(["text", "json"]),
      conflicts: Object.freeze([]),
      requires: Object.freeze([]),
      sharedGroup: null,
      spelling: Object.freeze({
        cli: "--format",
        dsl: null,
        json: "format",
      }),
    }),
  ]),
  input: "none",
  output: Object.freeze({
    formats: Object.freeze(["text", "json"] as const),
    payload: "result",
    fileEffect: "none",
  }),
  stdin: Object.freeze({
    document: false,
    artifact: false,
    request: false,
    mutuallyExclusive: false,
  }),
  effect: "read",
  resultSchemas: Object.freeze([
    "Perttool.CommandHelpResult.v1",
    "Perttool.CliError.v1",
  ]),
  exitStatuses: Object.freeze([
    Object.freeze({ code: 0, meaning: "Successful command lookup." }),
    Object.freeze({ code: 1, meaning: "Command-help lookup failure." }),
    Object.freeze({ code: 2, meaning: "CLI usage error." }),
    Object.freeze({ code: 70, meaning: "Internal invariant or programmer error." }),
  ]),
  examples: Object.freeze([
    Object.freeze({
      id: "catalog",
      invocation: "perttool help --format json",
      summary: "Return the complete implemented command catalog.",
    }),
    Object.freeze({
      id: "resource",
      invocation: "perttool help project --format json",
      summary: "Return every project action.",
    }),
    Object.freeze({
      id: "action",
      invocation: "perttool help project show --format json",
      summary: "Return the complete project show contract.",
    }),
  ]),
});

function contract3Path(descriptor: CommandDescriptor): Contract3Mapping {
  return contract3Mappings[descriptor.operation] ?? {
    path: descriptor.path,
    operation: descriptor.operation,
  };
}

function projectExample(
  example: CommandExample,
  sourcePath: CommandDescriptor["path"],
  targetPath: ProjectedCommandDescriptor["path"],
): CommandExample {
  const sourcePrefix = `perttool ${sourcePath.join(" ")}`;
  const targetPrefix = `perttool ${targetPath.join(" ")}`;
  if (!example.invocation.startsWith(sourcePrefix)) {
    throw new Error(
      `command example ${example.id} does not start with ${sourcePrefix}`,
    );
  }
  return Object.freeze({
    ...example,
    invocation: `${targetPrefix}${example.invocation.slice(sourcePrefix.length)}`,
  });
}

function projectContract3Descriptor(
  descriptor: CommandDescriptor,
): ProjectedCommandDescriptor {
  const mapping = contract3Path(descriptor);
  return Object.freeze({
    contractVersion: 3,
    path: Object.freeze([...mapping.path]) as ProjectedCommandDescriptor["path"],
    operation: mapping.operation,
    summary: descriptor.summary,
    operands: descriptor.operands,
    options: descriptor.options,
    input: descriptor.input,
    output: descriptor.output,
    stdin: descriptor.stdin,
    effect: descriptor.effect,
    resultSchemas: Object.freeze(
      descriptor.resultSchemas.map(
        (schema) => mapping.resultSchemaReplacements?.[schema] ?? schema,
      ),
    ),
    exitStatuses: descriptor.exitStatuses,
    examples: Object.freeze(
      descriptor.examples.map((example) =>
        projectExample(example, descriptor.path, mapping.path)
      ),
    ),
  });
}

function pathKey(path: ProjectedCommandDescriptor["path"]): string {
  return path.join("\0");
}

const projectedDescriptors = COMMAND_REGISTRY.map(projectContract3Descriptor);
const projectedMutationTemplate = projectedDescriptors.find(
  ({ operation }) => operation === "resource.remove",
);
if (projectedMutationTemplate === undefined) {
  throw new Error("Contract 3 mutation descriptor template is missing");
}
const mutationTemplate: ProjectedCommandDescriptor = projectedMutationTemplate;

function targetOperand(
  name: string,
  position: number,
  valueType: string,
): OperandDescriptor {
  return Object.freeze({
    name,
    position,
    valueType,
    required: true,
  });
}

function targetOption(
  name: "from" | "to" | "reason",
  required = false,
): OptionDescriptor {
  return Object.freeze({
    name,
    kind: "value",
    valueType: name === "reason" ? "text" : "milestone-id",
    required,
    repeatable: false,
    defaultValue: null,
    enumValues: Object.freeze([]),
    conflicts: Object.freeze([]),
    requires: Object.freeze([]),
    sharedGroup: null,
    spelling: Object.freeze({
      cli: `--${name}`,
      dsl: name,
      json: name,
    }),
  });
}

interface TargetValueOption {
  readonly valueType: string;
  readonly required?: boolean;
  readonly defaultValue?: string | number | null;
  readonly enumValues?: readonly string[];
  readonly conflicts?: readonly string[];
  readonly dsl?: string | null;
}

function targetValueOption(
  name: string,
  config: TargetValueOption,
): OptionDescriptor {
  return Object.freeze({
    name,
    kind: "value",
    valueType: config.valueType,
    required: config.required ?? false,
    repeatable: false,
    defaultValue: config.defaultValue ?? null,
    enumValues: Object.freeze([...(config.enumValues ?? [])]),
    conflicts: Object.freeze([...(config.conflicts ?? [])]),
    requires: Object.freeze([]),
    sharedGroup: null,
    spelling: Object.freeze({
      cli: `--${name}`,
      dsl: config.dsl ?? null,
      json: name.replaceAll("-", "_"),
    }),
  });
}

function projectInitDescriptor(): ProjectedCommandDescriptor {
  return Object.freeze({
    contractVersion: 3,
    path: Object.freeze(["project", "init"] as const),
    operation: "project.init",
    summary: "Previews the smallest valid project document or creates it exclusively.",
    operands: Object.freeze([
      targetOperand("project-id", 0, "project-id"),
    ]),
    options: Object.freeze([
      targetValueOption("title", {
        valueType: "text",
        required: true,
        dsl: "title",
      }),
      targetValueOption("duration-unit", {
        valueType: "duration-unit",
        required: true,
        enumValues: ["day", "hour", "point"],
        dsl: "duration_unit",
      }),
      targetValueOption("initial-milestone", {
        valueType: "milestone-id",
        required: true,
      }),
      targetValueOption("initial-milestone-title", {
        valueType: "text",
        required: true,
      }),
      targetValueOption("finish", {
        valueType: "milestone-id",
        required: true,
        dsl: "finish",
      }),
      targetValueOption("version", {
        valueType: "integer",
        defaultValue: 1,
        dsl: "version",
      }),
      targetValueOption("as-of", {
        valueType: "date-or-date-time",
        dsl: "as_of",
      }),
      targetValueOption("velocity", {
        valueType: "velocity",
        dsl: "velocity",
      }),
      targetValueOption("out", {
        valueType: "path",
      }),
      targetValueOption("format", {
        valueType: "output-format",
        defaultValue: "text",
        enumValues: ["text", "json"],
      }),
      targetValueOption("color", {
        valueType: "color-mode",
        defaultValue: "auto",
        enumValues: ["auto", "always", "never"],
        conflicts: ["format=json when color=always"],
      }),
    ]),
    input: "none",
    output: Object.freeze({
      formats: Object.freeze(["text", "json"] as const),
      payload: "candidate-document",
      fileEffect: "optional-create",
    }),
    stdin: Object.freeze({
      document: false,
      artifact: false,
      request: false,
      mutuallyExclusive: false,
    }),
    effect: "write-or-create",
    resultSchemas: Object.freeze([
      "Perttool.InitResult.v1",
      "Perttool.CliError.v1",
    ]),
    exitStatuses: Object.freeze([
      Object.freeze({ code: 0, meaning: "Successful preview or exclusive creation." }),
      Object.freeze({ code: 1, meaning: "Candidate validation failure." }),
      Object.freeze({ code: 2, meaning: "CLI usage error." }),
      Object.freeze({ code: 3, meaning: "Output or encoding error." }),
      Object.freeze({ code: 5, meaning: "Existing target, symlink, or creation conflict." }),
      Object.freeze({ code: 70, meaning: "Internal invariant or programmer error." }),
    ]),
    examples: Object.freeze([
      Object.freeze({
        id: "preview",
        invocation: "perttool project init SAMPLE --title \"Sample project\" --duration-unit day --initial-milestone START --initial-milestone-title \"Project started\" --finish START",
        summary: "Preview the complete smallest valid project document.",
      }),
      Object.freeze({
        id: "out",
        invocation: "perttool project init SAMPLE --title \"Sample project\" --duration-unit day --initial-milestone START --initial-milestone-title \"Project started\" --finish START --out plan.pert",
        summary: "Create a new project document without overwriting a path.",
      }),
    ]),
  });
}

const gateMutationOperands = Object.freeze([
  targetOperand("file", 0, "path-or-stdin"),
  targetOperand("id", 1, "gate-id"),
]);

function gateDescriptor(
  action: "add" | "set" | "remove",
): ProjectedCommandDescriptor {
  const options =
    action === "add"
      ? [...mutationTemplate.options, targetOption("reason", true)]
      : action === "set"
        ? [
            ...mutationTemplate.options,
            targetOption("from"),
            targetOption("to"),
            targetOption("reason"),
          ]
        : mutationTemplate.options;
  const operands =
    action === "add"
      ? [
          ...gateMutationOperands,
          targetOperand("from", 2, "milestone-id"),
          targetOperand("to", 3, "milestone-id"),
        ]
      : gateMutationOperands;
  const detail =
    action === "add"
      ? "adding one gate"
      : action === "set"
        ? "source-preserving gate endpoint or reason changes"
        : "removing one gate without cascading";
  const invocation =
    action === "add"
      ? "perttool gate add plan.pert APPROVAL READY DONE --reason \"Approval required\" --diff"
      : action === "set"
        ? "perttool gate set plan.pert APPROVAL --reason \"Review accepted\" --diff"
        : "perttool gate remove plan.pert APPROVAL --diff";
  return Object.freeze({
    contractVersion: 3,
    path: Object.freeze(["gate", action] as const),
    operation: `gate.${action}`,
    summary: `Previews ${detail}.`,
    operands: Object.freeze(operands),
    options: Object.freeze(options),
    input: mutationTemplate.input,
    output: mutationTemplate.output,
    stdin: mutationTemplate.stdin,
    effect: mutationTemplate.effect,
    resultSchemas: mutationTemplate.resultSchemas,
    exitStatuses: mutationTemplate.exitStatuses,
    examples: Object.freeze([
      Object.freeze({
        id: action,
        invocation,
        summary: `Preview gate ${action}.`,
      }),
    ]),
  });
}

const targetOnlyDescriptors = Object.freeze([
  projectInitDescriptor(),
  gateDescriptor("add"),
  gateDescriptor("set"),
  gateDescriptor("remove"),
]);
const contract3Descriptors = Object.freeze([
  ...projectedDescriptors,
  ...targetOnlyDescriptors,
]);
const projectedByPath = new Map(
  contract3Descriptors.map((descriptor) => [pathKey(descriptor.path), descriptor]),
);
const orderedDescriptors: ProjectedCommandDescriptor[] = [helpDescriptor];

const guideDescriptor = projectedByPath.get("guide");
if (guideDescriptor === undefined) {
  throw new Error("Contract 3 guide descriptor is missing");
}
orderedDescriptors.push(guideDescriptor);

for (const resource of resourceDefinitions) {
  const commands = contract3Descriptors
    .filter(
      (descriptor) =>
        descriptor.path.length === 2 && descriptor.path[0] === resource.name,
    )
    .sort(
      (left, right) =>
        resource.actionOrder.indexOf(left.path[1]!)
        - resource.actionOrder.indexOf(right.path[1]!),
    );
  if (commands.length === 0) {
    throw new Error(`Contract 3 resource ${resource.name} has no commands`);
  }
  if (
    commands.length !== resource.actionOrder.length
    || commands.some(
      (descriptor, index) => descriptor.path[1] !== resource.actionOrder[index],
    )
  ) {
    throw new Error(`Contract 3 resource ${resource.name} action order is incomplete`);
  }
  orderedDescriptors.push(...commands);
}

if (
  new Set(orderedDescriptors.map((descriptor) => pathKey(descriptor.path))).size
  !== orderedDescriptors.length
) {
  throw new Error("duplicate Contract 3 command path");
}
if (
  new Set(orderedDescriptors.map(({ operation }) => operation)).size
  !== orderedDescriptors.length
) {
  throw new Error("duplicate Contract 3 command operation");
}
if (orderedDescriptors.length !== contract3Descriptors.length + 1) {
  throw new Error("Contract 3 command projection has an unregistered resource");
}

export const CONTRACT3_COMMAND_REGISTRY:
readonly ProjectedCommandDescriptor[] = Object.freeze(orderedDescriptors);

export const CONTRACT3_COMMAND_HELP_REGISTRY = CONTRACT3_COMMAND_REGISTRY;

export function commandRegistryToJson(): readonly Readonly<Record<string, unknown>>[] {
  return CONTRACT3_COMMAND_REGISTRY.map(commandDescriptorToJson);
}

const contract3CommandsByPath = new Map(
  CONTRACT3_COMMAND_HELP_REGISTRY.map(
    (descriptor) => [pathKey(descriptor.path), descriptor],
  ),
);

const resourceSummaries: readonly CommandResourceSummary[] = Object.freeze(
  resourceDefinitions.map((resource) =>
    Object.freeze({
      name: resource.name,
      summary: resource.summary,
      actions: resource.actionOrder,
    })
  ),
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
  commands: readonly ProjectedCommandDescriptor[],
  diagnostics: readonly Diagnostic[],
): CommandHelpResult {
  return Object.freeze({
    schemaVersion: "Perttool.CommandHelpResult.v1",
    cliContractVersion: 3,
    toolVersion: TOOL_VERSION,
    operation: "help",
    ok: diagnostics.length === 0,
    query: Object.freeze({ ...query }),
    resources: Object.freeze([...resources]),
    commands: Object.freeze([...commands]),
    diagnostics: Object.freeze([...diagnostics]),
  });
}

export function getCommandDiscovery(
  query: CommandHelpQuery,
): CommandHelpResult {
  if (query.resource === null) {
    if (query.action !== null) {
      return result(
        query,
        [],
        [],
        [diagnostic("PTHLP-002", "a command action requires a resource", query)],
      );
    }
    return result(
      query,
      resourceSummaries,
      CONTRACT3_COMMAND_HELP_REGISTRY,
      [],
    );
  }

  if (query.action === null) {
    const topLevel = contract3CommandsByPath.get(query.resource);
    if (topLevel !== undefined && topLevel.path.length === 1) {
      return result(query, [], [topLevel], []);
    }
    const resourceIndex = resourceDefinitions.findIndex(
      ({ name }) => name === query.resource,
    );
    if (resourceIndex === -1) {
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
    const resource = resourceSummaries[resourceIndex];
    if (resource === undefined) {
      throw new Error("command resource summary invariant failed");
    }
    return result(
      query,
      [resource],
      CONTRACT3_COMMAND_HELP_REGISTRY.filter(
        (descriptor) =>
          descriptor.path.length === 2
          && descriptor.path[0] === query.resource,
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
  const command = contract3CommandsByPath.get(
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

export function commandHelpResultToJson(
  value: CommandHelpResult,
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
    commands: value.commands.map(commandDescriptorToJson),
    diagnostics: value.diagnostics.map(diagnosticToJson),
  };
}

export function serializeCommandHelpResult(
  value: CommandHelpResult,
): string {
  return `${JSON.stringify(commandHelpResultToJson(value), null, 2)}\n`;
}

function list(values: readonly string[]): string {
  return values.length === 0 ? "-" : values.join(", ");
}

function renderDescriptor(
  descriptor: ProjectedCommandDescriptor,
): readonly string[] {
  const lines = [
    `Command: perttool ${descriptor.path.join(" ")}`,
    `Summary: ${descriptor.summary}`,
    `Operation: ${descriptor.operation}`,
    `CLI contract: ${descriptor.contractVersion}`,
    "Operands:",
  ];
  if (descriptor.operands.length === 0) {
    lines.push("  -");
  }
  for (const operand of descriptor.operands) {
    lines.push(
      `  ${operand.position}: ${operand.name} type=${operand.valueType} required=${operand.required}`,
    );
  }
  lines.push("Options:");
  if (descriptor.options.length === 0) {
    lines.push("  -");
  }
  for (const option of descriptor.options) {
    lines.push(
      `  --${option.name} kind=${option.kind} type=${option.valueType ?? "-"} required=${option.required} repeatable=${option.repeatable}`,
      `    default=${JSON.stringify(option.defaultValue)} enum=${list(option.enumValues)} shared=${option.sharedGroup ?? "-"}`,
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

export function renderCommandHelpResult(
  value: CommandHelpResult,
): string {
  if (!value.ok) {
    return `${[
      "Command help lookup failed.",
      ...value.diagnostics.map(
        ({ code, severity, message }) => `${code} ${severity}: ${message}`,
      ),
    ].join("\n")}\n`;
  }

  if (value.query.resource === null) {
    const topLevel = value.commands.filter(
      ({ path }) => path.length === 1,
    );
    const lines = [
      "perttool command catalog (CLI Contract 3)",
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
              path.length === 2
              && path[0] === resource.name
              && path[1] === action,
          );
          if (command === undefined) {
            throw new Error("command resource projection invariant failed");
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
      throw new Error("command resource projection invariant failed");
    }
    return `${[
      `perttool ${resource.name} commands`,
      resource.summary,
      "",
      "Actions:",
      ...value.commands.map(
        (descriptor) => `  ${descriptor.path[1]}  ${descriptor.summary}`,
      ),
    ].join("\n")}\n`;
  }

  const descriptor = value.commands[0];
  if (descriptor === undefined) {
    throw new Error("command help result has no descriptor");
  }
  return `${renderDescriptor(descriptor).join("\n")}\n`;
}
