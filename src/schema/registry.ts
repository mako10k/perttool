import { readFileSync } from "node:fs";
import { TOOL_VERSION } from "../version.js";

export const JSON_SCHEMA_DIALECT =
  "https://json-schema.org/draft/2020-12/schema" as const;
export const JSON_SCHEMA_RESULT_SCHEMA_VERSION =
  "Perttool.SchemaResult.v1" as const;

export interface JsonSchemaCatalogEntry {
  readonly schemaId: string;
  readonly artifactPath: string;
  readonly commandResult: boolean;
  readonly publicLibraryResult: boolean;
}

export interface JsonSchemaDiagnostic {
  readonly code: "PTSCH-001";
  readonly severity: "error";
  readonly message: string;
  readonly data: {
    readonly schemaId: string;
  };
}

export interface JsonSchemaResult {
  readonly schemaVersion: typeof JSON_SCHEMA_RESULT_SCHEMA_VERSION;
  readonly cliContractVersion: 6;
  readonly toolVersion: string;
  readonly operation: "schema";
  readonly ok: boolean;
  readonly query: {
    readonly schemaId: string | null;
  };
  readonly schemas: readonly JsonSchemaCatalogEntry[];
  readonly schema: Readonly<Record<string, unknown>> | null;
  readonly diagnostics: readonly JsonSchemaDiagnostic[];
}

const commandResultSchemaIds = Object.freeze([
  "Perttool.AgentGuidanceResult.v1",
  "Perttool.AnalysisResult.v4",
  "Perttool.CheckResult.v3",
  "Perttool.CliError.v1",
  "Perttool.CommandHelpResult.v1",
  "Perttool.ExportResult.v1",
  "Perttool.FormatResult.v1",
  "Perttool.GuideResult.v1",
  "Perttool.ImportResult.v1",
  "Perttool.InitResult.v1",
  "Perttool.MutationResult.v3",
  "Perttool.NextResult.v5",
  "Perttool.ProjectHistoryResult.v1",
  "Perttool.ProjectResult.v3",
  JSON_SCHEMA_RESULT_SCHEMA_VERSION,
  "Perttool.UnitMigrationResult.v3",
  "Perttool.VelocityObservationResult.v1",
]);

const publicLibraryResultSchemaIds = Object.freeze([
  "Perttool.OverrideDecision.v1",
]);

const catalog: readonly JsonSchemaCatalogEntry[] = Object.freeze(
  [
    ...commandResultSchemaIds.map((schemaId) => ({
      schemaId,
      artifactPath: `schemas/${schemaId}.schema.json`,
      commandResult: true,
      publicLibraryResult: false,
    })),
    ...publicLibraryResultSchemaIds.map((schemaId) => ({
      schemaId,
      artifactPath: `schemas/${schemaId}.schema.json`,
      commandResult: false,
      publicLibraryResult: true,
    })),
  ]
    .sort((left, right) =>
      left.schemaId < right.schemaId
        ? -1
        : left.schemaId > right.schemaId
          ? 1
          : 0
    )
    .map((entry) => Object.freeze(entry)),
);

const byId = new Map(catalog.map((entry) => [entry.schemaId, entry]));
const loaded = new Map<string, Readonly<Record<string, unknown>>>();

function freezeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeJson));
  }
  if (typeof value === "object" && value !== null) {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, child]) => [key, freezeJson(child)]),
      ),
    );
  }
  return value;
}

function load(entry: JsonSchemaCatalogEntry): Readonly<Record<string, unknown>> {
  const cached = loaded.get(entry.schemaId);
  if (cached !== undefined) return cached;
  const url = new URL(`../../${entry.artifactPath}`, import.meta.url);
  const parsed = JSON.parse(readFileSync(url, "utf8")) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    (parsed as Record<string, unknown>)["$schema"] !== JSON_SCHEMA_DIALECT
  ) {
    throw new Error(`invalid bundled JSON Schema artifact for ${entry.schemaId}`);
  }
  const schema = freezeJson(parsed) as Readonly<Record<string, unknown>>;
  loaded.set(entry.schemaId, schema);
  return schema;
}

export function getJsonSchemaCatalog(): readonly JsonSchemaCatalogEntry[] {
  return catalog;
}

export function getJsonSchema(
  schemaId: string,
): Readonly<Record<string, unknown>> | null {
  const entry = byId.get(schemaId);
  return entry === undefined ? null : load(entry);
}

export function getJsonSchemaResult(
  schemaId: string | null,
): JsonSchemaResult {
  const selected = schemaId === null ? null : byId.get(schemaId);
  const diagnostics: readonly JsonSchemaDiagnostic[] =
    schemaId !== null && selected === undefined
      ? Object.freeze([Object.freeze({
          code: "PTSCH-001",
          severity: "error",
          message: `unknown JSON Schema identity: ${schemaId}`,
          data: Object.freeze({ schemaId }),
        })])
      : Object.freeze([]);
  return Object.freeze({
    schemaVersion: JSON_SCHEMA_RESULT_SCHEMA_VERSION,
    cliContractVersion: 6,
    toolVersion: TOOL_VERSION,
    operation: "schema",
    ok: diagnostics.length === 0,
    query: Object.freeze({ schemaId }),
    schemas: catalog,
    schema: selected === undefined || selected === null ? null : load(selected),
    diagnostics,
  });
}

export function jsonSchemaResultToJson(
  result: JsonSchemaResult,
): Readonly<Record<string, unknown>> {
  return {
    schema_version: result.schemaVersion,
    cli_contract_version: result.cliContractVersion,
    tool_version: result.toolVersion,
    operation: result.operation,
    ok: result.ok,
    query: {
      schema_id: result.query.schemaId,
    },
    schemas: result.schemas.map((entry) => ({
      schema_id: entry.schemaId,
      artifact_path: entry.artifactPath,
      command_result: entry.commandResult,
      public_library_result: entry.publicLibraryResult,
    })),
    schema: result.schema,
    diagnostics: result.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      data: {
        schema_id: diagnostic.data.schemaId,
      },
    })),
  };
}

export function serializeJsonSchemaResult(result: JsonSchemaResult): string {
  return `${JSON.stringify(jsonSchemaResultToJson(result), null, 2)}\n`;
}

export function renderJsonSchemaResult(result: JsonSchemaResult): string {
  if (!result.ok) {
    return `${result.diagnostics
      .map(({ code, severity, message }) => `${code} ${severity}: ${message}`)
      .join("\n")}\n`;
  }
  if (result.query.schemaId !== null) {
    const entry = result.schemas.find(
      ({ schemaId }) => schemaId === result.query.schemaId,
    )!;
    return [
      `Schema: ${entry.schemaId}`,
      `Artifact: ${entry.artifactPath}`,
      `Dialect: ${JSON_SCHEMA_DIALECT}`,
      `Command result: ${entry.commandResult}`,
      `Public library result: ${entry.publicLibraryResult}`,
      "",
    ].join("\n");
  }
  return `${[
    `perttool JSON Schema catalog (${JSON_SCHEMA_DIALECT})`,
    "",
    ...result.schemas.map(
      (entry) =>
        `  ${entry.schemaId}  ${entry.artifactPath}`,
    ),
  ].join("\n")}\n`;
}
