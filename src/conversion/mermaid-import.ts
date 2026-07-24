import { createHash } from "node:crypto";
import { checkDocument } from "../application/check.js";
import type { Diagnostic, SourceSpan } from "../model/diagnostics.js";
import { compareStableStrings, normalizeMaxDiagnostics } from "../model/diagnostics.js";
import type { DocumentNode } from "../model/syntax.js";
import { serializeTags, serializeTextField } from "../mutation/source.js";
import {
  exportMermaid,
  type ConversionLoss,
  type ConversionLossReport,
  type MermaidAnalysisMode,
  type MermaidProfile,
} from "./mermaid.js";

export interface MermaidImportOptions {
  readonly maxDiagnostics?: number;
}

export interface GeneratedId {
  readonly sourceElement: string;
  readonly generatedId: string;
}

export interface MermaidImportResult {
  readonly ok: boolean;
  readonly document: DocumentNode;
  readonly documentId: string | null;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
  readonly profile: MermaidProfile;
  readonly analysis: MermaidAnalysisMode;
  readonly capacityOverrides: ReadonlyMap<string, number>;
  readonly artifact: string | null;
  readonly artifactDigest: string | null;
  readonly lossReport: ConversionLossReport;
  readonly generatedIds: readonly GeneratedId[];
}

type RecordKind = "project" | "resource" | "milestone" | "task" | "gate";

interface SourceLine {
  readonly text: string;
  readonly start: number;
  readonly line: number;
}

interface ProfileHeader {
  readonly recordCount: number;
  readonly metadataDigest: string;
  readonly projectionDigest: string;
  readonly analysis: MermaidAnalysisMode;
  readonly capacityOverrides: ReadonlyMap<string, number>;
}

interface ParsedRecord {
  readonly kind: RecordKind;
  readonly value: Readonly<Record<string, unknown>>;
  readonly json: string;
  readonly line: SourceLine;
}

class ImportFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly span?: SourceSpan,
  ) {
    super(message);
    this.name = "ImportFailure";
  }
}

const identifierPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const durationPattern = /^(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?[dhp]$/;
const velocityPattern = /^(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?p\/(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?[dh]$/;
const kinds: readonly RecordKind[] = ["project", "resource", "milestone", "task", "gate"];

function sha256(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function sourceLines(text: string): readonly SourceLine[] {
  const lines: SourceLine[] = [];
  let start = 0;
  let line = 0;
  while (start < text.length) {
    const newline = text.indexOf("\n", start);
    const end = newline === -1 ? text.length : newline;
    lines.push({ text: text.slice(start, end), start, line });
    if (newline === -1) break;
    start = newline + 1;
    line += 1;
  }
  return lines;
}

function lineSpan(line: SourceLine): SourceSpan {
  return {
    start: { offset: line.start, line: line.line, column: 0 },
    end: { offset: line.start + line.text.length, line: line.line, column: line.text.length },
  };
}

function diagnostic(failure: ImportFailure): Diagnostic {
  return {
    code: failure.code,
    severity: "error",
    message: failure.message,
    ...(failure.span === undefined ? {} : { span: failure.span }),
    helpTopic: "mermaid",
  };
}

function emptyResult(
  profile: MermaidProfile,
  failure: ImportFailure,
  maxDiagnostics: number,
): MermaidImportResult {
  const checked = checkDocument("", { maxDiagnostics });
  return {
    ok: false,
    document: checked.document,
    documentId: null,
    diagnostics: [diagnostic(failure)],
    diagnosticsTruncated: false,
    profile,
    analysis: "none",
    capacityOverrides: new Map(),
    artifact: null,
    artifactDigest: null,
    lossReport: { lossless: false, records: [] },
    generatedIds: [],
  };
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCanonicalObject(
  json: string,
  code: string,
  span: SourceSpan,
): Readonly<Record<string, unknown>> {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new ImportFailure(code, "Mermaid profile JSON is invalid", span);
  }
  if (!isObject(value) || JSON.stringify(value) !== json) {
    throw new ImportFailure(code, "Mermaid profile JSON is not a canonical object", span);
  }
  return value;
}

function assertKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  span: SourceSpan,
): void {
  if (
    Object.keys(value).length !== expected.length ||
    Object.keys(value).some((key, index) => key !== expected[index])
  ) {
    throw new ImportFailure("PTCNV-102", "Mermaid profile record keys or key order are invalid", span);
  }
}

function requiredString(
  value: Readonly<Record<string, unknown>>,
  key: string,
  span: SourceSpan,
): string {
  const result = value[key];
  if (typeof result !== "string") {
    throw new ImportFailure("PTCNV-102", `${key} must be a string`, span);
  }
  return result;
}

function nullableString(
  value: Readonly<Record<string, unknown>>,
  key: string,
  span: SourceSpan,
): string | null {
  const result = value[key];
  if (result !== null && typeof result !== "string") {
    throw new ImportFailure("PTCNV-102", `${key} must be a string or null`, span);
  }
  return result;
}

function safeInteger(
  value: Readonly<Record<string, unknown>>,
  key: string,
  span: SourceSpan,
): number {
  const result = value[key];
  if (!Number.isSafeInteger(result)) {
    throw new ImportFailure("PTCNV-102", `${key} must be a safe integer`, span);
  }
  return result as number;
}

function stringArray(value: unknown, key: string, span: SourceSpan): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ImportFailure("PTCNV-102", `${key} must be a string array`, span);
  }
  return value as readonly string[];
}

function parseHeader(value: Readonly<Record<string, unknown>>, span: SourceSpan): ProfileHeader {
  assertKeys(value, [
    "schema_version",
    "profile",
    "source_fidelity",
    "record_count",
    "metadata_digest",
    "projection_digest",
    "projection",
  ], span);
  if (value["schema_version"] !== "Perttool.MermaidProfile.v1") {
    throw new ImportFailure("PTCNV-101", "Mermaid profile schema/version is unsupported", span);
  }
  if (value["profile"] !== "perttool" || value["source_fidelity"] !== "semantic-v1") {
    throw new ImportFailure("PTCNV-102", "Mermaid profile header is invalid", span);
  }
  const recordCount = safeInteger(value, "record_count", span);
  if (recordCount < 1) {
    throw new ImportFailure("PTCNV-102", "record_count must be at least 1", span);
  }
  const metadataDigest = requiredString(value, "metadata_digest", span);
  const projectionDigest = requiredString(value, "projection_digest", span);
  if (!digestPattern.test(metadataDigest) || !digestPattern.test(projectionDigest)) {
    throw new ImportFailure("PTCNV-102", "profile digest format is invalid", span);
  }
  const projection = value["projection"];
  if (!isObject(projection)) {
    throw new ImportFailure("PTCNV-102", "projection snapshot is not an object", span);
  }
  assertKeys(projection, ["schema_version", "direction", "analysis", "capacity_overrides"], span);
  if (
    projection["schema_version"] !== "Perttool.MermaidProjection.v1" ||
    projection["direction"] !== "LR"
  ) {
    throw new ImportFailure("PTCNV-101", "Mermaid projection schema/version is unsupported", span);
  }
  const analysis = projection["analysis"];
  if (!new Set(["none", "precedence", "resource", "both"]).has(analysis as string)) {
    throw new ImportFailure("PTCNV-102", "projection analysis is invalid", span);
  }
  const rawOverrides = projection["capacity_overrides"];
  if (!Array.isArray(rawOverrides)) {
    throw new ImportFailure("PTCNV-102", "capacity_overrides is not an array", span);
  }
  const overrides = new Map<string, number>();
  let previous = "";
  for (const raw of rawOverrides) {
    if (!isObject(raw)) {
      throw new ImportFailure("PTCNV-102", "capacity override is not an object", span);
    }
    assertKeys(raw, ["resource_id", "capacity"], span);
    const resourceId = requiredString(raw, "resource_id", span);
    const capacity = safeInteger(raw, "capacity", span);
    if (!identifierPattern.test(resourceId) || capacity < 1 || compareStableStrings(previous, resourceId) >= 0) {
      throw new ImportFailure("PTCNV-102", "capacity override ID, capacity, or order is invalid", span);
    }
    previous = resourceId;
    overrides.set(resourceId, capacity);
  }
  if (overrides.size > 0 && analysis !== "resource" && analysis !== "both") {
    throw new ImportFailure("PTCNV-102", "capacity override requires resource analysis", span);
  }
  return {
    recordCount,
    metadataDigest,
    projectionDigest,
    analysis: analysis as MermaidAnalysisMode,
    capacityOverrides: overrides,
  };
}

function validateRecordShape(record: ParsedRecord): void {
  const { kind, value } = record;
  const span = lineSpan(record.line);
  const keys: Readonly<Record<RecordKind, readonly string[]>> = {
    project: ["id", "version", "title", "description", "as_of", "duration_unit", "velocity", "finish", "critical_epsilon", "target_duration"],
    resource: ["id", "title", "description", "capacity", "tags"],
    milestone: ["id", "title", "description", "state", "tags"],
    task: ["id", "from", "to", "title", "description", "estimate", "status", "priority", "requires", "owner", "tags", "blocked_reason", "source"],
    gate: ["id", "from", "to", "reason"],
  };
  assertKeys(value, keys[kind], span);
  for (const key of kind === "project"
    ? ["id", "title", "finish", "critical_epsilon"]
    : kind === "resource" || kind === "milestone"
      ? ["id", "title"]
      : kind === "task"
        ? ["id", "from", "to", "title", "status"]
        : ["id", "from", "to", "reason"]) {
    requiredString(value, key, span);
  }
  if (kind === "project") {
    if (safeInteger(value, "version", span) !== 1) {
      throw new ImportFailure("PTCNV-101", "project version is unsupported", span);
    }
    nullableString(value, "description", span);
    nullableString(value, "as_of", span);
    const unit = requiredString(value, "duration_unit", span);
    if (!new Set(["day", "hour", "point"]).has(unit)) {
      throw new ImportFailure("PTCNV-102", "duration_unit is invalid", span);
    }
    const velocity = nullableString(value, "velocity", span);
    if (velocity !== null && !velocityPattern.test(velocity)) {
      throw new ImportFailure("PTCNV-102", "velocity token is not canonical", span);
    }
    for (const key of ["critical_epsilon", "target_duration"] as const) {
      const token = key === "target_duration"
        ? nullableString(value, key, span)
        : requiredString(value, key, span);
      if (token !== null && !durationPattern.test(token)) {
        throw new ImportFailure("PTCNV-102", `${key} token is not canonical`, span);
      }
    }
  } else if (kind === "resource") {
    nullableString(value, "description", span);
    if (safeInteger(value, "capacity", span) < 1) {
      throw new ImportFailure("PTCNV-102", "resource capacity is invalid", span);
    }
    stringArray(value["tags"], "tags", span);
  } else if (kind === "milestone") {
    nullableString(value, "description", span);
    if (!new Set(["planned", "reached"]).has(value["state"] as string)) {
      throw new ImportFailure("PTCNV-102", "milestone state is invalid", span);
    }
    stringArray(value["tags"], "tags", span);
  } else if (kind === "task") {
    nullableString(value, "description", span);
    nullableString(value, "owner", span);
    nullableString(value, "blocked_reason", span);
    nullableString(value, "source", span);
    if (!new Set(["planned", "active", "blocked", "done"]).has(value["status"] as string)) {
      throw new ImportFailure("PTCNV-102", "task status is invalid", span);
    }
    safeInteger(value, "priority", span);
    stringArray(value["tags"], "tags", span);
    const estimate = value["estimate"];
    if (!isObject(estimate)) {
      throw new ImportFailure("PTCNV-102", "task estimate is not an object", span);
    }
    if (estimate["kind"] === "deterministic") {
      assertKeys(estimate, ["kind", "duration"], span);
      if (!durationPattern.test(requiredString(estimate, "duration", span))) {
        throw new ImportFailure("PTCNV-102", "duration token is not canonical", span);
      }
    } else if (estimate["kind"] === "pert") {
      assertKeys(estimate, ["kind", "optimistic", "most_likely", "pessimistic"], span);
      for (const key of ["optimistic", "most_likely", "pessimistic"]) {
        if (!durationPattern.test(requiredString(estimate, key, span))) {
          throw new ImportFailure("PTCNV-102", "PERT token is not canonical", span);
        }
      }
    } else {
      throw new ImportFailure("PTCNV-102", "task estimate kind is invalid", span);
    }
    const requirements = value["requires"];
    if (!Array.isArray(requirements)) {
      throw new ImportFailure("PTCNV-102", "requires is not an array", span);
    }
    let previous = "";
    for (const raw of requirements) {
      if (!isObject(raw)) {
        throw new ImportFailure("PTCNV-102", "requirement is not an object", span);
      }
      assertKeys(raw, ["resource_id", "units"], span);
      const resourceId = requiredString(raw, "resource_id", span);
      const units = safeInteger(raw, "units", span);
      if (units < 1 || compareStableStrings(previous, resourceId) >= 0) {
        throw new ImportFailure("PTCNV-102", "requirement value or order is invalid", span);
      }
      previous = resourceId;
    }
  }
}

function textField(name: string, value: unknown): readonly string[] {
  return typeof value === "string" ? [serializeTextField(name, value, "\n")] : [];
}

function serializeProfileRecords(records: readonly ParsedRecord[]): string {
  const declarations: string[] = [];
  for (const { kind, value } of records) {
    if (kind === "project") {
      declarations.push([
        `project ${value["id"]}:`,
        `  version ${value["version"]}`,
        `  title ${JSON.stringify(value["title"])}`,
        ...textField("description", value["description"]),
        ...(value["as_of"] === null ? [] : [`  as_of ${value["as_of"]}`]),
        `  duration_unit ${value["duration_unit"]}`,
        ...(value["velocity"] === null ? [] : [`  velocity ${value["velocity"]}`]),
        `  finish ${value["finish"]}`,
        `  critical_epsilon ${value["critical_epsilon"]}`,
        ...(value["target_duration"] === null ? [] : [`  target_duration ${value["target_duration"]}`]),
      ].join("\n"));
    } else if (kind === "resource") {
      const tags = value["tags"] as readonly string[];
      declarations.push([
        `resource ${value["id"]}:`,
        `  title ${JSON.stringify(value["title"])}`,
        ...textField("description", value["description"]),
        `  capacity ${value["capacity"]}`,
        ...(tags.length === 0 ? [] : [`  tags ${serializeTags(tags)}`]),
      ].join("\n"));
    } else if (kind === "milestone") {
      const tags = value["tags"] as readonly string[];
      declarations.push([
        `milestone ${value["id"]}:`,
        `  title ${JSON.stringify(value["title"])}`,
        ...textField("description", value["description"]),
        `  state ${value["state"]}`,
        ...(tags.length === 0 ? [] : [`  tags ${serializeTags(tags)}`]),
      ].join("\n"));
    } else if (kind === "task") {
      const estimate = value["estimate"] as Readonly<Record<string, unknown>>;
      const requirements = value["requires"] as readonly Readonly<Record<string, unknown>>[];
      const tags = value["tags"] as readonly string[];
      declarations.push([
        `task ${value["id"]} ${value["from"]} -> ${value["to"]}:`,
        `  title ${JSON.stringify(value["title"])}`,
        ...textField("description", value["description"]),
        ...(estimate["kind"] === "deterministic"
          ? [`  duration ${estimate["duration"]}`]
          : [
              "  estimate:",
              `    optimistic ${estimate["optimistic"]}`,
              `    most_likely ${estimate["most_likely"]}`,
              `    pessimistic ${estimate["pessimistic"]}`,
            ]),
        `  status ${value["status"]}`,
        `  priority ${value["priority"]}`,
        ...(requirements.length === 0
          ? []
          : [
              "  requires:",
              ...requirements.map((requirement) => `    ${requirement["resource_id"]} ${requirement["units"]}`),
            ]),
        ...(value["owner"] === null ? [] : [`  owner ${JSON.stringify(value["owner"])}`]),
        ...(tags.length === 0 ? [] : [`  tags ${serializeTags(tags)}`]),
        ...textField("blocked_reason", value["blocked_reason"]),
        ...(value["source"] === null ? [] : [`  source ${JSON.stringify(value["source"])}`]),
      ].join("\n"));
    } else {
      declarations.push([
        `gate ${value["id"]} ${value["from"]} -> ${value["to"]}:`,
        ...textField("reason", value["reason"]),
      ].join("\n"));
    }
  }
  return `${declarations.join("\n\n")}\n`;
}

function validateRecordOrder(records: readonly ParsedRecord[], expectedCount: number): void {
  if (records.length !== expectedCount || records.length === 0 || records[0]!.kind !== "project") {
    throw new ImportFailure("PTCNV-103", "semantic record count or project record is invalid");
  }
  let previousRank = -1;
  let previousId = "";
  let projects = 0;
  for (const record of records) {
    const rank = kinds.indexOf(record.kind);
    const id = requiredString(record.value, "id", lineSpan(record.line));
    if (rank < previousRank || (rank === previousRank && compareStableStrings(previousId, id) >= 0)) {
      throw new ImportFailure("PTCNV-103", "semantic record kind or ID order is invalid", lineSpan(record.line));
    }
    if (record.kind === "project") projects += 1;
    if (rank !== previousRank) previousId = "";
    previousRank = rank;
    previousId = id;
  }
  if (projects !== 1) {
    throw new ImportFailure("PTCNV-103", "exactly one project record is required");
  }
}

function profileDetected(lines: readonly SourceLine[]): boolean {
  const nonempty = lines.filter(({ text }) => text !== "");
  const first = nonempty[0]?.text.replace(/^\uFEFF/, "").replace(/\r$/, "");
  const second = nonempty[1]?.text.replace(/\r$/, "").trimStart();
  return first === "flowchart LR" && second?.startsWith("%% perttool:profile ") === true;
}

function importProfile(
  text: string,
  lines: readonly SourceLine[],
  maxDiagnostics: number,
): MermaidImportResult {
  if (text.startsWith("\uFEFF") || text.includes("\r") || !text.endsWith("\n")) {
    throw new ImportFailure("PTCNV-102", "profile artifact requires no BOM, LF line endings, and a trailing newline");
  }
  if (lines[0]?.text !== "flowchart LR" || lines[1]?.text.startsWith("  %% perttool:profile ") !== true) {
    throw new ImportFailure("PTCNV-102", "profile artifact structure is invalid");
  }
  const lastNonempty = lines.findLastIndex(({ text }) => text !== "");
  if (lastNonempty === -1 || lines[lastNonempty]!.text !== "  %% perttool:projection-end") {
    throw new ImportFailure("PTCNV-102", "projection-end marker is missing");
  }
  if (lines.slice(lastNonempty + 1).some(({ text: line }) => line !== "")) {
    throw new ImportFailure("PTCNV-102", "statement exists after projection-end");
  }
  const headerLine = lines[1]!;
  const headerJson = headerLine.text.slice("  %% perttool:profile ".length);
  const header = parseHeader(
    parseCanonicalObject(headerJson, "PTCNV-102", lineSpan(headerLine)),
    lineSpan(headerLine),
  );
  const beginIndexes = lines.flatMap((line, index) =>
    line.text === "  %% perttool:projection-begin" ? [index] : []);
  const endIndexes = lines.flatMap((line, index) =>
    line.text === "  %% perttool:projection-end" ? [index] : []);
  if (beginIndexes.length !== 1 || endIndexes.length !== 1 || beginIndexes[0]! <= 1 || endIndexes[0]! <= beginIndexes[0]! + 1) {
    throw new ImportFailure("PTCNV-102", "projection marker structure is invalid");
  }
  const begin = beginIndexes[0]!;
  const end = endIndexes[0]!;
  const records: ParsedRecord[] = [];
  const recordPattern = /^  %% perttool:(project|resource|milestone|task|gate) (.*)$/;
  for (const line of lines.slice(2, begin)) {
    const match = recordPattern.exec(line.text);
    if (match === null) {
      throw new ImportFailure("PTCNV-102", "semantic record line is invalid", lineSpan(line));
    }
    const json = match[2]!;
    records.push({
      kind: match[1] as RecordKind,
      value: parseCanonicalObject(json, "PTCNV-103", lineSpan(line)),
      json,
      line,
    });
  }
  validateRecordOrder(records, header.recordCount);
  for (const record of records) validateRecordShape(record);
  const metadataBody = records.map(({ kind, json }) => `${kind} ${json}\n`).join("");
  if (sha256(metadataBody) !== header.metadataDigest) {
    throw new ImportFailure("PTCNV-104", "metadata digest does not match");
  }
  const projectionBody = lines.slice(begin + 1, end).map(({ text: line }) => `${line}\n`).join("");
  if (sha256(projectionBody) !== header.projectionDigest) {
    throw new ImportFailure("PTCNV-105", "projection digest does not match");
  }
  const artifact = serializeProfileRecords(records);
  const checked = checkDocument(artifact, { maxDiagnostics });
  if (!checked.ok) {
    throw new ImportFailure("PTCNV-106", "DSL restored from metadata failed semantic validation");
  }
  const reproduced = exportMermaid(artifact, {
    analysis: header.analysis,
    capacityOverrides: header.capacityOverrides,
    maxDiagnostics,
  });
  if (!reproduced.ok || reproduced.artifact !== text) {
    throw new ImportFailure("PTCNV-105", "projection does not match metadata nodes/edges or analysis snapshot");
  }
  return {
    ok: true,
    document: checked.document,
    documentId: checked.documentId,
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
    profile: "perttool",
    analysis: header.analysis,
    capacityOverrides: header.capacityOverrides,
    artifact,
    artifactDigest: sha256(artifact),
    lossReport: { lossless: true, records: [] },
    generatedIds: [],
  };
}

interface PlainNode {
  readonly rawId: string;
  readonly title: string;
  readonly line: SourceLine;
}

interface PlainEdge {
  readonly from: string;
  readonly to: string;
  readonly title: string;
  readonly line: SourceLine;
  readonly index: number;
}

function decodeLabel(value: string): string {
  return value.replace(/#([0-9]+);/g, (match, digits: string) => {
    const codePoint = Number(digits);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff &&
      !(codePoint >= 0xd800 && codePoint <= 0xdfff)
      ? String.fromCodePoint(codePoint)
      : match;
  });
}

function labelTitle(label: string, fallback: string): string {
  const decoded = decodeLabel(label);
  const colon = decoded.indexOf(": ");
  const body = colon === -1 ? decoded : decoded.slice(colon + 2);
  const annotation = body.indexOf(" / ");
  const title = (annotation === -1 ? body : body.slice(0, annotation)).trim();
  return title === "" ? fallback : title;
}

function loss(
  code: string,
  message: string,
  elementId: string | null,
  span: SourceSpan | null,
): ConversionLoss {
  return { code, severity: "warning", message, elementId, span, lossy: true };
}

function importPlain(
  text: string,
  lines: readonly SourceLine[],
  maxDiagnostics: number,
): MermaidImportResult {
  const first = lines.find(({ text: line }) => line.trim() !== "");
  if (first?.text.trim() !== "flowchart LR") {
    throw new ImportFailure("PTCNV-102", "plain Mermaid v1 requires flowchart LR", first === undefined ? undefined : lineSpan(first));
  }
  const nodes = new Map<string, PlainNode>();
  const edges: PlainEdge[] = [];
  const unsupported: SourceLine[] = [];
  const nodePattern = /^\s*([A-Za-z][A-Za-z0-9_-]*)\(\("(.*)"\)\)\s*;?$/;
  const edgePattern = /^\s*([A-Za-z][A-Za-z0-9_-]*)\s+(?:-->|-\.->)\|"(.*)"\|\s+([A-Za-z][A-Za-z0-9_-]*)\s*;?$/;
  const stylePattern = /^\s*(?:classDef|class|linkStyle)\b/;
  const unsafePattern = /^\s*(?:---|%%\{|click\b|link\b|callback\b|<)|<\/?[A-Za-z!][^>]*>/i;
  let edgeIndex = 0;
  for (const line of lines) {
    const trimmed = line.text.trim();
    if (trimmed === "" || line === first || stylePattern.test(line.text)) continue;
    if (unsafePattern.test(line.text)) {
      throw new ImportFailure("PTCNV-102", "executable directives or raw HTML cannot be imported", lineSpan(line));
    }
    const nodeMatch = nodePattern.exec(line.text);
    if (nodeMatch !== null) {
      const rawId = nodeMatch[1]!;
      if (!nodes.has(rawId)) {
        nodes.set(rawId, { rawId, title: labelTitle(nodeMatch[2]!, rawId), line });
      }
      continue;
    }
    const edgeMatch = edgePattern.exec(line.text);
    if (edgeMatch !== null) {
      const from = edgeMatch[1]!;
      const to = edgeMatch[3]!;
      edges.push({ from, to, title: labelTitle(edgeMatch[2]!, `Imported task ${edgeIndex + 1}`), line, index: edgeIndex });
      edgeIndex += 1;
      continue;
    }
    unsupported.push(line);
  }
  for (const edge of edges) {
    if (!nodes.has(edge.from)) nodes.set(edge.from, { rawId: edge.from, title: edge.from, line: edge.line });
    if (!nodes.has(edge.to)) nodes.set(edge.to, { rawId: edge.to, title: edge.to, line: edge.line });
  }
  if (nodes.size === 0) {
    throw new ImportFailure("PTCNV-102", "no importable nodes");
  }
  const sortedNodes = [...nodes.values()].sort((left, right) => compareStableStrings(left.rawId, right.rawId));
  const generatedIds: GeneratedId[] = [];
  const milestoneIds = new Map<string, string>();
  sortedNodes.forEach((node, index) => {
    const generatedId = `MILESTONE_${String(index + 1).padStart(3, "0")}`;
    milestoneIds.set(node.rawId, generatedId);
    generatedIds.push({ sourceElement: `node:${node.rawId}`, generatedId });
  });
  edges.forEach((edge, index) => {
    generatedIds.push({ sourceElement: `edge:${edge.index + 1}`, generatedId: `TASK_${String(index + 1).padStart(3, "0")}` });
  });
  const indegree = new Map(sortedNodes.map(({ rawId }) => [rawId, 0]));
  const outdegree = new Map(sortedNodes.map(({ rawId }) => [rawId, 0]));
  for (const edge of edges) {
    indegree.set(edge.to, indegree.get(edge.to)! + 1);
    outdegree.set(edge.from, outdegree.get(edge.from)! + 1);
  }
  const roots = new Set(sortedNodes.filter(({ rawId }) => indegree.get(rawId) === 0).map(({ rawId }) => rawId));
  const sinks = sortedNodes.filter(({ rawId }) => outdegree.get(rawId) === 0);
  const syntheticFinish = sinks.length !== 1;
  const finish = syntheticFinish ? "MERMAID_FINISH" : milestoneIds.get(sinks[0]!.rawId)!;
  if (syntheticFinish) generatedIds.push({ sourceElement: "synthetic:finish", generatedId: finish });
  const declarations: string[] = [[
    "project IMPORTED_MERMAID:",
    "  version 1",
    "  title \"Imported Mermaid\"",
    "  duration_unit day",
    `  finish ${finish}`,
  ].join("\n")];
  for (const node of sortedNodes) {
    declarations.push([
      `milestone ${milestoneIds.get(node.rawId)!}:`,
      `  title ${JSON.stringify(node.title)}`,
      ...(roots.has(node.rawId) ? ["  state reached"] : []),
    ].join("\n"));
  }
  if (syntheticFinish) {
    declarations.push(["milestone MERMAID_FINISH:", "  title \"Imported finish\""].join("\n"));
  }
  edges.forEach((edge, index) => {
    declarations.push([
      `task TASK_${String(index + 1).padStart(3, "0")} ${milestoneIds.get(edge.from)!} -> ${milestoneIds.get(edge.to)!}:`,
      `  title ${JSON.stringify(edge.title)}`,
      "  duration 1d",
    ].join("\n"));
  });
  if (syntheticFinish) {
    sinks.forEach((sink, index) => {
      const id = `FINISH_GATE_${String(index + 1).padStart(3, "0")}`;
      generatedIds.push({ sourceElement: `synthetic:sink:${sink.rawId}`, generatedId: id });
      declarations.push([
        `gate ${id} ${milestoneIds.get(sink.rawId)!} -> MERMAID_FINISH:`,
        "  reason \"Generated finish connector\"",
      ].join("\n"));
    });
  }
  const artifact = `${declarations.join("\n\n")}\n`;
  const checked = checkDocument(artifact, { maxDiagnostics });
  if (!checked.ok) {
    throw new ImportFailure("PTCNV-106", "could not construct a valid AoA DAG from plain Mermaid");
  }
  const records: ConversionLoss[] = [
    loss("PTCNV-202", "project fields were generated using plain Mermaid defaults", "IMPORTED_MERMAID", lineSpan(first)),
    loss("PTCNV-204", "task fields other than resource and estimate cannot be restored from plain Mermaid", null, null),
    ...sortedNodes.map((node) => loss(
      "PTCNV-201",
      `generated stable milestone ID for ${node.rawId}`,
      milestoneIds.get(node.rawId)!,
      lineSpan(node.line),
    )),
    ...edges.flatMap((edge, index) => [
      loss("PTCNV-201", `generated stable task ID for edge ${edge.index + 1}`, `TASK_${String(index + 1).padStart(3, "0")}`, lineSpan(edge.line)),
      loss("PTCNV-203", "generated as a task because the plain Mermaid edge kind cannot be determined as task or gate", `TASK_${String(index + 1).padStart(3, "0")}`, lineSpan(edge.line)),
    ]),
    ...(syntheticFinish
      ? [loss("PTCNV-201", "generated finish and gate IDs to merge multiple sinks", "MERMAID_FINISH", null)]
      : []),
    ...unsupported.map((line) => loss("PTCNV-205", "ignored unsupported Mermaid statement", null, lineSpan(line))),
  ];
  return {
    ok: true,
    document: checked.document,
    documentId: checked.documentId,
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
    profile: "plain",
    analysis: "none",
    capacityOverrides: new Map(),
    artifact,
    artifactDigest: sha256(artifact),
    lossReport: { lossless: false, records },
    generatedIds,
  };
}

export function importMermaid(
  text: string,
  options: MermaidImportOptions = {},
): MermaidImportResult {
  const maxDiagnostics = normalizeMaxDiagnostics(options.maxDiagnostics);
  const lines = sourceLines(text);
  const profile = profileDetected(lines) ? "perttool" : "plain";
  try {
    return profile === "perttool"
      ? importProfile(text, lines, maxDiagnostics)
      : importPlain(text, lines, maxDiagnostics);
  } catch (error) {
    if (error instanceof ImportFailure) {
      return emptyResult(profile, error, maxDiagnostics);
    }
    throw error;
  }
}
