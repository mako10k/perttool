import {
  McpServer,
  ProtocolError,
  ProtocolErrorCode,
  ResourceNotFoundError,
  fromJsonSchema,
  type CallToolResult,
  type JSONObject,
  type ServerContext,
} from "@modelcontextprotocol/server";
import {
  analyzeDocument,
  checkDocument,
  commandHelpResultToJson,
  createNodeHost,
  getCommandDiscovery,
  getGuide,
  getJsonSchemaResult,
  guideResultToJson,
  jsonSchemaResultToJson,
  selectNextTasks,
  type NodeHostPorts,
} from "perttool/node";
import {
  MCP_LIMITS,
  MCP_PROTOCOL_MODEL_VERSION,
  MCP_PROTOCOL_REVISION,
  MCP_RESOURCE_DEFINITIONS,
  MCP_SERVER_NAME,
  MCP_SERVER_VERSION,
  MCP_TOOL_ANNOTATIONS,
  MCP_TOOL_DEFINITIONS,
  MCP_TOOL_INPUT_SCHEMAS,
  mcpSourceError,
  type McpAnalyzeInputV1,
  type McpCapacityV1,
  type McpCheckInputV1,
  type McpHelpInputV1,
  type McpJsonSchema,
  type McpNextInputV1,
  type McpOperation,
  type McpSchemaInputV1,
  type McpSourceErrorV1,
  type McpToolInputByName,
  type McpToolName,
  type McpToolResultV1,
} from "./protocol.js";
import {
  projectAnalysisResult,
  projectCheckResult,
  projectNextResult,
  stripFacadeFields,
} from "./projection.js";
import { MCP_TOOL_OUTPUT_SCHEMAS } from "./schema.js";
import {
  createRegistrationCatalog,
  resolveMcpSource,
  type McpRegisteredDocumentV1,
} from "./source.js";

export interface PerttoolMcpAdapterOptions {
  readonly registrations?: readonly McpRegisteredDocumentV1[];
  readonly host?: NodeHostPorts;
  readonly now?: () => number;
  /** Narrows, but never raises, the accepted output ceiling for boundary tests. */
  readonly outputByteLimit?: number;
}

export interface PerttoolMcpToolResponse {
  readonly content: readonly [{ readonly type: "text"; readonly text: string }];
  readonly structuredContent: McpToolResultV1 | McpSourceErrorV1;
  readonly isError: boolean;
}

export interface PerttoolMcpAdapter {
  readonly resourceUris: readonly string[];
  readonly toolNames: readonly McpToolName[];
  readonly inputSchemas: Readonly<Record<McpToolName, McpJsonSchema>>;
  readonly outputSchemas: Readonly<Record<McpToolName, McpJsonSchema>>;
  readonly readResource: (uri: string) => Promise<Readonly<Record<string, unknown>>>;
  readonly executeTool: <Name extends McpToolName>(
    name: Name,
    input: McpToolInputByName[Name],
    signal?: AbortSignal,
  ) => Promise<PerttoolMcpToolResponse>;
  readonly createServer: () => McpServer;
}

function capacityOverrides(
  capacities: readonly McpCapacityV1[] | undefined,
): ReadonlyMap<string, number> {
  const values = capacities ?? [];
  if (values.length > MCP_LIMITS.capacityOverrides) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      `capacity overrides exceed ${MCP_LIMITS.capacityOverrides}`,
    );
  }
  const result = new Map<string, number>();
  for (const item of values) {
    if (result.has(item.resourceId)) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        `duplicate capacity override: ${item.resourceId}`,
      );
    }
    result.set(item.resourceId, item.capacity);
  }
  return result;
}

function definition(name: McpToolName) {
  const value = MCP_TOOL_DEFINITIONS.find((item) => item.name === name);
  if (value === undefined) throw new Error(`missing MCP tool definition: ${name}`);
  return value;
}

function successResult(
  name: McpToolName,
  operation: McpOperation,
  resultSchemaVersion: string,
  result: Readonly<Record<string, unknown>>,
  source: McpToolResultV1["source"],
): McpToolResultV1 {
  return Object.freeze({
    schema_version: definition(name).wireSchemaVersion,
    mcp_protocol_model_version: MCP_PROTOCOL_MODEL_VERSION,
    operation,
    source,
    result_schema_version: resultSchemaVersion,
    result,
  });
}

function response(
  value: McpToolResultV1 | McpSourceErrorV1,
  isError: boolean,
  maximumOutputBytes: number = MCP_LIMITS.outputBytes,
): PerttoolMcpToolResponse {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text, "utf8") > maximumOutputBytes) {
    const error = mcpSourceError(
      value.operation,
      "PTMCP-105",
      `complete result exceeds ${maximumOutputBytes} bytes`,
      value.source,
    );
    return Object.freeze({
      content: Object.freeze([{ type: "text" as const, text: JSON.stringify(error) }] as const),
      structuredContent: error,
      isError: true,
    });
  }
  return Object.freeze({
    content: Object.freeze([{ type: "text" as const, text }] as const),
    structuredContent: value,
    isError,
  });
}

function cancelled(
  operation: McpOperation,
  maximumOutputBytes: number = MCP_LIMITS.outputBytes,
): PerttoolMcpToolResponse {
  return response(
    mcpSourceError(
      operation,
      "PTMCP-107",
      "request was cancelled or expired before a result became eligible",
    ),
    true,
    maximumOutputBytes,
  );
}

function requestBytes(input: unknown): number {
  return Buffer.byteLength(JSON.stringify(input), "utf8");
}

function validateHelpInput(input: McpHelpInputV1): void {
  if (input.kind === "command") {
    if ((input.action ?? null) !== null && (input.resource ?? null) === null) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        "a command action requires a resource",
      );
    }
    return;
  }
  const topic = input.topic_id ?? null;
  const level = input.level ?? (topic === null ? "index" : "quick");
  if (topic === null && level !== "index") {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      "Guide quick and detail levels require a topic ID",
    );
  }
}

function validateSchemaInput(input: McpSchemaInputV1): void {
  const schemaId = input.schema_id ?? null;
  const hasView = Object.hasOwn(input, "view");
  const view = input.view ?? "full";
  const reference = input.ref ?? null;
  if (schemaId === null && (hasView || reference !== null)) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      "schema view selection requires a schema identity",
    );
  }
  if (reference !== null && view !== "outline") {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      "schema reference selection requires outline view",
    );
  }
}

function resources(): ReadonlyMap<string, Readonly<Record<string, unknown>>> {
  const capabilities = Object.freeze({
    schema_version: "Perttool.McpCapabilities.v1",
    mcp_protocol_model_version: MCP_PROTOCOL_MODEL_VERSION,
    protocol_revision: MCP_PROTOCOL_REVISION,
    transport: "stdio",
    resources: MCP_RESOURCE_DEFINITIONS.map(({ uri, name }) => ({ uri, name })),
    tools: MCP_TOOL_DEFINITIONS.map((tool) => ({
      name: tool.name,
      operation: tool.operation,
      result_schema_version: tool.resultSchemaVersion,
      wire_schema_version: tool.wireSchemaVersion,
    })),
    source_kinds: ["inline", "registered"],
    limits: MCP_LIMITS,
    unavailable: [
      "mutations",
      "arbitrary_paths",
      "git_refs",
      "remote_sources",
      "network_transport",
      "prompts",
      "completions",
      "roots",
      "sampling",
      "elicitation",
      "tasks",
      "logging",
      "subscriptions",
      "list_changed_notifications",
      "extensions",
    ],
  });
  const commandHelp = commandHelpResultToJson(getCommandDiscovery({
    resource: null,
    action: null,
  }));
  const guideIndex = guideResultToJson(getGuide(null, "index"));
  const schemaCatalog = jsonSchemaResultToJson(getJsonSchemaResult(null));
  return new Map([
    [MCP_RESOURCE_DEFINITIONS[0].uri, capabilities],
    [MCP_RESOURCE_DEFINITIONS[1].uri, commandHelp],
    [MCP_RESOURCE_DEFINITIONS[2].uri, guideIndex],
    [MCP_RESOURCE_DEFINITIONS[3].uri, schemaCatalog],
  ]);
}

function operationFor(name: McpToolName, input: McpToolInputByName[McpToolName]): McpOperation {
  if (name === "perttool_help") {
    return (input as McpHelpInputV1).kind === "guide" ? "guide" : "command_help";
  }
  return definition(name).operation;
}

export function createPerttoolMcpAdapter(
  options: PerttoolMcpAdapterOptions = {},
): PerttoolMcpAdapter {
  const host = options.host ?? createNodeHost();
  const now = options.now ?? Date.now;
  const outputByteLimit = options.outputByteLimit ?? MCP_LIMITS.outputBytes;
  if (!Number.isSafeInteger(outputByteLimit) || outputByteLimit < 1) {
    throw new Error("MCP output byte limit must be a positive safe integer");
  }
  const maximumOutputBytes = Math.min(outputByteLimit, MCP_LIMITS.outputBytes);
  const emit = (
    value: McpToolResultV1 | McpSourceErrorV1,
    isError: boolean,
  ) => response(value, isError, maximumOutputBytes);
  const cancel = (operation: McpOperation) =>
    cancelled(operation, maximumOutputBytes);
  const catalog = createRegistrationCatalog(options.registrations);
  const resourceValues = resources();
  let activeTools = 0;

  const readResource = async (
    uri: string,
  ): Promise<Readonly<Record<string, unknown>>> => {
    const value = resourceValues.get(uri);
    if (value === undefined) {
      throw new ResourceNotFoundError(`unknown perttool resource: ${uri}`);
    }
    return value;
  };

  const executeTool = async <Name extends McpToolName>(
    name: Name,
    input: McpToolInputByName[Name],
    signal: AbortSignal = new AbortController().signal,
  ): Promise<PerttoolMcpToolResponse> => {
    const operation = operationFor(name, input);
    if (requestBytes(input) > MCP_LIMITS.requestBytes) {
      return emit(
        mcpSourceError(
          operation,
          "PTMCP-104",
          `request exceeds ${MCP_LIMITS.requestBytes} bytes`,
        ),
        true,
      );
    }
    if (signal.aborted) return cancel(operation);
    if (activeTools >= MCP_LIMITS.concurrentTools) {
      return cancel(operation);
    }
    activeTools += 1;
    const startedAt = now();
    const expired = (): boolean =>
      signal.aborted || now() - startedAt >= MCP_LIMITS.deadlineMilliseconds;
    try {
      if (name === "perttool_help") {
        const value = input as McpHelpInputV1;
        validateHelpInput(value);
        if (expired()) return cancel(operation);
        if (value.kind === "command") {
          const application = getCommandDiscovery({
            resource: value.resource ?? null,
            action: value.action ?? null,
          });
          if (expired()) return cancel(operation);
          return emit(successResult(
            name,
            "command_help",
            application.schemaVersion,
            stripFacadeFields(commandHelpResultToJson(application)),
            null,
          ), !application.ok);
        }
        const topic = value.topic_id ?? null;
        const level = value.level ?? (topic === null ? "index" : "quick");
        const application = getGuide(topic, level);
        if (expired()) return cancel(operation);
        return emit(successResult(
          name,
          "guide",
          application.schemaVersion,
          stripFacadeFields(guideResultToJson(application)),
          null,
        ), !application.ok);
      }

      if (name === "perttool_schema") {
        const value = input as McpSchemaInputV1;
        validateSchemaInput(value);
        if (expired()) return cancel(operation);
        const schemaId = value.schema_id ?? null;
        const application = schemaId === null
          ? getJsonSchemaResult(null)
          : getJsonSchemaResult(schemaId, {
              view: value.view ?? "full",
              ...(value.ref === undefined || value.ref === null
                ? {}
                : { ref: value.ref }),
            });
        if (expired()) return cancel(operation);
        return emit(successResult(
          name,
          "schema_lookup",
          application.schemaVersion,
          stripFacadeFields(jsonSchemaResultToJson(application)),
          null,
        ), !application.ok);
      }

      const documentInput = input as McpCheckInputV1 | McpAnalyzeInputV1 | McpNextInputV1;
      const source = await resolveMcpSource(
        documentInput.source,
        operation,
        catalog,
        host,
      );
      if (!source.ok) return emit(source.error, true);
      if (expired()) return cancel(operation);

      if (name === "perttool_check") {
        const value = input as McpCheckInputV1;
        const application = checkDocument(source.value.text, {
          maxDiagnostics: value.max_diagnostics ?? MCP_LIMITS.defaultDiagnostics,
        });
        if (application.schemaVersion !== definition(name).resultSchemaVersion) {
          return emit(mcpSourceError(
            operation,
            "PTMCP-106",
            "Application check result identity is unavailable",
            source.value.binding,
          ), true);
        }
        if (expired()) return cancel(operation);
        return emit(successResult(
          name,
          operation,
          application.schemaVersion,
          projectCheckResult(application),
          source.value.binding,
        ), !application.ok);
      }

      if (name === "perttool_analyze") {
        const value = input as McpAnalyzeInputV1;
        const application = analyzeDocument(source.value.text, {
          mode: value.schedule ?? "both",
          capacityOverrides: capacityOverrides(value.capacities),
          maxPaths: value.max_paths ?? 1,
          precision: value.precision ?? 3,
          maxDiagnostics: value.max_diagnostics ?? MCP_LIMITS.defaultDiagnostics,
        });
        if (application.schemaVersion !== definition(name).resultSchemaVersion) {
          return emit(mcpSourceError(
            operation,
            "PTMCP-106",
            "Application analysis result identity is unavailable",
            source.value.binding,
          ), true);
        }
        if (expired()) return cancel(operation);
        return emit(successResult(
          name,
          operation,
          application.schemaVersion,
          projectAnalysisResult(application),
          source.value.binding,
        ), !application.ok);
      }

      const value = input as McpNextInputV1;
      const application = selectNextTasks(source.value.text, {
        capacityOverrides: capacityOverrides(value.capacities),
        explainDepth: value.explain_depth ?? 1,
        precision: value.precision ?? 3,
        maxDiagnostics: value.max_diagnostics ?? MCP_LIMITS.defaultDiagnostics,
        sourceDigest: source.value.binding.source_digest,
      });
      if (application.schemaVersion !== definition(name).resultSchemaVersion) {
        return emit(mcpSourceError(
          operation,
          "PTMCP-106",
          "Application next result identity is unavailable",
          source.value.binding,
        ), true);
      }
      if (expired()) return cancel(operation);
      return emit(successResult(
        name,
        operation,
        application.schemaVersion,
        projectNextResult(application),
        source.value.binding,
      ), !application.ok);
    } finally {
      activeTools -= 1;
    }
  };

  const createServer = (): McpServer => {
    const server = new McpServer(
      { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
      {
        capabilities: {
          resources: { subscribe: false, listChanged: false },
          tools: { listChanged: false },
        },
      },
    );
    for (const item of MCP_RESOURCE_DEFINITIONS) {
      server.registerResource(
        item.name,
        item.uri,
        {
          title: item.name,
          description: item.description,
          mimeType: "application/json",
        },
        async (uri) => ({
          contents: [{
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(await readResource(uri.href)),
          }],
        }),
      );
    }
    for (const item of MCP_TOOL_DEFINITIONS) {
      const inputSchema = fromJsonSchema<Record<string, unknown>>(
        MCP_TOOL_INPUT_SCHEMAS[item.name],
      );
      const outputSchema = fromJsonSchema<JSONObject>(
        MCP_TOOL_OUTPUT_SCHEMAS[item.name],
      );
      server.registerTool(
        item.name,
        {
          title: item.title,
          description: item.description,
          inputSchema,
          outputSchema,
          annotations: MCP_TOOL_ANNOTATIONS,
        },
        async (args: Record<string, unknown>, context: ServerContext): Promise<CallToolResult> => {
          const result = await executeTool(
            item.name,
            args as unknown as McpToolInputByName[typeof item.name],
            context.mcpReq.signal,
          );
          return {
            content: [...result.content],
            structuredContent: result.structuredContent as unknown as JSONObject,
            isError: result.isError,
          };
        },
      );
    }
    return server;
  };

  return Object.freeze({
    resourceUris: Object.freeze(MCP_RESOURCE_DEFINITIONS.map(({ uri }) => uri)),
    toolNames: Object.freeze(MCP_TOOL_DEFINITIONS.map(({ name }) => name)),
    inputSchemas: MCP_TOOL_INPUT_SCHEMAS,
    outputSchemas: MCP_TOOL_OUTPUT_SCHEMAS,
    readResource,
    executeTool,
    createServer,
  });
}
