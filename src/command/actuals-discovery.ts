import type { Diagnostic } from "../model/diagnostics.js";
import { TOOL_VERSION } from "../version.js";
import type {
  CommandHelpQuery,
  CommandResourceSummary,
} from "./discovery.js";
import type {
  OperandDescriptor,
} from "./registry.js";
import {
  TARGET_GOVERNANCE_COMMAND_REGISTRY,
  getTargetGovernanceCommandDiscovery,
  renderTargetGovernanceCommandHelpResult,
  serializeTargetGovernanceCommandHelpResult,
  targetGovernanceCommandDescriptorToJson,
  targetGovernanceCommandHelpResultToJson,
  type TargetGovernanceCommandDescriptor,
  type TargetGovernanceCommandHelpResult,
  type TargetGovernanceOptionDescriptor,
} from "./target-governance-discovery.js";

export interface ActualsCommandDescriptor
  extends Omit<
    TargetGovernanceCommandDescriptor,
    "contractVersion" | "options"
  > {
  readonly contractVersion: 6;
  readonly options: readonly TargetGovernanceOptionDescriptor[];
}

export interface ActualsCommandHelpResult {
  readonly schemaVersion: "Perttool.CommandHelpResult.v1";
  readonly cliContractVersion: 6;
  readonly toolVersion: string;
  readonly operation: "help";
  readonly ok: boolean;
  readonly query: CommandHelpQuery;
  readonly resources: readonly CommandResourceSummary[];
  readonly commands: readonly ActualsCommandDescriptor[];
  readonly diagnostics: readonly Diagnostic[];
}

function valueOption(
  name: string,
  valueType: string,
  config: {
    readonly required?: boolean;
    readonly repeatable?: boolean;
    readonly defaultValue?: string | number | boolean | null;
    readonly enumValues?: readonly string[];
    readonly requires?: readonly string[];
    readonly sharedGroup?:
      TargetGovernanceOptionDescriptor["sharedGroup"];
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
    conflicts: Object.freeze([]),
    requires: Object.freeze([...(config.requires ?? [])]),
    sharedGroup: config.sharedGroup ?? null,
    description: config.description ?? null,
    spelling: Object.freeze({
      cli: `--${name}`,
      dsl: null,
      json: name.replaceAll("-", "_"),
    }),
  });
}

const governanceOptions = Object.freeze([
  valueOption("actor", "principal-id", {
    sharedGroup: "governance",
    description:
      "Caller principal evaluated against the pre-change owner and delegates.",
  }),
  valueOption("accepted-by-owner", "principal-id", {
    repeatable: true,
    sharedGroup: "governance",
    description:
      "Single-candidate caller assertion that the named effective owner was consulted for the previewed affected scopes; do not reuse it across commands.",
  }),
]);

function contract6Schemas(
  schemas: readonly string[],
): readonly string[] {
  return Object.freeze(
    schemas.map((schema) =>
      schema === "Perttool.CheckResult.v2"
        ? "Perttool.CheckResult.v3"
        : schema === "Perttool.AnalysisResult.v3"
          ? "Perttool.AnalysisResult.v4"
          : schema === "Perttool.NextResult.v4"
            ? "Perttool.NextResult.v5"
            : schema === "Perttool.MutationResult.v2"
              ? "Perttool.MutationResult.v3"
              : schema === "Perttool.UnitMigrationResult.v2"
                ? "Perttool.UnitMigrationResult.v3"
                : schema,
    ),
  );
}

function contract6Descriptor(
  descriptor: TargetGovernanceCommandDescriptor,
): ActualsCommandDescriptor {
  const lifecycleFinish = descriptor.operation === "task.finish";
  const lifecycleOptions = lifecycleFinish
    ? [
        valueOption("at", "date-time"),
        valueOption("event-id", "identifier"),
        valueOption("active-time", "hours"),
        valueOption("effort", "person-hours"),
        ...governanceOptions,
      ]
    : [];
  const projectionIndex = descriptor.options.findIndex(
    ({ sharedGroup }) =>
      sharedGroup === "preview" ||
      sharedGroup === "write" ||
      sharedGroup === "diagnostics" ||
      sharedGroup === "result",
  );
  const options =
    lifecycleOptions.length === 0
      ? descriptor.options
      : Object.freeze(
          projectionIndex < 0
            ? [...descriptor.options, ...lifecycleOptions]
            : [
                ...descriptor.options.slice(0, projectionIndex),
                ...lifecycleOptions,
                ...descriptor.options.slice(projectionIndex),
              ],
        );
  return Object.freeze({
    ...descriptor,
    contractVersion: 6,
    options,
    resultSchemas: contract6Schemas(descriptor.resultSchemas),
  });
}

const base = TARGET_GOVERNANCE_COMMAND_REGISTRY.map(contract6Descriptor);
const finish = base.find(({ operation }) => operation === "task.finish");
const projectShow = base.find(({ operation }) => operation === "project.show");
const help = base.find(({ operation }) => operation === "help");
if (finish === undefined || projectShow === undefined || help === undefined) {
  throw new Error("Contract 6 descriptor bases are unavailable");
}
const finishBase = finish;
const projectShowBase = projectShow;
const helpBase = help;

const schemaDescriptor: ActualsCommandDescriptor = Object.freeze({
  ...helpBase,
  path: Object.freeze(["schema"] as const),
  operation: "schema",
  summary: "Lists and resolves bundled JSON Schema artifacts.",
  operands: Object.freeze([
    Object.freeze({
      name: "schema-id",
      valueType: "schema-id",
      required: false,
      position: 0,
    }),
  ]),
  options: Object.freeze([
    valueOption("view", "schema-view", {
      defaultValue: "full",
      enumValues: ["full", "outline"],
      description:
        "Return the complete artifact or a reference-based outline projection.",
    }),
    valueOption("ref", "URI-reference", {
      requires: ["view=outline"],
      description:
        "Select one bundled reference as the current outline detail layer.",
    }),
    ...helpBase.options,
  ]),
  resultSchemas: Object.freeze([
    "Perttool.SchemaResult.v1",
    "Perttool.CliError.v1",
  ]),
  exitStatuses: Object.freeze([
    Object.freeze({
      code: 0 as const,
      meaning: "Successful JSON Schema lookup.",
    }),
    Object.freeze({
      code: 1 as const,
      meaning: "Unknown schema identity or unavailable bundled reference.",
    }),
    Object.freeze({
      code: 2 as const,
      meaning: "CLI usage error.",
    }),
    Object.freeze({
      code: 70 as const,
      meaning: "Internal invariant or programmer error.",
    }),
  ]),
  examples: Object.freeze([
    Object.freeze({
      id: "catalog",
      invocation: "perttool schema --format json",
      summary: "Return the complete bundled result-schema catalog.",
    }),
    Object.freeze({
      id: "result",
      invocation:
        "perttool schema Perttool.NextResult.v5 --format json",
      summary: "Return one bundled JSON Schema artifact.",
    }),
    Object.freeze({
      id: "outline",
      invocation:
        "perttool schema Perttool.NextResult.v5 --view outline --format json",
      summary: "Return a shorter reference-based outer shape.",
    }),
    Object.freeze({
      id: "detail",
      invocation:
        "perttool schema Perttool.NextResult.v5 --view outline --ref '#/$defs/recommendation' --format json",
      summary: "Return one referenced internal detail layer.",
    }),
  ]),
});

function lifecycleDescriptor(
  action: "start" | "suspend" | "resume",
): ActualsCommandDescriptor {
  const domainOptions = [
    valueOption("at", "date-time", { required: true }),
    valueOption("event-id", "identifier"),
    ...(action === "suspend"
      ? [valueOption("reason", "text")]
      : []),
    ...governanceOptions,
  ];
  const projectionOptions = finishBase.options.filter(
    ({ sharedGroup, name }) =>
      sharedGroup !== "governance" &&
      name !== "at" &&
      name !== "event-id" &&
      name !== "active-time" &&
      name !== "effort",
  );
  return Object.freeze({
    ...finishBase,
    path: Object.freeze(["task", action] as const),
    operation: `task.${action}`,
    summary:
      action === "start"
        ? "Previews starting one task with explicit evidence."
        : action === "suspend"
          ? "Previews suspending one active task with explicit evidence."
          : "Previews resuming one suspended task with explicit evidence.",
    options: Object.freeze([...domainOptions, ...projectionOptions]),
    resultSchemas: Object.freeze([
      "Perttool.MutationResult.v3",
      "Perttool.CliError.v1",
    ]),
    examples: Object.freeze([
      Object.freeze({
        id: action,
        invocation:
          `perttool task ${action} plan.pert BUILD --at 2026-07-29T09:00:00+09:00 --diff`,
        summary: `Preview task ${action} with an explicit event time.`,
      }),
    ]),
  });
}

const fileOperand: OperandDescriptor = Object.freeze({
  name: "file",
  valueType: "path",
  required: true,
  position: 0,
});

function readDescriptor(
  action: "history" | "observe-velocity",
): ActualsCommandDescriptor {
  const observation = action === "observe-velocity";
  const projectionOptions = projectShowBase.options.filter(
    ({ sharedGroup }) =>
      sharedGroup === "diagnostics" || sharedGroup === "result",
  );
  return Object.freeze({
    ...projectShowBase,
    path: Object.freeze(["project", action] as const),
    operation: `project.${action}`,
    summary: observation
      ? "Observes exact project performance without changing declared velocity."
      : "Reconstructs task actuals from first-parent Git history.",
    operands: Object.freeze([fileOperand]),
    options: Object.freeze([
      valueOption("rev", "git-revision"),
      valueOption("task", "task-id", { repeatable: true }),
      ...(observation
        ? [
            valueOption("evidence", "evidence-class", {
              enumValues: ["declared", "git-recorded", "all"],
            }),
          ]
        : []),
      ...projectionOptions,
    ]),
    stdin: Object.freeze({
      document: false,
      artifact: false,
      request: false,
      mutuallyExclusive: false,
    }),
    resultSchemas: Object.freeze([
      observation
        ? "Perttool.VelocityObservationResult.v1"
        : "Perttool.ProjectHistoryResult.v1",
      "Perttool.CliError.v1",
    ]),
    examples: Object.freeze([
      Object.freeze({
        id: action,
        invocation:
          `perttool project ${action} plan.pert --task BUILD --format json`,
        summary: observation
          ? "Observe declared actuals for one task."
          : "Inspect first-parent history for one task.",
      }),
    ]),
  });
}

export const ACTUALS_COMMAND_REGISTRY:
  readonly ActualsCommandDescriptor[] = Object.freeze(
    base.flatMap((descriptor) => {
      if (descriptor.operation === "help") {
        return [descriptor, schemaDescriptor];
      }
      if (descriptor.operation === "project.show") {
        return [
          descriptor,
          readDescriptor("history"),
          readDescriptor("observe-velocity"),
        ];
      }
      if (descriptor.operation === "task.finish") {
        return [
          lifecycleDescriptor("start"),
          lifecycleDescriptor("suspend"),
          lifecycleDescriptor("resume"),
          descriptor,
        ];
      }
      return [descriptor];
    }),
  );

const baseCatalog = getTargetGovernanceCommandDiscovery({
  resource: null,
  action: null,
});
if (!baseCatalog.ok) {
  throw new Error("Contract 5 command catalog is unavailable");
}
const resourceSummaries = Object.freeze(
  baseCatalog.resources.map((resource) =>
    Object.freeze({
      ...resource,
      actions: Object.freeze(
        ACTUALS_COMMAND_REGISTRY
          .filter(
            ({ path }) =>
              path.length === 2 && path[0] === resource.name,
          )
          .map(({ path }) => path[1]!)
          .sort(),
      ),
    }),
  ),
);
const commandsByPath = new Map(
  ACTUALS_COMMAND_REGISTRY.map((descriptor) => [
    descriptor.path.join("\0"),
    descriptor,
  ]),
);

function helpDiagnostic(
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

function helpResult(
  query: CommandHelpQuery,
  resources: readonly CommandResourceSummary[],
  commands: readonly ActualsCommandDescriptor[],
  diagnostics: readonly Diagnostic[],
): ActualsCommandHelpResult {
  return Object.freeze({
    schemaVersion: "Perttool.CommandHelpResult.v1",
    cliContractVersion: 6,
    toolVersion: TOOL_VERSION,
    operation: "help",
    ok: diagnostics.length === 0,
    query: Object.freeze({ ...query }),
    resources: Object.freeze([...resources]),
    commands: Object.freeze([...commands]),
    diagnostics: Object.freeze([...diagnostics]),
  });
}

export function getActualsCommandDiscovery(
  query: CommandHelpQuery,
): ActualsCommandHelpResult {
  if (query.resource === null) {
    return query.action === null
      ? helpResult(query, resourceSummaries, ACTUALS_COMMAND_REGISTRY, [])
      : helpResult(
          query,
          [],
          [],
          [helpDiagnostic(
            "PTHLP-002",
            "a command action requires a resource",
            query,
          )],
        );
  }
  if (query.action === null) {
    const topLevel = commandsByPath.get(query.resource);
    if (topLevel !== undefined && topLevel.path.length === 1) {
      return helpResult(query, [], [topLevel], []);
    }
    const resource = resourceSummaries.find(
      ({ name }) => name === query.resource,
    );
    return resource === undefined
      ? helpResult(
          query,
          [],
          [],
          [helpDiagnostic(
            "PTHLP-002",
            `unknown command resource or top-level command: ${query.resource}`,
            query,
          )],
        )
      : helpResult(
          query,
          [resource],
          ACTUALS_COMMAND_REGISTRY.filter(
            ({ path }) =>
              path.length === 2 && path[0] === query.resource,
          ),
          [],
        );
  }
  const resource = resourceSummaries.find(
    ({ name }) => name === query.resource,
  );
  if (resource === undefined) {
    return helpResult(
      query,
      [],
      [],
      [helpDiagnostic(
        "PTHLP-002",
        `unknown command resource: ${query.resource}`,
        query,
      )],
    );
  }
  const command = commandsByPath.get(
    `${query.resource}\0${query.action}`,
  );
  return command === undefined
    ? helpResult(
        query,
        [],
        [],
        [helpDiagnostic(
          "PTHLP-003",
          `unknown action ${query.action} for command resource ${query.resource}`,
          query,
        )],
      )
    : helpResult(query, [resource], [command], []);
}

export function actualsCommandDescriptorToJson(
  descriptor: ActualsCommandDescriptor,
): Readonly<Record<string, unknown>> {
  return targetGovernanceCommandDescriptorToJson(
    descriptor as unknown as TargetGovernanceCommandDescriptor,
  );
}

export function actualsCommandRegistryToJson():
  readonly Readonly<Record<string, unknown>>[] {
  return ACTUALS_COMMAND_REGISTRY.map(actualsCommandDescriptorToJson);
}

export function serializeActualsCommandHelpResult(
  value: ActualsCommandHelpResult,
): string {
  return serializeTargetGovernanceCommandHelpResult(
    value as unknown as TargetGovernanceCommandHelpResult,
  );
}

export function actualsCommandHelpResultToJson(
  value: ActualsCommandHelpResult,
): Readonly<Record<string, unknown>> {
  return targetGovernanceCommandHelpResultToJson(
    value as unknown as TargetGovernanceCommandHelpResult,
  );
}

export function renderActualsCommandHelpResult(
  value: ActualsCommandHelpResult,
): string {
  return renderTargetGovernanceCommandHelpResult(
    value as unknown as TargetGovernanceCommandHelpResult,
  ).replace(
    "perttool command catalog (CLI Contract 5)",
    "perttool command catalog (CLI Contract 6)",
  );
}
