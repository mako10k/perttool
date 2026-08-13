import { createNodeHost, getJsonSchema } from "perttool/node";
import {
  MCP_PROTOCOL_MODEL_VERSION,
  MCP_TOOL_DEFINITIONS,
  type McpJsonSchema,
  type McpToolName,
} from "./protocol.js";

type MutableJson = null | boolean | number | string | MutableJson[] | {
  [key: string]: MutableJson;
};

const facadeFields = new Set([
  "schema_version",
  "cli_contract_version",
  "recommendation_interface_version",
  "tool_version",
  "operation",
  "source",
  "source_digest",
]);

function cloneJson(value: unknown): MutableJson {
  return JSON.parse(JSON.stringify(value)) as MutableJson;
}

function isObject(value: MutableJson): value is { [key: string]: MutableJson } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rewriteReferences(
  value: MutableJson,
  localPrefix: string,
  commonPrefix: string,
  common: boolean,
): MutableJson {
  if (Array.isArray(value)) {
    return value.map((item) =>
      rewriteReferences(item, localPrefix, commonPrefix, common)
    );
  }
  if (!isObject(value)) return value;
  const result: { [key: string]: MutableJson } = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "$ref" && typeof child === "string") {
      if (child.startsWith("Perttool.Common.v1.schema.json#/$defs/")) {
        result[key] = `#/$defs/${commonPrefix}${child.slice(child.lastIndexOf("/") + 1)}`;
      } else if (child.startsWith("Perttool.MilestoneAcceptanceResult.v1.schema.json#/$defs/")) {
        result[key] = `#/$defs/acceptance_${child.slice(child.lastIndexOf("/") + 1)}`;
      } else if (child.startsWith("#/$defs/")) {
        result[key] = `#/$defs/${common ? commonPrefix : localPrefix}${child.slice(8)}`;
      } else if (child === "https://json-schema.org/draft/2020-12/schema") {
        result[key] = `#/$defs/${commonPrefix}jsonObject`;
      } else {
        result[key] = child;
      }
    } else {
      result[key] = rewriteReferences(child, localPrefix, commonPrefix, common);
    }
  }
  return result;
}

interface SemanticSchemaLayer {
  readonly schema: MutableJson;
  readonly definitions: Readonly<Record<string, MutableJson>>;
}

function publicSemanticSchema(
  schemaId: string,
  prefix: string,
): SemanticSchemaLayer {
  const source = getJsonSchema(schemaId);
  if (source === null) throw new Error(`unavailable public schema: ${schemaId}`);
  const cloned = cloneJson(source);
  if (!isObject(cloned)) throw new Error(`invalid public schema: ${schemaId}`);
  const sourceProperties = cloned["properties"];
  const sourceRequired = cloned["required"];
  if (
    sourceProperties === undefined ||
    sourceRequired === undefined ||
    !isObject(sourceProperties) ||
    !Array.isArray(sourceRequired)
  ) {
    throw new Error(`public schema has no closed root: ${schemaId}`);
  }
  const properties = Object.fromEntries(
    Object.entries(sourceProperties).filter(([key]) =>
      !facadeFields.has(key)
    ),
  ) as { [key: string]: MutableJson };
  const semantic: MutableJson = {
    type: "object",
    required: sourceRequired.filter((key): key is string =>
      typeof key === "string" &&
      !facadeFields.has(key)
    ),
    properties,
    additionalProperties: false,
  };
  const definitions: Record<string, MutableJson> = {};
  const sourceDefinitions = cloned["$defs"];
  if (sourceDefinitions !== undefined && isObject(sourceDefinitions)) {
    for (const [key, value] of Object.entries(sourceDefinitions)) {
      definitions[`${prefix}${key}`] = rewriteReferences(
        value,
        prefix,
        "common_",
        false,
      );
    }
  }
  return {
    schema: rewriteReferences(semantic, prefix, "common_", false),
    definitions,
  };
}

function commonDefinitions(): Readonly<Record<string, MutableJson>> {
  const commonUrl = new URL(
    import.meta.resolve("perttool/schemas/Perttool.Common.v1.schema.json"),
  );
  const commonBytes = createNodeHost().bundledArtifacts.read(commonUrl);
  const cloned = cloneJson(JSON.parse(new TextDecoder().decode(commonBytes)));
  const definitions = isObject(cloned) ? cloned["$defs"] : undefined;
  if (!isObject(cloned) || definitions === undefined || !isObject(definitions)) {
    throw new Error("invalid public common schema");
  }
  return Object.fromEntries(
    Object.entries(definitions).map(([key, value]) => [
      `common_${key}`,
      rewriteReferences(value, "", "common_", true),
    ]),
  );
}

function acceptanceDefinitions(): Readonly<Record<string, MutableJson>> {
  const source = getJsonSchema("Perttool.MilestoneAcceptanceResult.v1");
  if (source === null) {
    throw new Error("unavailable public milestone acceptance schema");
  }
  const cloned = cloneJson(source);
  const definitions = isObject(cloned) ? cloned["$defs"] : undefined;
  if (!isObject(cloned) || definitions === undefined || !isObject(definitions)) {
    throw new Error("invalid public milestone acceptance schema");
  }
  return Object.fromEntries(
    Object.entries(definitions).map(([key, value]) => [
      `acceptance_${key}`,
      rewriteReferences(value, "acceptance_", "common_", false),
    ]),
  );
}

const sourceBindingSchema: MutableJson = {
  type: "object",
  required: ["kind", "document_id", "source_digest"],
  properties: {
    kind: { type: "string", enum: ["inline", "registered"] },
    document_id: { type: ["string", "null"] },
    source_digest: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" },
  },
  additionalProperties: false,
};

const nullableSourceBindingSchema: MutableJson = {
  oneOf: [sourceBindingSchema, { type: "null" }],
};

function sourceErrorSchema(operations: readonly string[]): MutableJson {
  return {
    type: "object",
    required: [
      "schema_version",
      "mcp_protocol_model_version",
      "operation",
      "source",
      "diagnostic",
    ],
    properties: {
      schema_version: { const: "Perttool.McpSourceError.v1" },
      mcp_protocol_model_version: { const: MCP_PROTOCOL_MODEL_VERSION },
      operation: { type: "string", enum: [...operations] },
      source: nullableSourceBindingSchema,
      diagnostic: {
        type: "object",
        required: ["code", "severity", "message"],
        properties: {
          code: {
            type: "string",
            enum: [
              "PTMCP-101",
              "PTMCP-102",
              "PTMCP-103",
              "PTMCP-104",
              "PTMCP-105",
              "PTMCP-106",
              "PTMCP-107",
              "PTMCP-108",
            ],
          },
          severity: { const: "error" },
          message: { type: "string", minLength: 1 },
        },
        additionalProperties: false,
      },
    },
    additionalProperties: false,
  };
}

function toolOutputSchema(name: McpToolName): McpJsonSchema {
  const definition = MCP_TOOL_DEFINITIONS.find((item) => item.name === name);
  if (definition === undefined) throw new Error(`unknown MCP tool: ${name}`);
  const publicIds = name === "perttool_help"
    ? ["Perttool.CommandHelpResult.v1", "Perttool.GuideResult.v1"]
    : [definition.resultSchemaVersion];
  const layers = publicIds.map((schemaId, index) =>
    publicSemanticSchema(schemaId, `result_${index}_`)
  );
  const operations = name === "perttool_help"
    ? ["command_help", "guide"]
    : [definition.operation];
  const resultVersions = publicIds;
  const success: MutableJson = {
    type: "object",
    required: [
      "schema_version",
      "mcp_protocol_model_version",
      "operation",
      "source",
      "result_schema_version",
      "result",
    ],
    properties: {
      schema_version: { const: definition.wireSchemaVersion },
      mcp_protocol_model_version: { const: MCP_PROTOCOL_MODEL_VERSION },
      operation: { type: "string", enum: operations },
      source: name === "perttool_check" || name === "perttool_analyze" || name === "perttool_next"
        ? sourceBindingSchema
        : { type: "null" },
      result_schema_version: { type: "string", enum: resultVersions },
      result: layers.length === 1
        ? layers[0]!.schema
        : { oneOf: layers.map(({ schema }) => schema) },
    },
    additionalProperties: false,
  };
  const definitions = {
    ...commonDefinitions(),
    ...acceptanceDefinitions(),
    ...Object.assign({}, ...layers.map(({ definitions: value }) => value)),
  };
  return Object.freeze({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    oneOf: [success, sourceErrorSchema(operations)],
    $defs: definitions,
  }) as McpJsonSchema;
}

export const MCP_TOOL_OUTPUT_SCHEMAS: Readonly<Record<McpToolName, McpJsonSchema>> =
  Object.freeze(Object.fromEntries(
    MCP_TOOL_DEFINITIONS.map(({ name }) => [name, toolOutputSchema(name)]),
  )) as Readonly<Record<McpToolName, McpJsonSchema>>;

export function externalSchemaReferences(schema: unknown): readonly string[] {
  const references: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (typeof value === "object" && value !== null) {
      for (const [key, child] of Object.entries(value)) {
        if (key === "$ref" && typeof child === "string" && !child.startsWith("#")) {
          references.push(child);
        }
        visit(child);
      }
    }
  };
  visit(schema);
  return Object.freeze(references);
}
