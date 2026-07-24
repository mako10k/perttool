import type { Diagnostic } from "../model/diagnostics.js";
import { TOOL_VERSION } from "../version.js";
import {
  COMMAND_REGISTRY,
  commandDescriptorToJson,
} from "./registry.js";
import type {
  CommandDescriptor,
  CommandExample,
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
  }),
  Object.freeze({
    name: "project",
    summary: "Inspect and maintain effective project metadata.",
  }),
  Object.freeze({
    name: "dag",
    summary: "Analyze, select, advance, and convert the project graph.",
  }),
  Object.freeze({
    name: "task",
    summary: "Maintain task edges through source-preserving previews.",
  }),
  Object.freeze({
    name: "milestone",
    summary: "Maintain milestone nodes through source-preserving previews.",
  }),
  Object.freeze({
    name: "resource",
    summary: "Maintain resource capacities through source-preserving previews.",
  }),
  Object.freeze({
    name: "batch",
    summary: "Apply one typed atomic mutation request as a preview.",
  }),
  Object.freeze({
    name: "agent",
    summary: "Inspect bundled offline AI agent guidance.",
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
const projectedByPath = new Map(
  projectedDescriptors.map((descriptor) => [pathKey(descriptor.path), descriptor]),
);
const orderedDescriptors: ProjectedCommandDescriptor[] = [helpDescriptor];

const guideDescriptor = projectedByPath.get("guide");
if (guideDescriptor === undefined) {
  throw new Error("Contract 3 guide descriptor is missing");
}
orderedDescriptors.push(guideDescriptor);

for (const resource of resourceDefinitions) {
  const commands = projectedDescriptors.filter(
    (descriptor) =>
      descriptor.path.length === 2 && descriptor.path[0] === resource.name,
  );
  if (commands.length === 0) {
    throw new Error(`Contract 3 resource ${resource.name} has no commands`);
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
if (orderedDescriptors.length !== projectedDescriptors.length + 1) {
  throw new Error("Contract 3 command projection has an unregistered resource");
}

export const CONTRACT3_COMMAND_HELP_REGISTRY:
readonly ProjectedCommandDescriptor[] = Object.freeze(orderedDescriptors);

const contract3CommandsByPath = new Map(
  CONTRACT3_COMMAND_HELP_REGISTRY.map(
    (descriptor) => [pathKey(descriptor.path), descriptor],
  ),
);

const resourceSummaries: readonly CommandResourceSummary[] = Object.freeze(
  resourceDefinitions.map((resource) =>
    Object.freeze({
      ...resource,
      actions: Object.freeze(
        CONTRACT3_COMMAND_HELP_REGISTRY.flatMap((descriptor) =>
          descriptor.path.length === 2 && descriptor.path[0] === resource.name
            ? [descriptor.path[1]]
            : []
        ),
      ),
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
      "perttool command catalog (CLI Contract 3 preview)",
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
