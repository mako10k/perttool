export const MCP_PROTOCOL_MODEL_VERSION = 1 as const;
export const MCP_PROTOCOL_REVISION = "2026-07-28" as const;
export const MCP_SERVER_NAME = "perttool" as const;
export const MCP_SERVER_VERSION = "0.7.1" as const;

export const MCP_LIMITS = Object.freeze({
  requestBytes: 262_144,
  sourceBytes: 2_097_152,
  outputBytes: 8_388_608,
  registrations: 64,
  capacityOverrides: 256,
  concurrentTools: 8,
  deadlineMilliseconds: 30_000,
  defaultDiagnostics: 100,
  maximumDiagnostics: 1_000,
});

export const MCP_RESOURCE_DEFINITIONS = Object.freeze([
  Object.freeze({
    uri: "perttool://capabilities",
    name: "perttool capabilities",
    description: "Closed read-only perttool MCP capabilities.",
  }),
  Object.freeze({
    uri: "perttool://help/commands",
    name: "perttool command help",
    description: "Complete Contract 7 command discovery.",
  }),
  Object.freeze({
    uri: "perttool://guide/index",
    name: "perttool guide index",
    description: "Contract 7 Guide topic index.",
  }),
  Object.freeze({
    uri: "perttool://schemas",
    name: "perttool schema catalog",
    description: "Bundled public JSON Schema catalog.",
  }),
] as const);

export const MCP_TOOL_DEFINITIONS = Object.freeze([
  Object.freeze({
    name: "perttool_check",
    title: "Check a PERT document",
    description: "Parse and validate one exact PERT document without changing it.",
    operation: "document_check",
    resultSchemaVersion: "Perttool.CheckResult.v4",
    wireSchemaVersion: "Perttool.McpCheckResult.v1",
  }),
  Object.freeze({
    name: "perttool_analyze",
    title: "Analyze a PERT document",
    description: "Compute deterministic precedence and resource analysis without changing the document.",
    operation: "dag_analyze",
    resultSchemaVersion: "Perttool.AnalysisResult.v5",
    wireSchemaVersion: "Perttool.McpAnalyzeResult.v1",
  }),
  Object.freeze({
    name: "perttool_next",
    title: "Select next PERT tasks",
    description: "Return recommendation and complete start-authority evidence without changing the document.",
    operation: "dag_next",
    resultSchemaVersion: "Perttool.NextResult.v6",
    wireSchemaVersion: "Perttool.McpNextResult.v1",
  }),
  Object.freeze({
    name: "perttool_help",
    title: "Read perttool help",
    description: "Read deterministic Contract 7 command help or Guide content.",
    operation: "command_help",
    resultSchemaVersion: "Perttool.CommandHelpResult.v1",
    wireSchemaVersion: "Perttool.McpHelpResult.v1",
  }),
  Object.freeze({
    name: "perttool_schema",
    title: "Read a perttool JSON Schema",
    description: "Read the bundled public JSON Schema catalog or one selected schema.",
    operation: "schema_lookup",
    resultSchemaVersion: "Perttool.SchemaResult.v1",
    wireSchemaVersion: "Perttool.McpSchemaResult.v1",
  }),
] as const);

export type McpToolName = typeof MCP_TOOL_DEFINITIONS[number]["name"];
export type McpOperation =
  | "document_check"
  | "dag_analyze"
  | "dag_next"
  | "command_help"
  | "guide"
  | "schema_lookup";

export interface McpInlineSourceV1 {
  readonly kind: "inline";
  readonly text: string;
  readonly expectedDigest?: `sha256:${string}`;
}

export interface McpRegisteredSourceV1 {
  readonly kind: "registered";
  readonly documentId: string;
  readonly expectedDigest: `sha256:${string}`;
}

export type McpDocumentSourceV1 = McpInlineSourceV1 | McpRegisteredSourceV1;

export interface McpCapacityV1 {
  readonly resourceId: string;
  readonly capacity: number;
}

export interface McpCheckInputV1 {
  readonly source: McpDocumentSourceV1;
  readonly max_diagnostics?: number;
}

export interface McpAnalyzeInputV1 {
  readonly source: McpDocumentSourceV1;
  readonly schedule?: "precedence" | "resource" | "both";
  readonly capacities?: readonly McpCapacityV1[];
  readonly max_paths?: number;
  readonly precision?: number;
  readonly max_diagnostics?: number;
}

export interface McpNextInputV1 {
  readonly source: McpDocumentSourceV1;
  readonly capacities?: readonly McpCapacityV1[];
  readonly explain_depth?: number;
  readonly precision?: number;
  readonly max_diagnostics?: number;
}

export type McpHelpInputV1 =
  | {
      readonly kind: "command";
      readonly resource?: string | null;
      readonly action?: string | null;
    }
  | {
      readonly kind: "guide";
      readonly topic_id?: string | null;
      readonly level?: "index" | "quick" | "detail";
    };

export interface McpSchemaInputV1 {
  readonly schema_id?: string | null;
  readonly view?: "full" | "outline";
  readonly ref?: string | null;
}

export interface McpToolInputByName {
  readonly perttool_check: McpCheckInputV1;
  readonly perttool_analyze: McpAnalyzeInputV1;
  readonly perttool_next: McpNextInputV1;
  readonly perttool_help: McpHelpInputV1;
  readonly perttool_schema: McpSchemaInputV1;
}

export interface McpSourceBindingV1 {
  readonly kind: "inline" | "registered";
  readonly document_id: string | null;
  readonly source_digest: `sha256:${string}`;
}

export type McpSourceDiagnosticCode =
  | "PTMCP-101"
  | "PTMCP-102"
  | "PTMCP-103"
  | "PTMCP-104"
  | "PTMCP-105"
  | "PTMCP-106"
  | "PTMCP-107"
  | "PTMCP-108";

export interface McpSourceErrorV1 {
  readonly schema_version: "Perttool.McpSourceError.v1";
  readonly mcp_protocol_model_version: 1;
  readonly operation: McpOperation;
  readonly source: McpSourceBindingV1 | null;
  readonly diagnostic: {
    readonly code: McpSourceDiagnosticCode;
    readonly severity: "error";
    readonly message: string;
  };
}

export interface McpToolResultV1 {
  readonly schema_version: string;
  readonly mcp_protocol_model_version: 1;
  readonly operation: McpOperation;
  readonly source: McpSourceBindingV1 | null;
  readonly result_schema_version: string;
  readonly result: Readonly<Record<string, unknown>>;
}

export type McpJsonSchema = Readonly<Record<string, unknown>>;

const digestSchema = Object.freeze({
  type: "string",
  pattern: "^sha256:[0-9a-f]{64}$",
});

const inlineSourceSchema = Object.freeze({
  type: "object",
  required: Object.freeze(["kind", "text"]),
  properties: Object.freeze({
    kind: Object.freeze({ const: "inline" }),
    text: Object.freeze({ type: "string" }),
    expectedDigest: digestSchema,
  }),
  additionalProperties: false,
});

const registeredSourceSchema = Object.freeze({
  type: "object",
  required: Object.freeze(["kind", "documentId", "expectedDigest"]),
  properties: Object.freeze({
    kind: Object.freeze({ const: "registered" }),
    documentId: Object.freeze({
      type: "string",
      minLength: 1,
      maxLength: 128,
      pattern: "^[\\x21-\\x7e]+$",
    }),
    expectedDigest: digestSchema,
  }),
  additionalProperties: false,
});

const sourceSchema = Object.freeze({
  oneOf: Object.freeze([inlineSourceSchema, registeredSourceSchema]),
});

const capacitySchema = Object.freeze({
  type: "object",
  required: Object.freeze(["resourceId", "capacity"]),
  properties: Object.freeze({
    resourceId: Object.freeze({ type: "string", minLength: 1 }),
    capacity: Object.freeze({
      type: "integer",
      minimum: 1,
      maximum: 2_147_483_647,
    }),
  }),
  additionalProperties: false,
});

const diagnosticsSchema = Object.freeze({
  type: "integer",
  minimum: 1,
  maximum: MCP_LIMITS.maximumDiagnostics,
});

const capacityListSchema = Object.freeze({
  type: "array",
  maxItems: MCP_LIMITS.capacityOverrides,
  items: capacitySchema,
});

function closedInput(
  required: readonly string[],
  properties: Readonly<Record<string, unknown>>,
  extras: Readonly<Record<string, unknown>> = {},
): McpJsonSchema {
  return Object.freeze({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    required: Object.freeze([...required]),
    properties: Object.freeze({ ...properties }),
    additionalProperties: false,
    ...extras,
  });
}

export const MCP_TOOL_INPUT_SCHEMAS: Readonly<Record<McpToolName, McpJsonSchema>> =
  Object.freeze({
    perttool_check: closedInput(["source"], {
      source: sourceSchema,
      max_diagnostics: diagnosticsSchema,
    }),
    perttool_analyze: closedInput(["source"], {
      source: sourceSchema,
      schedule: Object.freeze({
        type: "string",
        enum: Object.freeze(["precedence", "resource", "both"]),
      }),
      capacities: capacityListSchema,
      max_paths: Object.freeze({ type: "integer", minimum: 0, maximum: 1_000 }),
      precision: Object.freeze({ type: "integer", minimum: 0, maximum: 9 }),
      max_diagnostics: diagnosticsSchema,
    }),
    perttool_next: closedInput(["source"], {
      source: sourceSchema,
      capacities: capacityListSchema,
      explain_depth: Object.freeze({ type: "integer", minimum: 0, maximum: 32 }),
      precision: Object.freeze({ type: "integer", minimum: 0, maximum: 9 }),
      max_diagnostics: diagnosticsSchema,
    }),
    perttool_help: Object.freeze({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      oneOf: Object.freeze([
        closedInput(["kind"], {
          kind: Object.freeze({ const: "command" }),
          resource: Object.freeze({ type: ["string", "null"] }),
          action: Object.freeze({ type: ["string", "null"] }),
        }),
        closedInput(["kind"], {
          kind: Object.freeze({ const: "guide" }),
          topic_id: Object.freeze({ type: ["string", "null"] }),
          level: Object.freeze({
            type: "string",
            enum: Object.freeze(["index", "quick", "detail"]),
          }),
        }),
      ]),
    }),
    perttool_schema: closedInput([], {
      schema_id: Object.freeze({ type: ["string", "null"] }),
      view: Object.freeze({
        type: "string",
        enum: Object.freeze(["full", "outline"]),
      }),
      ref: Object.freeze({ type: ["string", "null"] }),
    }),
  });

export const MCP_TOOL_ANNOTATIONS = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

export function mcpSourceError(
  operation: McpOperation,
  code: McpSourceDiagnosticCode,
  message: string,
  source: McpSourceBindingV1 | null = null,
): McpSourceErrorV1 {
  return Object.freeze({
    schema_version: "Perttool.McpSourceError.v1",
    mcp_protocol_model_version: MCP_PROTOCOL_MODEL_VERSION,
    operation,
    source,
    diagnostic: Object.freeze({ code, severity: "error", message }),
  });
}
