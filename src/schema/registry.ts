import { readFileSync } from "node:fs";
import { TOOL_VERSION } from "../version.js";

export const JSON_SCHEMA_DIALECT =
  "https://json-schema.org/draft/2020-12/schema" as const;
export const JSON_SCHEMA_RESULT_SCHEMA_VERSION =
  "Perttool.SchemaResult.v1" as const;
export type JsonSchemaView = "full" | "outline";

export interface JsonSchemaResultOptions {
  readonly view?: JsonSchemaView;
  readonly ref?: string;
}

export interface JsonSchemaCatalogEntry {
  readonly schemaId: string;
  readonly artifactPath: string;
  readonly commandResult: boolean;
  readonly publicLibraryResult: boolean;
}

export interface JsonSchemaIdentityDiagnostic {
  readonly code: "PTSCH-001";
  readonly severity: "error";
  readonly message: string;
  readonly data: {
    readonly schemaId: string;
  };
}

export interface JsonSchemaReferenceDiagnostic {
  readonly code: "PTSCH-002";
  readonly severity: "error";
  readonly message: string;
  readonly data: {
    readonly schemaId: string;
    readonly ref: string;
  };
}

export type JsonSchemaDiagnostic =
  | JsonSchemaIdentityDiagnostic
  | JsonSchemaReferenceDiagnostic;

export interface JsonSchemaResult {
  readonly schemaVersion: typeof JSON_SCHEMA_RESULT_SCHEMA_VERSION;
  readonly cliContractVersion: 6;
  readonly toolVersion: string;
  readonly operation: "schema";
  readonly ok: boolean;
  readonly query: {
    readonly schemaId: string | null;
    readonly view?: JsonSchemaView;
    readonly ref?: string;
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
const commonArtifact = Object.freeze({
  schemaId: "Perttool.Common.v1",
  artifactPath: "schemas/Perttool.Common.v1.schema.json",
});

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

function load(
  entry: Pick<JsonSchemaCatalogEntry, "schemaId" | "artifactPath">,
): Readonly<Record<string, unknown>> {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaIdentity(schema: Readonly<Record<string, unknown>>): string {
  const identity = schema["$id"];
  if (typeof identity !== "string") {
    throw new Error("bundled JSON Schema artifact has no $id");
  }
  return identity;
}

function pointerToken(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function childPointer(pointer: string, key: string): string {
  return `${pointer}/${pointerToken(key)}`;
}

function isConcreteObjectSchema(value: Record<string, unknown>): boolean {
  const type = value["type"];
  const objectType =
    type === "object" ||
    (Array.isArray(type) && type.includes("object"));
  return objectType && isRecord(value["properties"]);
}

function absoluteReference(reference: string, sourceId: string): string {
  return new URL(reference, sourceId).href;
}

function outlineValue(
  value: unknown,
  sourceId: string,
  pointer: string,
  layerRoot: boolean,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      outlineValue(item, sourceId, childPointer(pointer, String(index)), false)
    );
  }
  if (!isRecord(value)) return value;
  if (!layerRoot && isConcreteObjectSchema(value)) {
    return Object.freeze({
      $ref: `${sourceId}#${pointer}`,
    });
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "$defs")
      .map(([key, child]) => [
        key,
        key === "$ref" && typeof child === "string"
          ? absoluteReference(child, sourceId)
          : outlineValue(
              child,
              sourceId,
              childPointer(pointer, key),
              false,
            ),
      ]),
  );
}

function outlineProjectionId(sourceId: string, pointer: string): string {
  const identity = new URL(sourceId);
  identity.searchParams.set("view", "outline");
  if (pointer !== "") identity.searchParams.set("ref", pointer);
  return identity.href;
}

function outlineProjection(
  source: Readonly<Record<string, unknown>>,
  selected: Readonly<Record<string, unknown>>,
  pointer: string,
): Readonly<Record<string, unknown>> {
  const sourceId = schemaIdentity(source);
  const projection = outlineValue(
    selected,
    sourceId,
    pointer,
    true,
  );
  if (!isRecord(projection)) {
    throw new Error(`JSON Schema outline target is not an object: ${pointer}`);
  }
  const title =
    typeof selected["title"] === "string"
      ? selected["title"]
      : `${String(source["title"] ?? sourceId)} ${pointer || "#"}`;
  const body = Object.fromEntries(
    Object.entries(projection).filter(
      ([key]) => key !== "$schema" && key !== "$id" && key !== "title",
    ),
  );
  return freezeJson({
    $schema: JSON_SCHEMA_DIALECT,
    $id: outlineProjectionId(sourceId, pointer),
    title,
    ...body,
  }) as Readonly<Record<string, unknown>>;
}

function decodeJsonPointer(fragment: string): readonly string[] | null {
  let pointer: string;
  try {
    pointer = decodeURIComponent(fragment);
  } catch {
    return null;
  }
  if (pointer === "") return Object.freeze([]);
  if (!pointer.startsWith("/")) return null;
  const tokens: string[] = [];
  for (const encoded of pointer.slice(1).split("/")) {
    if (/~(?:[^01]|$)/u.test(encoded)) return null;
    tokens.push(encoded.replaceAll("~1", "/").replaceAll("~0", "~"));
  }
  return Object.freeze(tokens);
}

function resolvePointer(
  schema: Readonly<Record<string, unknown>>,
  tokens: readonly string[],
): Readonly<Record<string, unknown>> | null {
  let current: unknown = schema;
  for (const token of tokens) {
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9][0-9]*)$/u.test(token)) return null;
      current = current[Number(token)];
    } else if (isRecord(current) && Object.hasOwn(current, token)) {
      current = current[token];
    } else {
      return null;
    }
  }
  return isRecord(current) ? current : null;
}

interface ResolvedJsonSchemaReference {
  readonly source: Readonly<Record<string, unknown>>;
  readonly selected: Readonly<Record<string, unknown>>;
  readonly pointer: string;
}

function resolveOutlineReference(
  selectedRoot: Readonly<Record<string, unknown>>,
  reference: string,
): ResolvedJsonSchemaReference | null {
  const selectedId = schemaIdentity(selectedRoot);
  let target: URL;
  try {
    target = new URL(reference, selectedId);
  } catch {
    return null;
  }
  const fragment = target.hash.slice(1);
  target.hash = "";
  const common = load(commonArtifact);
  const commonId = schemaIdentity(common);
  const targetSource =
    target.href === selectedId
      ? selectedRoot
      : target.href === commonId
        ? common
        : null;
  if (targetSource === null || fragment === "") return null;
  const tokens = decodeJsonPointer(fragment);
  if (tokens === null) return null;
  const selected = resolvePointer(targetSource, tokens);
  if (selected === null) return null;
  return Object.freeze({
    source: targetSource,
    selected,
    pointer: decodeURIComponent(fragment),
  });
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
  options: JsonSchemaResultOptions = {},
): JsonSchemaResult {
  const explicitView = options.view !== undefined;
  const view = options.view ?? "full";
  if (view !== "full" && view !== "outline") {
    throw new TypeError(`unknown JSON Schema view: ${String(view)}`);
  }
  if (schemaId === null && (explicitView || options.ref !== undefined)) {
    throw new TypeError("JSON Schema view selection requires a schema identity");
  }
  if (options.ref !== undefined && view !== "outline") {
    throw new TypeError("JSON Schema reference selection requires outline view");
  }
  const selected = schemaId === null ? null : byId.get(schemaId);
  let diagnostics: readonly JsonSchemaDiagnostic[] =
    schemaId !== null && selected === undefined
      ? Object.freeze([Object.freeze({
          code: "PTSCH-001",
          severity: "error",
          message: `unknown JSON Schema identity: ${schemaId}`,
          data: Object.freeze({ schemaId }),
        })])
      : Object.freeze([]);
  let schema: Readonly<Record<string, unknown>> | null = null;
  if (selected !== undefined && selected !== null) {
    const complete = load(selected);
    if (view === "full") {
      schema = complete;
    } else if (options.ref === undefined) {
      schema = outlineProjection(complete, complete, "");
    } else {
      const resolved = resolveOutlineReference(complete, options.ref);
      if (resolved === null) {
        diagnostics = Object.freeze([Object.freeze({
          code: "PTSCH-002",
          severity: "error",
          message:
            `unavailable bundled JSON Schema reference: ${options.ref}`,
          data: Object.freeze({ schemaId: selected.schemaId, ref: options.ref }),
        })]);
      } else {
        schema = outlineProjection(
          resolved.source,
          resolved.selected,
          resolved.pointer,
        );
      }
    }
  }
  return Object.freeze({
    schemaVersion: JSON_SCHEMA_RESULT_SCHEMA_VERSION,
    cliContractVersion: 6,
    toolVersion: TOOL_VERSION,
    operation: "schema",
    ok: diagnostics.length === 0,
    query: Object.freeze({
      schemaId,
      ...(explicitView ? { view } : {}),
      ...(options.ref === undefined ? {} : { ref: options.ref }),
    }),
    schemas: catalog,
    schema,
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
      ...(result.query.view === undefined ? {} : { view: result.query.view }),
      ...(result.query.ref === undefined ? {} : { ref: result.query.ref }),
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
        ...("ref" in diagnostic.data ? { ref: diagnostic.data.ref } : {}),
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
      ...(result.query.view === undefined
        ? []
        : [`View: ${result.query.view}`]),
      ...(result.query.ref === undefined
        ? []
        : [`Reference: ${result.query.ref}`]),
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
