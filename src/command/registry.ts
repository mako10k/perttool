export type CommandHandler =
  | "agent-help"
  | "analyze"
  | "check"
  | "domain-help"
  | "format"
  | "import"
  | "mutation"
  | "next"
  | "project-show"
  | "advance"
  | "render";

export type SharedOptionGroup =
  | "diagnostics"
  | "guide"
  | "preview"
  | "result"
  | "write";

export interface OperandDescriptor {
  readonly name: string;
  readonly valueType: string;
  readonly required: boolean;
  readonly position: number;
}

export interface OptionDescriptor {
  readonly name: string;
  readonly kind: "flag" | "value";
  readonly valueType: string | null;
  readonly required: boolean;
  readonly repeatable: boolean;
  readonly defaultValue: string | number | boolean | null;
  readonly enumValues: readonly string[];
  readonly conflicts: readonly string[];
  readonly requires: readonly string[];
  readonly sharedGroup: SharedOptionGroup | null;
  readonly spelling: {
    readonly cli: string;
    readonly dsl: string | null;
    readonly json: string;
  };
}

export interface ExitStatusDescriptor {
  readonly code: 0 | 1 | 2 | 3 | 4 | 5 | 70;
  readonly meaning: string;
}

export interface CommandExample {
  readonly id: string;
  readonly invocation: string;
  readonly summary: string;
}

export interface CommandOutputDescriptor {
  readonly formats: readonly ["text", "json"];
  readonly payload: "result" | "candidate-document" | "artifact";
  readonly fileEffect: "none" | "optional-create" | "optional-write-or-create";
}

export interface ProjectedCommandDescriptor {
  readonly contractVersion: 2 | 3 | 4;
  readonly path:
    | readonly [command: string]
    | readonly [resource: string, action: string];
  readonly operation: string;
  readonly summary: string;
  readonly operands: readonly OperandDescriptor[];
  readonly options: readonly OptionDescriptor[];
  readonly input: "none" | "document" | "artifact";
  readonly output: CommandOutputDescriptor;
  readonly stdin: {
    readonly document: boolean;
    readonly artifact: boolean;
    readonly request: boolean;
    readonly mutuallyExclusive: boolean;
  };
  readonly effect: "read" | "preview" | "write-or-create";
  readonly resultSchemas: readonly string[];
  readonly exitStatuses: readonly ExitStatusDescriptor[];
  readonly examples: readonly CommandExample[];
}

export interface CommandDescriptor extends ProjectedCommandDescriptor {
  readonly contractVersion: 2;
  readonly path: readonly [resource: string, action: string];
  readonly handler: CommandHandler;
  readonly textHelp: readonly string[];
  readonly topLevelUsage: string | null;
}

interface OptionConfig {
  readonly valueType?: string;
  readonly required?: boolean;
  readonly repeatable?: boolean;
  readonly defaultValue?: string | number | boolean | null;
  readonly enumValues?: readonly string[];
  readonly conflicts?: readonly string[];
  readonly requires?: readonly string[];
  readonly sharedGroup?: SharedOptionGroup | null;
  readonly dsl?: string | null;
  readonly json?: string;
}

interface CommandDefinition
  extends Omit<CommandDescriptor, "contractVersion" | "options" | "output"> {
  readonly optionGroups?: readonly SharedOptionGroup[];
  readonly options?: readonly OptionDescriptor[];
}

const statusMeanings = {
  0: "Successful operation.",
  1: "Document, analysis, validation, help lookup, or warning-policy failure.",
  2: "CLI usage error.",
  3: "Input, output, or encoding error.",
  4: "Loss detected in strict conversion.",
  5: "Optimistic-lock, symlink, or atomic-write conflict.",
  70: "Internal invariant or programmer error.",
} as const;

function exitStatuses(
  ...codes: readonly ExitStatusDescriptor["code"][]
): readonly ExitStatusDescriptor[] {
  return codes.map((code) => Object.freeze({ code, meaning: statusMeanings[code] }));
}

function spelling(name: string, dsl: string | null, json?: string): OptionDescriptor["spelling"] {
  return Object.freeze({
    cli: `--${name}`,
    dsl,
    json: json ?? name.replaceAll("-", "_"),
  });
}

function valueOption(name: string, config: OptionConfig = {}): OptionDescriptor {
  return Object.freeze({
    name,
    kind: "value",
    valueType: config.valueType ?? "string",
    required: config.required ?? false,
    repeatable: config.repeatable ?? false,
    defaultValue: config.defaultValue ?? null,
    enumValues: Object.freeze([...(config.enumValues ?? [])]),
    conflicts: Object.freeze([...(config.conflicts ?? [])]),
    requires: Object.freeze([...(config.requires ?? [])]),
    sharedGroup: config.sharedGroup ?? null,
    spelling: spelling(name, config.dsl ?? null, config.json),
  });
}

function flagOption(name: string, config: OptionConfig = {}): OptionDescriptor {
  return Object.freeze({
    name,
    kind: "flag",
    valueType: null,
    required: config.required ?? false,
    repeatable: false,
    defaultValue: config.defaultValue ?? false,
    enumValues: Object.freeze([]),
    conflicts: Object.freeze([...(config.conflicts ?? [])]),
    requires: Object.freeze([...(config.requires ?? [])]),
    sharedGroup: config.sharedGroup ?? null,
    spelling: spelling(name, config.dsl ?? null, config.json),
  });
}

const sharedOptionGroups: Readonly<Record<SharedOptionGroup, readonly OptionDescriptor[]>> =
  Object.freeze({
    result: Object.freeze([
      valueOption("format", {
        valueType: "output-format",
        defaultValue: "text",
        enumValues: ["text", "json"],
        sharedGroup: "result",
      }),
      valueOption("color", {
        valueType: "color-mode",
        defaultValue: "auto",
        enumValues: ["auto", "always", "never"],
        conflicts: ["format=json when color=always"],
        sharedGroup: "result",
      }),
    ]),
    diagnostics: Object.freeze([
      valueOption("max-diagnostics", {
        valueType: "integer",
        defaultValue: 100,
        sharedGroup: "diagnostics",
      }),
      flagOption("warnings-as-errors", { sharedGroup: "diagnostics" }),
    ]),
    preview: Object.freeze([
      flagOption("diff", {
        conflicts: ["write", "out"],
        sharedGroup: "preview",
      }),
    ]),
    write: Object.freeze([
      flagOption("write", {
        conflicts: ["out", "stdin"],
        sharedGroup: "write",
      }),
      valueOption("out", {
        valueType: "path",
        conflicts: ["write", "diff"],
        sharedGroup: "write",
      }),
      valueOption("expect-digest", {
        valueType: "sha256-digest",
        requires: ["write"],
        sharedGroup: "write",
      }),
    ]),
    guide: Object.freeze([
      valueOption("level", {
        valueType: "help-level",
        defaultValue: "index without a topic; quick with a topic",
        enumValues: ["index", "quick", "detail"],
        sharedGroup: "guide",
      }),
    ]),
  });

function operand(
  name: string,
  position: number,
  required = true,
  valueType = "string",
): OperandDescriptor {
  return Object.freeze({ name, valueType, required, position });
}

const documentOperand = operand("file", 0, true, "path-or-stdin");
const mutationOperands = Object.freeze([
  documentOperand,
  operand("id", 1, true, "identifier"),
]);
const editingGroups = ["result", "diagnostics", "preview", "write"] as const;
const readDocumentGroups = ["result", "diagnostics"] as const;
const noStdin = Object.freeze({
  document: false,
  artifact: false,
  request: false,
  mutuallyExclusive: false,
});
const documentStdin = Object.freeze({
  document: true,
  artifact: false,
  request: false,
  mutuallyExclusive: false,
});
const artifactStdin = Object.freeze({
  document: false,
  artifact: true,
  request: false,
  mutuallyExclusive: false,
});
const mutationRequestStdin = Object.freeze({
  document: true,
  artifact: false,
  request: true,
  mutuallyExclusive: true,
});
const previewHelp =
  "  [--diff] [--write [--expect-digest <digest>] | --out <path>] [--max-diagnostics <integer>] [--warnings-as-errors] [--format text|json] [--color auto|always|never]";

function expandOptions(definition: CommandDefinition): readonly OptionDescriptor[] {
  const expanded: OptionDescriptor[] = [];
  const names = new Set<string>();
  for (const group of definition.optionGroups ?? []) {
    for (const option of sharedOptionGroups[group]) {
      if (names.has(option.name)) {
        throw new Error(`duplicate command option --${option.name} in ${definition.operation}`);
      }
      names.add(option.name);
      expanded.push(option);
    }
  }
  for (const option of definition.options ?? []) {
    if (names.has(option.name)) {
      throw new Error(`duplicate command option --${option.name} in ${definition.operation}`);
    }
    names.add(option.name);
    expanded.push(option);
  }
  return Object.freeze(expanded);
}

function defineCommand(definition: CommandDefinition): CommandDescriptor {
  const output: CommandOutputDescriptor =
    definition.effect === "read"
      ? Object.freeze({
          formats: Object.freeze(["text", "json"] as const),
          payload: "result",
          fileEffect: "none",
        })
      : definition.handler === "render"
        ? Object.freeze({
            formats: Object.freeze(["text", "json"] as const),
            payload: "artifact",
            fileEffect: "optional-create",
          })
        : definition.handler === "import"
          ? Object.freeze({
              formats: Object.freeze(["text", "json"] as const),
              payload: "candidate-document",
              fileEffect: "optional-create",
            })
          : Object.freeze({
              formats: Object.freeze(["text", "json"] as const),
              payload: "candidate-document",
              fileEffect: "optional-write-or-create",
            });
  return Object.freeze({
    contractVersion: 2,
    path: Object.freeze([...definition.path]) as readonly [string, string],
    operation: definition.operation,
    handler: definition.handler,
    summary: definition.summary,
    operands: Object.freeze([...definition.operands]),
    options: expandOptions(definition),
    input: definition.input,
    output,
    stdin: definition.stdin,
    effect: definition.effect,
    resultSchemas: Object.freeze([...definition.resultSchemas]),
    exitStatuses: Object.freeze([...definition.exitStatuses]),
    examples: Object.freeze([...definition.examples]),
    textHelp: Object.freeze([...definition.textHelp]),
    topLevelUsage: definition.topLevelUsage,
  });
}

function example(
  id: string,
  invocation: string,
  summary: string,
): CommandExample {
  return Object.freeze({ id, invocation, summary });
}

const taskEstimateOptions = Object.freeze([
  valueOption("duration", {
    valueType: "duration",
    dsl: "duration",
    conflicts: ["optimistic", "most-likely", "pessimistic"],
  }),
  valueOption("optimistic", {
    valueType: "duration",
    dsl: "estimate.optimistic",
    conflicts: ["duration"],
    requires: ["most-likely", "pessimistic"],
  }),
  valueOption("most-likely", {
    valueType: "duration",
    dsl: "estimate.most_likely",
    conflicts: ["duration"],
    requires: ["optimistic", "pessimistic"],
  }),
  valueOption("pessimistic", {
    valueType: "duration",
    dsl: "estimate.pessimistic",
    conflicts: ["duration"],
    requires: ["optimistic", "most-likely"],
  }),
]);

const taskMetadataOptions = Object.freeze([
  valueOption("title", { dsl: "title" }),
  valueOption("description", { dsl: "description" }),
  valueOption("status", {
    valueType: "task-status",
    enumValues: ["planned", "active", "blocked", "done"],
    dsl: "status",
  }),
  valueOption("priority", { valueType: "integer", dsl: "priority" }),
  valueOption("owner", { dsl: "owner" }),
  valueOption("blocked-reason", { dsl: "blocked_reason" }),
  valueOption("source", { dsl: "source" }),
]);

const commandDefinitions: readonly CommandDefinition[] = [
  {
    path: ["dsl", "check"],
    operation: "dsl.check",
    handler: "check",
    summary: "Validates one PERT document without changing it.",
    operands: [documentOperand],
    optionGroups: readDocumentGroups,
    input: "document",
    stdin: documentStdin,
    effect: "read",
    resultSchemas: ["Perttool.CheckResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 70),
    examples: [example("check", "perttool dsl check plan.pert", "Validate a plan.")],
    textHelp: [
      "Usage: perttool dsl check <file>",
      "  [--warnings-as-errors]",
      "  [--max-diagnostics <integer>]",
      "  [--format text|json]",
      "  [--color auto|always|never]",
    ],
    topLevelUsage: "  perttool dsl check <file> [--format text|json]",
  },
  {
    path: ["dsl", "format"],
    operation: "dsl.format",
    handler: "format",
    summary: "Formats one PERT document and previews changes by default.",
    operands: [documentOperand],
    optionGroups: editingGroups,
    options: [
      flagOption("check", { conflicts: ["write", "out"] }),
    ],
    input: "document",
    stdin: documentStdin,
    effect: "preview",
    resultSchemas: ["Perttool.FormatResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example("diff", "perttool dsl format plan.pert --diff", "Preview a formatting diff.")],
    textHelp: [
      "Usage: perttool dsl format <file>",
      "  [--check] [--diff]",
      "  [--write [--expect-digest <digest>] | --out <path>]",
      "  [--max-diagnostics <integer>] [--warnings-as-errors]",
      "  [--format text|json] [--color auto|always|never]",
    ],
    topLevelUsage: "  perttool dsl format <file> [--check] [--diff] [--format text|json]",
  },
  {
    path: ["dsl", "help"],
    operation: "dsl.help",
    handler: "domain-help",
    summary: "Displays bundled DSL and workflow guidance.",
    operands: [
      operand("topic", 0, false, "help-topic"),
      operand("subtopic", 1, false, "help-topic"),
    ],
    optionGroups: ["guide", "result"],
    input: "none",
    stdin: noStdin,
    effect: "read",
    resultSchemas: ["Perttool.HelpResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 70),
    examples: [example("syntax", "perttool dsl help syntax --level quick", "Show quick syntax guidance.")],
    textHelp: [
      "Usage: perttool dsl help [topic [subtopic]]",
      "  [--level index|quick|detail]",
      "  [--format text|json]",
      "  [--color auto|always|never]",
    ],
    topLevelUsage: "  perttool dsl help [topic [subtopic]] [--level index|quick|detail] [--format text|json]",
  },
  {
    path: ["agent", "help"],
    operation: "agent.help",
    handler: "agent-help",
    summary: "Displays read-only AI agent guidance for each provider from bundled offline profiles.",
    operands: [
      operand("provider", 0, false, "provider-id"),
      operand("surface", 1, false, "surface-id"),
    ],
    optionGroups: ["guide", "result"],
    input: "none",
    stdin: noStdin,
    effect: "read",
    resultSchemas: ["Perttool.AgentGuidanceResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 70),
    examples: [example("index", "perttool agent help", "List bundled provider guidance.")],
    textHelp: [
      "Usage: perttool agent help [<provider> [<surface>]]",
      "  [--level index|quick|detail]",
      "  [--format text|json]",
      "  [--color auto|always|never]",
    ],
    topLevelUsage: "  perttool agent help [provider [surface]] [--level index|quick|detail] [--format text|json]",
  },
  {
    path: ["project", "show"],
    operation: "project.show",
    handler: "project-show",
    summary: "Displays effective project metadata.",
    operands: [documentOperand],
    optionGroups: readDocumentGroups,
    input: "document",
    stdin: documentStdin,
    effect: "read",
    resultSchemas: ["Perttool.ProjectResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 70),
    examples: [example("show", "perttool project show plan.pert", "Read project metadata.")],
    textHelp: [
      "Usage: perttool project show <file>",
      "  [--max-diagnostics <integer>] [--warnings-as-errors]",
      "  [--format text|json] [--color auto|always|never]",
    ],
    topLevelUsage: "  perttool project show <file> [--format text|json]",
  },
  {
    path: ["project", "set"],
    operation: "project.set",
    handler: "mutation",
    summary: "Previews source-preserving project metadata changes.",
    operands: [documentOperand],
    optionGroups: editingGroups,
    options: [
      valueOption("id", { dsl: "project.id" }),
      valueOption("version", { valueType: "integer", dsl: "version" }),
      valueOption("title", { dsl: "title" }),
      valueOption("description", { dsl: "description" }),
      valueOption("as-of", { valueType: "date-or-date-time", dsl: "as_of" }),
      valueOption("duration-unit", {
        valueType: "duration-unit",
        enumValues: ["point", "day", "hour"],
        dsl: "duration_unit",
      }),
      valueOption("velocity", { valueType: "velocity", dsl: "velocity" }),
      valueOption("finish", { valueType: "milestone-id", dsl: "finish" }),
      valueOption("critical-epsilon", { valueType: "duration", dsl: "critical_epsilon" }),
      valueOption("target-duration", { valueType: "duration", dsl: "target_duration" }),
      valueOption("clear", {
        valueType: "project-field",
        repeatable: true,
        enumValues: ["description", "as_of", "velocity", "critical_epsilon", "target_duration"],
      }),
    ],
    input: "document",
    stdin: documentStdin,
    effect: "preview",
    resultSchemas: ["Perttool.MutationResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example("velocity", "perttool project set plan.pert --velocity 29p/2d --diff", "Preview a velocity update.")],
    textHelp: [
      "Usage: perttool project set <file> [field options]",
      "  [--id <id>] [--version <integer>] [--title <text>] [--description <text>]",
      "  [--as-of <date-or-date-time>] [--duration-unit point|day|hour]",
      "  [--velocity <velocity>] [--finish <milestone-id>]",
      "  [--critical-epsilon <duration>] [--target-duration <duration>]",
      "  [--clear description|as_of|velocity|critical_epsilon|target_duration]...",
      "  [--diff] [--write [--expect-digest <digest>] | --out <path>]",
      "  [--max-diagnostics <integer>] [--warnings-as-errors]",
      "  [--format text|json] [--color auto|always|never]",
    ],
    topLevelUsage: "  perttool project set <file> [field options] [--diff] [--write | --out <path>]",
  },
  {
    path: ["dag", "analyze"],
    operation: "dag.analyze",
    handler: "analyze",
    summary: "Analyzes precedence and resource-constrained schedules.",
    operands: [documentOperand],
    optionGroups: readDocumentGroups,
    options: [
      valueOption("schedule", {
        valueType: "analysis-mode",
        defaultValue: "both",
        enumValues: ["precedence", "resource", "both"],
      }),
      valueOption("capacity", {
        valueType: "resource-capacity",
        repeatable: true,
      }),
      valueOption("max-paths", { valueType: "integer", defaultValue: 1 }),
      valueOption("precision", { valueType: "integer", defaultValue: 3 }),
    ],
    input: "document",
    stdin: documentStdin,
    effect: "read",
    resultSchemas: ["Perttool.AnalysisResult.v2", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 70),
    examples: [example("both", "perttool dag analyze plan.pert --schedule both", "Analyze both schedule views.")],
    textHelp: [
      "Usage: perttool dag analyze <file>",
      "  [--schedule precedence|resource|both]",
      "  [--capacity <resource-id>=<integer>]...",
      "  [--max-paths <integer>] [--precision <integer>]",
      "  [--max-diagnostics <integer>]",
      "  [--warnings-as-errors]",
      "  [--format text|json] [--color auto|always|never]",
    ],
    topLevelUsage: "  perttool dag analyze <file> [--schedule precedence|resource|both] [--format text|json]",
  },
  {
    path: ["dag", "next"],
    operation: "dag.next",
    handler: "next",
    summary: "Selects the next resource-feasible task set with a complete explanation.",
    operands: [documentOperand],
    optionGroups: readDocumentGroups,
    options: [
      valueOption("capacity", { valueType: "resource-capacity", repeatable: true }),
      valueOption("explain-depth", { valueType: "integer", defaultValue: 1 }),
      valueOption("precision", { valueType: "integer", defaultValue: 3 }),
    ],
    input: "document",
    stdin: documentStdin,
    effect: "read",
    resultSchemas: ["Perttool.NextResult.v3", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 70),
    examples: [example("json", "perttool dag next plan.pert --format json", "Return recommendation authority as JSON.")],
    textHelp: [
      "Usage: perttool dag next <file>",
      "  [--capacity <resource-id>=<integer>]...",
      "  [--explain-depth <integer>] [--precision <integer>]",
      "  [--max-diagnostics <integer>]",
      "  [--warnings-as-errors]",
      "  [--format text|json] [--color auto|always|never]",
      "Output: Perttool.NextResult.v3 with a complete recommendation graph in JSON.",
      "Consumers must inspect schema_version before using recommendation authority.",
    ],
    topLevelUsage: "  perttool dag next <file> [--capacity <resource-id>=<integer>] [--format text|json]",
  },
  {
    path: ["dag", "advance"],
    operation: "dag.advance",
    handler: "advance",
    summary: "Previews removal of completed history from a PERT document.",
    operands: [documentOperand],
    optionGroups: editingGroups,
    input: "document",
    stdin: documentStdin,
    effect: "preview",
    resultSchemas: ["Perttool.MutationResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example("diff", "perttool dag advance plan.pert --diff", "Preview an advance diff.")],
    textHelp: [
      "Usage: perttool dag advance <file>",
      "  [--diff] [--write [--expect-digest <digest>] | --out <path>]",
      "  [--max-diagnostics <integer>] [--warnings-as-errors]",
      "  [--format text|json] [--color auto|always|never]",
    ],
    topLevelUsage: "  perttool dag advance <file> [--diff] [--write | --out <path>] [--format text|json]",
  },
  {
    path: ["dag", "render"],
    operation: "dag.render",
    handler: "render",
    summary: "Exports a PERT document as a Mermaid artifact.",
    operands: [documentOperand],
    optionGroups: readDocumentGroups,
    options: [
      valueOption("to", {
        valueType: "artifact-format",
        required: true,
        enumValues: ["mermaid"],
      }),
      valueOption("profile", {
        valueType: "mermaid-profile",
        defaultValue: "perttool",
        enumValues: ["perttool", "plain"],
      }),
      valueOption("analysis", {
        valueType: "mermaid-analysis-mode",
        defaultValue: "none",
        enumValues: ["none", "precedence", "resource", "both"],
      }),
      valueOption("capacity", {
        valueType: "resource-capacity",
        repeatable: true,
        requires: ["analysis=resource|both"],
      }),
      flagOption("strict-loss"),
      valueOption("out", { valueType: "path" }),
    ],
    input: "document",
    stdin: documentStdin,
    effect: "write-or-create",
    resultSchemas: ["Perttool.ExportResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 4, 5, 70),
    examples: [example("mermaid", "perttool dag render plan.pert --to mermaid", "Preview Mermaid output.")],
    textHelp: [
      "Usage: perttool dag render <file> --to mermaid",
      "  [--profile perttool|plain] [--analysis none|precedence|resource|both]",
      "  [--capacity <resource-id>=<integer>]... [--strict-loss] [--out <path>]",
      "  [--max-diagnostics <integer>] [--warnings-as-errors]",
      "  [--format text|json] [--color auto|always|never]",
    ],
    topLevelUsage: "  perttool dag render <file> --to mermaid [--profile perttool|plain] [--format text|json]",
  },
  {
    path: ["dag", "import"],
    operation: "dag.import",
    handler: "import",
    summary: "Imports a Mermaid artifact as a candidate PERT document.",
    operands: [documentOperand],
    optionGroups: readDocumentGroups,
    options: [
      valueOption("from", {
        valueType: "artifact-format",
        required: true,
        enumValues: ["mermaid"],
      }),
      flagOption("strict-loss"),
      valueOption("out", { valueType: "path" }),
    ],
    input: "artifact",
    stdin: artifactStdin,
    effect: "write-or-create",
    resultSchemas: ["Perttool.ImportResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 4, 5, 70),
    examples: [example("mermaid", "perttool dag import graph.mmd --from mermaid", "Preview imported DSL.")],
    textHelp: [
      "Usage: perttool dag import <file> --from mermaid",
      "  [--strict-loss] [--out <path>]",
      "  [--max-diagnostics <integer>] [--warnings-as-errors]",
      "  [--format text|json] [--color auto|always|never]",
    ],
    topLevelUsage: "  perttool dag import <file> --from mermaid [--strict-loss] [--out <path>] [--format text|json]",
  },
  {
    path: ["task", "add"],
    operation: "task.add",
    handler: "mutation",
    summary: "Previews adding one task.",
    operands: [
      documentOperand,
      operand("id", 1, true, "task-id"),
      operand("from", 2, true, "milestone-id"),
      operand("to", 3, true, "milestone-id"),
    ],
    optionGroups: editingGroups,
    options: [
      ...taskMetadataOptions.map((option) =>
        option.name === "title"
          ? valueOption("title", { required: true, dsl: "title" })
          : option
      ),
      ...taskEstimateOptions,
      valueOption("tag", { valueType: "tag", repeatable: true, dsl: "tags" }),
      valueOption("require", {
        valueType: "resource-requirement",
        repeatable: true,
        dsl: "requires",
      }),
    ],
    input: "document",
    stdin: documentStdin,
    effect: "preview",
    resultSchemas: ["Perttool.MutationResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example("add", "perttool task add plan.pert BUILD M1 M2 --title Build --duration 2p --diff", "Preview adding a task.")],
    textHelp: [
      "Usage: perttool task add <file> <id> <from> <to>",
      "  --title <text> (--duration <duration> | --optimistic <duration> --most-likely <duration> --pessimistic <duration>)",
      "  [--description <text>] [--status planned|active|blocked|done] [--priority <integer>]",
      "  [--owner <text>] [--blocked-reason <text>] [--source <text>] [--tag <tag>]... [--require <resource-id>=<integer>]...",
      previewHelp,
    ],
    topLevelUsage: "  perttool task add|set|remove|finish ...",
  },
  {
    path: ["task", "set"],
    operation: "task.set",
    handler: "mutation",
    summary: "Previews source-preserving task field changes.",
    operands: mutationOperands,
    optionGroups: editingGroups,
    options: [
      valueOption("from", { valueType: "milestone-id" }),
      valueOption("to", { valueType: "milestone-id" }),
      ...taskMetadataOptions,
      ...taskEstimateOptions,
      valueOption("require", { valueType: "resource-requirement", repeatable: true, dsl: "requires" }),
      valueOption("add-tag", { valueType: "tag", repeatable: true, dsl: "tags" }),
      valueOption("remove-tag", { valueType: "tag", repeatable: true, dsl: "tags" }),
      valueOption("remove-require", { valueType: "resource-id", repeatable: true, dsl: "requires" }),
      valueOption("clear", {
        valueType: "task-field",
        repeatable: true,
        enumValues: [
          "description",
          "status",
          "priority",
          "owner",
          "blocked_reason",
          "source",
          "tags",
          "requires",
        ],
      }),
    ],
    input: "document",
    stdin: documentStdin,
    effect: "preview",
    resultSchemas: ["Perttool.MutationResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example("set", "perttool task set plan.pert BUILD --status active --diff", "Preview changing task status.")],
    textHelp: [
      "Usage: perttool task set <file> <id> [field options]",
      "  [--from <id>] [--to <id>] [--title <text>] [--description <text>] [--duration <duration>]",
      "  [--optimistic <duration> --most-likely <duration> --pessimistic <duration>]",
      "  [--status planned|active|blocked|done] [--priority <integer>] [--owner <text>]",
      "  [--blocked-reason <text>] [--source <text>] [--require <resource-id>=<integer>]...",
      "  [--add-tag <tag>]... [--remove-tag <tag>]... [--remove-require <resource-id>]... [--clear <field>]...",
      previewHelp,
    ],
    topLevelUsage: null,
  },
  ...(["remove", "finish"] as const).map((action): CommandDefinition => ({
    path: ["task", action],
    operation: `task.${action}`,
    handler: "mutation",
    summary: action === "remove" ? "Previews removing one task." : "Previews marking one task done.",
    operands: mutationOperands,
    optionGroups: editingGroups,
    input: "document",
    stdin: documentStdin,
    effect: "preview",
    resultSchemas: ["Perttool.MutationResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example(action, `perttool task ${action} plan.pert BUILD --diff`, `Preview task ${action}.`)],
    textHelp: [
      `Usage: perttool task ${action} <file> <id>`,
      previewHelp,
    ],
    topLevelUsage: null,
  })),
  {
    path: ["milestone", "add"],
    operation: "milestone.add",
    handler: "mutation",
    summary: "Previews adding one milestone.",
    operands: mutationOperands,
    optionGroups: editingGroups,
    options: [
      valueOption("title", { required: true, dsl: "title" }),
      valueOption("description", { dsl: "description" }),
      valueOption("state", {
        valueType: "milestone-state",
        enumValues: ["planned", "reached"],
        dsl: "state",
      }),
      valueOption("tag", { valueType: "tag", repeatable: true, dsl: "tags" }),
    ],
    input: "document",
    stdin: documentStdin,
    effect: "preview",
    resultSchemas: ["Perttool.MutationResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example("add", "perttool milestone add plan.pert M2 --title Done --diff", "Preview adding a milestone.")],
    textHelp: [
      "Usage: perttool milestone add <file> <id> --title <text>",
      "  [--description <text>] [--state planned|reached] [--tag <tag>]...",
      previewHelp,
    ],
    topLevelUsage: "  perttool milestone add|set|remove ...",
  },
  {
    path: ["milestone", "set"],
    operation: "milestone.set",
    handler: "mutation",
    summary: "Previews source-preserving milestone field changes.",
    operands: mutationOperands,
    optionGroups: editingGroups,
    options: [
      valueOption("title", { dsl: "title" }),
      valueOption("description", { dsl: "description" }),
      valueOption("state", {
        valueType: "milestone-state",
        enumValues: ["planned", "reached"],
        dsl: "state",
      }),
      valueOption("add-tag", { valueType: "tag", repeatable: true, dsl: "tags" }),
      valueOption("remove-tag", { valueType: "tag", repeatable: true, dsl: "tags" }),
      valueOption("clear", {
        valueType: "milestone-field",
        repeatable: true,
        enumValues: ["description", "state", "tags"],
      }),
    ],
    input: "document",
    stdin: documentStdin,
    effect: "preview",
    resultSchemas: ["Perttool.MutationResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example("set", "perttool milestone set plan.pert M2 --state reached --diff", "Preview changing milestone state.")],
    textHelp: [
      "Usage: perttool milestone set <file> <id> [--title <text>] [--description <text>] [--state planned|reached]",
      "  [--add-tag <tag>]... [--remove-tag <tag>]... [--clear description|state|tags]...",
      previewHelp,
    ],
    topLevelUsage: null,
  },
  {
    path: ["milestone", "remove"],
    operation: "milestone.remove",
    handler: "mutation",
    summary: "Previews removing one milestone.",
    operands: mutationOperands,
    optionGroups: editingGroups,
    input: "document",
    stdin: documentStdin,
    effect: "preview",
    resultSchemas: ["Perttool.MutationResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example("remove", "perttool milestone remove plan.pert M2 --diff", "Preview removing a milestone.")],
    textHelp: ["Usage: perttool milestone remove <file> <id>", previewHelp],
    topLevelUsage: null,
  },
  {
    path: ["resource", "add"],
    operation: "resource.add",
    handler: "mutation",
    summary: "Previews adding one resource.",
    operands: mutationOperands,
    optionGroups: editingGroups,
    options: [
      valueOption("title", { required: true, dsl: "title" }),
      valueOption("description", { dsl: "description" }),
      valueOption("capacity", { valueType: "integer", required: true, dsl: "capacity" }),
    ],
    input: "document",
    stdin: documentStdin,
    effect: "preview",
    resultSchemas: ["Perttool.MutationResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example("add", "perttool resource add plan.pert DEV --title Developers --capacity 2 --diff", "Preview adding a resource.")],
    textHelp: [
      "Usage: perttool resource add <file> <id> --title <text> --capacity <integer>",
      "  [--description <text>]",
      previewHelp,
    ],
    topLevelUsage: "  perttool resource add|set|remove ...",
  },
  {
    path: ["resource", "set"],
    operation: "resource.set",
    handler: "mutation",
    summary: "Previews source-preserving resource field changes.",
    operands: mutationOperands,
    optionGroups: editingGroups,
    options: [
      valueOption("title", { dsl: "title" }),
      valueOption("description", { dsl: "description" }),
      valueOption("capacity", { valueType: "integer", dsl: "capacity" }),
      valueOption("clear", {
        valueType: "resource-field",
        repeatable: true,
        enumValues: ["description"],
      }),
    ],
    input: "document",
    stdin: documentStdin,
    effect: "preview",
    resultSchemas: ["Perttool.MutationResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example("set", "perttool resource set plan.pert DEV --capacity 3 --diff", "Preview changing capacity.")],
    textHelp: [
      "Usage: perttool resource set <file> <id> [--title <text>] [--description <text>] [--capacity <integer>] [--clear description]",
      previewHelp,
    ],
    topLevelUsage: null,
  },
  {
    path: ["resource", "remove"],
    operation: "resource.remove",
    handler: "mutation",
    summary: "Previews removing one resource.",
    operands: mutationOperands,
    optionGroups: editingGroups,
    input: "document",
    stdin: documentStdin,
    effect: "preview",
    resultSchemas: ["Perttool.MutationResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example("remove", "perttool resource remove plan.pert DEV --diff", "Preview removing a resource.")],
    textHelp: ["Usage: perttool resource remove <file> <id>", previewHelp],
    topLevelUsage: null,
  },
  {
    path: ["mutation", "apply"],
    operation: "mutation.apply",
    handler: "mutation",
    summary: "Previews one typed atomic mutation request.",
    operands: [documentOperand],
    optionGroups: editingGroups,
    options: [
      valueOption("request", {
        valueType: "json-path-or-stdin",
        required: true,
      }),
    ],
    input: "document",
    stdin: mutationRequestStdin,
    effect: "preview",
    resultSchemas: ["Perttool.MutationResult.v1", "Perttool.CliError.v1"],
    exitStatuses: exitStatuses(0, 1, 2, 3, 5, 70),
    examples: [example("apply", "perttool mutation apply plan.pert --request request.json --diff", "Preview an atomic mutation request.")],
    textHelp: [
      "Usage: perttool mutation apply <file> --request <json-file|->",
      previewHelp,
    ],
    topLevelUsage: "  perttool mutation apply <file> --request <json-file|-> [--diff] [--format text|json]",
  },
];

export const COMMAND_REGISTRY: readonly CommandDescriptor[] = Object.freeze(
  commandDefinitions.map(defineCommand),
);

const commandsByPath = new Map<string, CommandDescriptor>();
const commandsByOperation = new Map<string, CommandDescriptor>();
for (const descriptor of COMMAND_REGISTRY) {
  const pathKey = descriptor.path.join("\0");
  if (commandsByPath.has(pathKey)) {
    throw new Error(`duplicate command path: ${descriptor.path.join(" ")}`);
  }
  if (commandsByOperation.has(descriptor.operation)) {
    throw new Error(`duplicate command operation: ${descriptor.operation}`);
  }
  commandsByPath.set(pathKey, descriptor);
  commandsByOperation.set(descriptor.operation, descriptor);
}

export function getCommandDescriptor(
  resource: string,
  action: string,
): CommandDescriptor | null {
  return commandsByPath.get(`${resource}\0${action}`) ?? null;
}

export function getCommandDescriptorByOperation(
  operation: string,
): CommandDescriptor | null {
  return commandsByOperation.get(operation) ?? null;
}

export function renderCommandHelp(descriptor: CommandDescriptor): string {
  return descriptor.textHelp.join("\n");
}

export function commandDescriptorToJson(
  descriptor: ProjectedCommandDescriptor,
): Readonly<Record<string, unknown>> {
  return {
    cli_contract_version: descriptor.contractVersion,
    path: descriptor.path,
    operation: descriptor.operation,
    summary: descriptor.summary,
    operands: descriptor.operands.map((item) => ({
      name: item.name,
      value_type: item.valueType,
      required: item.required,
      position: item.position,
    })),
    options: descriptor.options.map((item) => ({
      name: item.name,
      kind: item.kind,
      value_type: item.valueType,
      required: item.required,
      repeatable: item.repeatable,
      default: item.defaultValue,
      enum_values: item.enumValues,
      conflicts: item.conflicts,
      requires: item.requires,
      shared_group: item.sharedGroup,
      spelling: item.spelling,
    })),
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

export function commandRegistryToJson(): readonly Readonly<Record<string, unknown>>[] {
  return COMMAND_REGISTRY.map(commandDescriptorToJson);
}

export function renderTopLevelHelp(): string {
  return [
    "perttool - document-based PERT/CPM task management",
    "",
    "Usage:",
    "  perttool --version",
    "  perttool --help",
    ...COMMAND_REGISTRY.flatMap((descriptor) =>
      descriptor.topLevelUsage === null ? [] : [descriptor.topLevelUsage]
    ),
    "",
    "Format and mutation commands preview by default; use --write or --out for explicit writes.",
  ].join("\n");
}

export function commandOptionSets(descriptor: {
  readonly options: readonly {
    readonly kind: "value" | "flag";
    readonly name: string;
    readonly repeatable: boolean;
  }[];
}): {
  readonly values: ReadonlySet<string>;
  readonly flags: ReadonlySet<string>;
  readonly repeatable: ReadonlySet<string>;
} {
  const values = new Set<string>();
  const flags = new Set<string>();
  const repeatable = new Set<string>();
  for (const option of descriptor.options) {
    if (option.kind === "flag") {
      flags.add(option.name);
    } else if (option.repeatable) {
      repeatable.add(option.name);
    } else {
      values.add(option.name);
    }
  }
  return { values, flags, repeatable };
}

export function getAgentHelpCommandHelp(): {
  readonly operation: string;
  readonly summary: string;
  readonly syntax: readonly string[];
} {
  const descriptor = getCommandDescriptor("agent", "help");
  if (descriptor === null) throw new Error("agent help command descriptor is missing");
  return {
    operation: descriptor.operation,
    summary: descriptor.summary,
    syntax: descriptor.textHelp,
  };
}
