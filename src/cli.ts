#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";
import { TextDecoder } from "node:util";
import type { AnalysisMode } from "./application/analyze.js";
import { analyzeDocument } from "./application/analyze.js";
import { checkDocument } from "./application/check.js";
import { planFormat, type FormatPreviewResult } from "./application/format.js";
import { planBatchMutation, planMutation } from "./application/mutate.js";
import { selectNextTasks } from "./application/next.js";
import {
  exportMermaid,
  type ConversionLoss,
  type MermaidAnalysisMode,
  type MermaidProfile,
} from "./conversion/mermaid.js";
import type { HelpLevel } from "./help/registry.js";
import { getHelp } from "./help/registry.js";
import {
  documentContentFromBytes,
  readDocumentFile,
} from "./io/document-file.js";
import {
  createArtifactFile,
  createDocumentFile,
  replaceDocumentFile,
  SafeWriteConflictError,
  SafeWriteVerificationError,
  type DocumentWriteResult,
} from "./io/safe-write.js";
import type { Diagnostic, SourceSpan } from "./model/diagnostics.js";
import type { Rational } from "./model/rational.js";
import { formatDecimal } from "./model/rational.js";
import type { DurationUnit, Velocity } from "./model/units.js";
import { convertWithVelocity, durationSuffix } from "./model/units.js";
import type {
  MilestoneClearableField,
  MilestoneMutationState,
  Mutation,
  MutationResult,
  ResourceClearableField,
  TaskClearableField,
  TaskEstimateInput,
  TaskMutationStatus,
  TaskRequirementInput,
} from "./mutation/types.js";
import {
  planAdvance,
  type AdvanceDetails,
} from "./mutation/advance.js";
import { TOOL_VERSION } from "./version.js";

type OutputFormat = "text" | "json";
type ColorMode = "auto" | "always" | "never";

interface ParsedOptions {
  readonly positionals: readonly string[];
  readonly values: ReadonlyMap<string, string>;
  readonly repeatedValues: ReadonlyMap<string, readonly string[]>;
  readonly flags: ReadonlySet<string>;
}

class UsageError extends Error {
  readonly code = "PTCLI-001";
}

function topLevelHelp(): string {
  return [
    "perttool - document-based PERT/CPM task management",
    "",
    "Usage:",
    "  perttool --version",
    "  perttool --help",
    "  perttool dsl check <file> [--format text|json]",
    "  perttool dsl format <file> [--check] [--diff] [--format text|json]",
    "  perttool dsl help [topic [subtopic]] [--level index|quick|detail] [--format text|json]",
    "  perttool dag analyze <file> [--schedule precedence|resource|both] [--format text|json]",
    "  perttool dag next <file> [--capacity <resource-id>=<integer>] [--format text|json]",
    "  perttool dag advance <file> [--diff] [--write | --out <path>] [--format text|json]",
    "  perttool dag render <file> --to mermaid [--profile perttool|plain] [--format text|json]",
    "  perttool task add|set|remove|finish ...",
    "  perttool milestone add|set|remove ...",
    "  perttool resource add|set|remove ...",
    "  perttool mutation apply <file> --request <json-file|-> [--diff] [--format text|json]",
    "",
    "Format and mutation commands preview by default; use --write or --out for explicit writes.",
  ].join("\n");
}

function commandHelp(resource: string, action: string): string {
  if (resource === "dsl" && action === "check") {
    return [
      "Usage: perttool dsl check <file>",
      "  [--warnings-as-errors]",
      "  [--max-diagnostics <integer>]",
      "  [--format text|json]",
      "  [--color auto|always|never]",
    ].join("\n");
  }
  if (resource === "dsl" && action === "format") return [
    "Usage: perttool dsl format <file>",
    "  [--check] [--diff]",
    "  [--write [--expect-digest <digest>] | --out <path>]",
    "  [--max-diagnostics <integer>] [--warnings-as-errors]",
    "  [--format text|json] [--color auto|always|never]",
  ].join("\n");
  if (resource === "dsl" && action === "help") return [
    "Usage: perttool dsl help [topic [subtopic]]",
    "  [--level index|quick|detail]",
    "  [--format text|json]",
    "  [--color auto|always|never]",
  ].join("\n");
  if (resource === "dag" && action === "analyze") return [
    "Usage: perttool dag analyze <file>",
    "  [--schedule precedence|resource|both]",
    "  [--capacity <resource-id>=<integer>]...",
    "  [--max-paths <integer>] [--precision <integer>]",
    "  [--max-diagnostics <integer>]",
    "  [--warnings-as-errors]",
    "  [--format text|json] [--color auto|always|never]",
  ].join("\n");
  if (resource === "dag" && action === "next") return [
    "Usage: perttool dag next <file>",
    "  [--capacity <resource-id>=<integer>]...",
    "  [--explain-depth <integer>] [--precision <integer>]",
    "  [--max-diagnostics <integer>]",
    "  [--warnings-as-errors]",
    "  [--format text|json] [--color auto|always|never]",
  ].join("\n");
  if (resource === "dag" && action === "advance") return [
    "Usage: perttool dag advance <file>",
    "  [--diff] [--write [--expect-digest <digest>] | --out <path>]",
    "  [--max-diagnostics <integer>] [--warnings-as-errors]",
    "  [--format text|json] [--color auto|always|never]",
  ].join("\n");
  if (resource === "dag" && action === "render") return [
    "Usage: perttool dag render <file> --to mermaid",
    "  [--profile perttool|plain] [--analysis none|precedence|resource|both]",
    "  [--capacity <resource-id>=<integer>]... [--strict-loss] [--out <path>]",
    "  [--max-diagnostics <integer>] [--warnings-as-errors]",
    "  [--format text|json] [--color auto|always|never]",
  ].join("\n");
  const preview = "  [--diff] [--write [--expect-digest <digest>] | --out <path>] [--max-diagnostics <integer>] [--warnings-as-errors] [--format text|json] [--color auto|always|never]";
  if (resource === "task" && action === "add") return [
    "Usage: perttool task add <file> <id> <from> <to>",
    "  --title <text> (--duration <duration> | --optimistic <duration> --most-likely <duration> --pessimistic <duration>)",
    "  [--description <text>] [--status planned|active|blocked|done] [--priority <integer>]",
    "  [--owner <text>] [--blocked-reason <text>] [--source <text>] [--tag <tag>]... [--require <resource-id>=<integer>]...",
    preview,
  ].join("\n");
  if (resource === "task" && action === "set") return [
    "Usage: perttool task set <file> <id> [field options]",
    "  [--from <id>] [--to <id>] [--title <text>] [--description <text>] [--duration <duration>]",
    "  [--optimistic <duration> --most-likely <duration> --pessimistic <duration>]",
    "  [--status planned|active|blocked|done] [--priority <integer>] [--owner <text>]",
    "  [--blocked-reason <text>] [--source <text>] [--require <resource-id>=<integer>]...",
    "  [--add-tag <tag>]... [--remove-tag <tag>]... [--remove-require <resource-id>]... [--clear <field>]...",
    preview,
  ].join("\n");
  if (resource === "task") return [
    `Usage: perttool task ${action} <file> <id>`,
    preview,
  ].join("\n");
  if (resource === "milestone" && action === "add") return [
    "Usage: perttool milestone add <file> <id> --title <text>",
    "  [--description <text>] [--state planned|reached] [--tag <tag>]...",
    preview,
  ].join("\n");
  if (resource === "milestone" && action === "set") return [
    "Usage: perttool milestone set <file> <id> [--title <text>] [--description <text>] [--state planned|reached]",
    "  [--add-tag <tag>]... [--remove-tag <tag>]... [--clear description|state|tags]...",
    preview,
  ].join("\n");
  if (resource === "milestone") return [
    `Usage: perttool milestone ${action} <file> <id>`,
    preview,
  ].join("\n");
  if (resource === "resource" && action === "add") return [
    "Usage: perttool resource add <file> <id> --title <text> --capacity <integer>",
    "  [--description <text>]",
    preview,
  ].join("\n");
  if (resource === "resource" && action === "set") return [
    "Usage: perttool resource set <file> <id> [--title <text>] [--description <text>] [--capacity <integer>] [--clear description]",
    preview,
  ].join("\n");
  if (resource === "resource") return [
    `Usage: perttool resource ${action} <file> <id>`,
    preview,
  ].join("\n");
  return [
    "Usage: perttool mutation apply <file> --request <json-file|->",
    preview,
  ].join("\n");
}

function parseOptions(
  args: readonly string[],
  valueOptions: ReadonlySet<string>,
  flagOptions: ReadonlySet<string>,
  repeatableOptions: ReadonlySet<string> = new Set(),
): ParsedOptions {
  const positionals: string[] = [];
  const values = new Map<string, string>();
  const repeatedValues = new Map<string, string[]>();
  const flags = new Set<string>();
  let optionsEnded = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (!optionsEnded && argument === "--") {
      optionsEnded = true;
      continue;
    }
    if (optionsEnded || !argument.startsWith("--")) {
      positionals.push(argument);
      continue;
    }
    const equals = argument.indexOf("=");
    const name = equals === -1 ? argument.slice(2) : argument.slice(2, equals);
    if (flagOptions.has(name)) {
      if (equals !== -1) throw new UsageError(`boolean option --${name} does not take a value`);
      if (flags.has(name)) throw new UsageError(`duplicate option --${name}`);
      flags.add(name);
      continue;
    }
    if (!valueOptions.has(name) && !repeatableOptions.has(name)) {
      throw new UsageError(`unknown option --${name}`);
    }
    const isRepeatable = repeatableOptions.has(name);
    if (values.has(name)) throw new UsageError(`duplicate option --${name}`);
    const value = equals === -1 ? args[index + 1] : argument.slice(equals + 1);
    if (value === undefined || value.startsWith("--")) {
      throw new UsageError(`option --${name} requires a value`);
    }
    if (equals === -1) index += 1;
    if (isRepeatable) {
      const entries = repeatedValues.get(name) ?? [];
      entries.push(value);
      repeatedValues.set(name, entries);
    } else {
      values.set(name, value);
    }
  }
  return { positionals, values, repeatedValues, flags };
}

function outputFormat(value: string | undefined): OutputFormat {
  if (value === undefined || value === "text") return "text";
  if (value === "json") return "json";
  throw new UsageError("--format must be text or json");
}

function colorMode(value: string | undefined, format: OutputFormat): ColorMode {
  const color = value ?? "auto";
  if (color !== "auto" && color !== "always" && color !== "never") {
    throw new UsageError("--color must be auto, always, or never");
  }
  if (format === "json" && color === "always") {
    throw new UsageError("--color always cannot be used with --format json");
  }
  return color;
}

function helpLevel(value: string | undefined, hasTopic: boolean): HelpLevel {
  if (value === undefined) return hasTopic ? "quick" : "index";
  if (value === "index" || value === "quick" || value === "detail") return value;
  throw new UsageError("--level must be index, quick, or detail");
}

function jsonRequested(args: readonly string[]): boolean {
  return args.some(
    (argument, index) =>
      argument === "--format=json" ||
      (argument === "--format" && args[index + 1] === "json"),
  );
}

function jsonPosition(position: SourceSpan["start"]): {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
} {
  return {
    offset: position.offset,
    line: position.line + 1,
    column: position.column + 1,
  };
}

function jsonSpan(span: SourceSpan): {
  readonly start: ReturnType<typeof jsonPosition>;
  readonly end: ReturnType<typeof jsonPosition>;
} {
  return { start: jsonPosition(span.start), end: jsonPosition(span.end) };
}

function jsonDiagnostic(diagnostic: Diagnostic): Readonly<Record<string, unknown>> {
  return {
    code: diagnostic.code,
    severity: diagnostic.severity,
    message: diagnostic.message,
    entity_id: diagnostic.entityId ?? null,
    span: diagnostic.span === undefined ? null : jsonSpan(diagnostic.span),
    related: (diagnostic.related ?? []).map((related) => ({
      message: related.message,
      span: jsonSpan(related.span),
    })),
    help_topic: diagnostic.helpTopic ?? null,
    expected_syntax: diagnostic.expectedSyntax ?? null,
    fixes: [],
    data: diagnostic.data ?? {},
  };
}

function colorEnabled(mode: ColorMode): boolean {
  return mode === "always" || (mode === "auto" && Boolean(process.stderr.isTTY));
}

function renderDiagnostic(
  diagnostic: Diagnostic,
  source: string,
  mode: ColorMode,
): string {
  const severity = colorEnabled(mode)
    ? diagnostic.severity === "error"
      ? `\u001b[31m${diagnostic.severity}\u001b[0m`
      : diagnostic.severity === "warning"
        ? `\u001b[33m${diagnostic.severity}\u001b[0m`
        : diagnostic.severity
    : diagnostic.severity;
  const lines = [`${diagnostic.code} ${severity}: ${diagnostic.message}`];
  if (diagnostic.span !== undefined) {
    lines.push(
      `  --> ${source}:${diagnostic.span.start.line + 1}:${diagnostic.span.start.column + 1}`,
    );
  }
  for (const related of diagnostic.related ?? []) {
    lines.push(
      `  related: ${source}:${related.span.start.line + 1}:${related.span.start.column + 1} ${related.message}`,
    );
  }
  if (diagnostic.helpTopic !== undefined) {
    const [topic, subtopic] = diagnostic.helpTopic.split(".", 2);
    lines.push(
      `  help: perttool dsl help ${topic}${subtopic === undefined ? "" : ` ${subtopic}`} --level quick`,
    );
  }
  return lines.join("\n");
}

async function readDocument(source: string): Promise<{
  readonly text: string;
  readonly digest: string;
}> {
  const content = source === "-"
    ? documentContentFromBytes(await readStdin())
    : await readDocumentFile(source);
  return { text: content.text, digest: content.digest };
}

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function cliError(
  error: Error,
  exitCode: number,
  operation: string | null,
  json: boolean,
): number {
  const code = error instanceof UsageError
    ? error.code
    : error instanceof SafeWriteConflictError
      ? "PTIO-501"
      : error instanceof SafeWriteVerificationError
        ? "PTIO-502"
        : exitCode === 3
          ? "PTCLI-003"
          : "PTCLI-070";
  const diagnostic: Diagnostic = {
    code,
    severity: "error",
    message: error.message,
    helpTopic: "errors",
    ...((error instanceof SafeWriteConflictError ||
      error instanceof SafeWriteVerificationError)
      ? { data: { reason: error.reason } }
      : {}),
  };
  if (json) {
    writeJson({
      schema_version: "Perttool.CliError.v1",
      tool_version: TOOL_VERSION,
      operation,
      ok: false,
      diagnostics: [jsonDiagnostic(diagnostic)],
    });
  } else {
    process.stderr.write(`${renderDiagnostic(diagnostic, "<cli>", "never")}\n`);
  }
  return exitCode;
}

async function runCheck(args: readonly string[]): Promise<number> {
  const parsed = parseOptions(
    args,
    new Set(["format", "color", "max-diagnostics"]),
    new Set(["warnings-as-errors"]),
  );
  if (parsed.positionals.length !== 1) {
    throw new UsageError("dsl check requires exactly one <file>");
  }
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const sourceOperand = parsed.positionals[0]!;
  const maxDiagnostics = boundedInteger(
    parsed.values.get("max-diagnostics"),
    "max-diagnostics",
    100,
    1,
    1000,
  );
  const source = sourceOperand === "-" ? "<stdin>" : sourceOperand;
  let input: Awaited<ReturnType<typeof readDocument>>;
  try {
    input = await readDocument(sourceOperand);
  } catch (error) {
    return cliError(
      error instanceof Error ? error : new Error(String(error)),
      3,
      "dsl.check",
      format === "json",
    );
  }
  const result = checkDocument(input.text, { maxDiagnostics });
  const warningsAsErrors = parsed.flags.has("warnings-as-errors");
  const warningFailure = warningsAsErrors && result.summary.warnings > 0;
  const ok = result.ok && !warningFailure;
  if (format === "json") {
    writeJson({
      schema_version: "Perttool.CheckResult.v1",
      tool_version: TOOL_VERSION,
      operation: "dsl.check",
      ok,
      document_id: result.documentId,
      source,
      source_digest: input.digest,
      diagnostics: result.diagnostics.map(jsonDiagnostic),
      diagnostics_truncated: result.diagnosticsTruncated,
      grammar_version: result.grammarVersion,
      summary: result.summary,
    });
  } else {
    if (ok) {
      process.stdout.write(
        `OK ${source} project=${result.documentId ?? "-"} milestones=${result.summary.milestones} tasks=${result.summary.tasks} gates=${result.summary.gates} resources=${result.summary.resources}\n`,
      );
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    if (result.diagnosticsTruncated) {
      process.stderr.write(`DIAGNOSTICS_TRUNCATED true limit=${maxDiagnostics}\n`);
    }
  }
  return ok ? 0 : 1;
}

function boundedInteger(
  raw: string | undefined,
  option: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  if (raw === undefined) return defaultValue;
  if (!/^[0-9]+$/.test(raw)) {
    throw new UsageError(`--${option} must be an integer from ${minimum} to ${maximum}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new UsageError(`--${option} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

function analysisMode(raw: string | undefined): AnalysisMode {
  if (raw === undefined || raw === "both") return "both";
  if (raw === "precedence" || raw === "resource") return raw;
  throw new UsageError("--schedule must be precedence, resource, or both");
}

function capacityOverrides(values: readonly string[]): ReadonlyMap<string, number> {
  const overrides = new Map<string, number>();
  for (const value of values) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*)=([0-9]+)$/.exec(value);
    if (match === null) {
      throw new UsageError("--capacity must be <resource-id>=<integer>");
    }
    const id = match[1]!;
    const capacity = Number(match[2]!);
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 2_147_483_647) {
      throw new UsageError("--capacity integer must be from 1 to 2147483647");
    }
    if (overrides.has(id)) throw new UsageError(`duplicate --capacity for ${id}`);
    overrides.set(id, capacity);
  }
  return overrides;
}

const mutationCommonValueOptions = [
  "format",
  "color",
  "max-diagnostics",
  "out",
  "expect-digest",
] as const;
const mutationCommonFlagOptions = ["diff", "write", "warnings-as-errors"] as const;

type EditingWriteRequest =
  | { readonly mode: "preview"; readonly target: null }
  | {
      readonly mode: "in_place";
      readonly target: string;
      readonly expectedDigest?: string;
    }
  | { readonly mode: "out"; readonly target: string };

function editingWriteRequest(
  parsed: ParsedOptions,
  sourceOperand: string,
  check = false,
): EditingWriteRequest {
  const write = parsed.flags.has("write");
  const out = parsed.values.get("out");
  const expectedDigest = parsed.values.get("expect-digest");
  if (write && out !== undefined) {
    throw new UsageError("--write and --out are mutually exclusive");
  }
  if (check && (write || out !== undefined)) {
    throw new UsageError("--check cannot be used with --write or --out");
  }
  if (parsed.flags.has("diff") && (write || out !== undefined)) {
    throw new UsageError("--diff is preview-only and cannot be used with --write or --out");
  }
  if (expectedDigest !== undefined && !write) {
    throw new UsageError("--expect-digest can only be used with --write");
  }
  if (expectedDigest !== undefined && !/^sha256:[0-9a-f]{64}$/.test(expectedDigest)) {
    throw new UsageError("--expect-digest must be sha256 followed by 64 lowercase hex digits");
  }
  if (write && sourceOperand === "-") {
    throw new UsageError("--write cannot be used with stdin");
  }
  if (out !== undefined && out.length === 0) {
    throw new UsageError("--out path must not be empty");
  }
  if (write) {
    return {
      mode: "in_place",
      target: sourceOperand,
      ...(expectedDigest === undefined ? {} : { expectedDigest }),
    };
  }
  if (out !== undefined) return { mode: "out", target: out };
  return { mode: "preview", target: null };
}

function assertExpectedDigest(
  request: EditingWriteRequest,
  initialDigest: string,
): void {
  if (
    request.mode === "in_place" &&
    request.expectedDigest !== undefined &&
    request.expectedDigest !== initialDigest
  ) {
    throw new SafeWriteConflictError(
      "expected_digest_mismatch",
      "--expect-digestがinitial document digestと一致しません",
    );
  }
}

async function commitCandidate(
  request: Exclude<EditingWriteRequest, { readonly mode: "preview" }>,
  candidateText: string | null,
  initialDigest: string,
): Promise<DocumentWriteResult> {
  if (candidateText === null) {
    throw new SafeWriteVerificationError(
      "invalid_candidate",
      "successful editing resultにcandidate textがありません",
    );
  }
  return request.mode === "in_place"
    ? replaceDocumentFile(request.target, candidateText, {
        initialDigest,
        ...(request.expectedDigest === undefined
          ? {}
          : { expectedDigest: request.expectedDigest }),
      })
    : createDocumentFile(request.target, candidateText);
}

function writeFailureExit(error: unknown, operation: string, json: boolean): number {
  const normalized = error instanceof Error ? error : new Error(String(error));
  const exitCode = normalized instanceof SafeWriteConflictError
    ? 5
    : normalized instanceof SafeWriteVerificationError
      ? 70
      : 3;
  return cliError(normalized, exitCode, operation, json);
}

function renderWriteSummary(operation: string, result: DocumentWriteResult): string {
  return `WRITE ${operation} mode=${result.mode} target=${result.target} digest=${result.digest} written=${result.written}\n`;
}

async function runFormat(args: readonly string[]): Promise<number> {
  const parsed = parseOptions(
    args,
    new Set(["format", "color", "max-diagnostics", "out", "expect-digest"]),
    new Set(["check", "diff", "write", "warnings-as-errors"]),
  );
  if (parsed.positionals.length !== 1) {
    throw new UsageError("dsl format requires exactly one <file>");
  }
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const maxDiagnostics = boundedInteger(
    parsed.values.get("max-diagnostics"),
    "max-diagnostics",
    100,
    1,
    1000,
  );
  const sourceOperand = parsed.positionals[0]!;
  const writeRequest = editingWriteRequest(
    parsed,
    sourceOperand,
    parsed.flags.has("check"),
  );
  const source = sourceOperand === "-" ? "<stdin>" : sourceOperand;
  let input: Awaited<ReturnType<typeof readDocument>>;
  try {
    input = await readDocument(sourceOperand);
  } catch (error) {
    return cliError(
      error instanceof Error ? error : new Error(String(error)),
      3,
      "dsl.format",
      format === "json",
    );
  }
  const result = planFormat(input.text, {
    maxDiagnostics,
    originalLabel: source,
    updatedLabel: "candidate",
  });
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated ||
      result.diagnostics.some((diagnostic) => diagnostic.severity === "warning"));
  const checkFailure = parsed.flags.has("check") && result.ok && result.changed;
  const ok = result.ok && !warningFailure && !checkFailure;
  let writeResult: DocumentWriteResult | null = null;
  if (result.ok) {
    try {
      assertExpectedDigest(writeRequest, input.digest);
      if (ok && writeRequest.mode !== "preview") {
        writeResult = await commitCandidate(writeRequest, result.updatedText, input.digest);
      }
    } catch (error) {
      return writeFailureExit(error, "dsl.format", format === "json");
    }
  }
  if (format === "json") {
    writeJson({
      schema_version: "Perttool.FormatResult.v1",
      tool_version: TOOL_VERSION,
      operation: "dsl.format",
      ok,
      document_id: result.documentId,
      source,
      source_digest: input.digest,
      diagnostics: result.diagnostics.map(jsonDiagnostic),
      diagnostics_truncated: result.diagnosticsTruncated,
      ...previewResultJson(result, result.ok, writeRequest, writeResult),
    });
  } else {
    const candidateAllowed = result.ok && !warningFailure;
    if (candidateAllowed) {
      if (writeResult !== null) {
        process.stderr.write(renderWriteSummary("dsl.format", writeResult));
      } else if (parsed.flags.has("check")) {
        if (parsed.flags.has("diff")) process.stdout.write(result.diff ?? "");
      } else {
        process.stdout.write(
          parsed.flags.has("diff") ? (result.diff ?? "") : (result.updatedText ?? ""),
        );
        if (!parsed.flags.has("diff")) {
          process.stderr.write(
            `PREVIEW dsl.format changed=${result.changed} original_digest=${result.originalDigest} updated_digest=${result.updatedDigest}\n`,
          );
        }
      }
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    if (result.diagnosticsTruncated) {
      process.stderr.write(`DIAGNOSTICS_TRUNCATED true limit=${maxDiagnostics}\n`);
    }
  }
  return ok ? 0 : 1;
}

function mutationOptionSets(
  resource: string,
  action: string,
): {
  readonly values: ReadonlySet<string>;
  readonly flags: ReadonlySet<string>;
  readonly repeatable: ReadonlySet<string>;
} {
  const values = new Set<string>(mutationCommonValueOptions);
  const flags = new Set<string>(mutationCommonFlagOptions);
  const repeatable = new Set<string>();
  const addValues = (...names: readonly string[]): void => {
    for (const name of names) values.add(name);
  };
  const addRepeatable = (...names: readonly string[]): void => {
    for (const name of names) repeatable.add(name);
  };

  if (resource === "task" && action === "add") {
    addValues(
      "title", "description", "duration", "optimistic", "most-likely",
      "pessimistic", "status", "priority", "owner", "blocked-reason", "source",
    );
    addRepeatable("tag", "require");
  } else if (resource === "task" && action === "set") {
    addValues(
      "from", "to", "title", "description", "duration", "optimistic",
      "most-likely", "pessimistic", "status", "priority", "owner",
      "blocked-reason", "source",
    );
    addRepeatable("require", "add-tag", "remove-tag", "remove-require", "clear");
  } else if (resource === "milestone" && action === "add") {
    addValues("title", "description", "state");
    addRepeatable("tag");
  } else if (resource === "milestone" && action === "set") {
    addValues("title", "description", "state");
    addRepeatable("add-tag", "remove-tag", "clear");
  } else if (resource === "resource" && action === "add") {
    addValues("title", "description", "capacity");
  } else if (resource === "resource" && action === "set") {
    addValues("title", "description", "capacity");
    addRepeatable("clear");
  } else if (resource === "mutation" && action === "apply") {
    addValues("request");
  }
  return { values, flags, repeatable };
}

function requiredOption(parsed: ParsedOptions, name: string): string {
  const value = parsed.values.get(name);
  if (value === undefined) throw new UsageError(`option --${name} is required`);
  return value;
}

function optionalInteger(
  parsed: ParsedOptions,
  name: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const raw = parsed.values.get(name);
  return raw === undefined
    ? undefined
    : boundedInteger(raw, name, minimum, minimum, maximum);
}

function enumOption<T extends string>(
  raw: string | undefined,
  option: string,
  allowed: ReadonlySet<string>,
): T | undefined {
  if (raw === undefined) return undefined;
  if (!allowed.has(raw)) {
    throw new UsageError(`--${option} must be one of ${[...allowed].join(", ")}`);
  }
  return raw as T;
}

function uniqueRepeated(parsed: ParsedOptions, option: string): readonly string[] {
  const values = parsed.repeatedValues.get(option) ?? [];
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new UsageError(`duplicate --${option} value ${value}`);
    seen.add(value);
  }
  return values;
}

function enumRepeated<T extends string>(
  parsed: ParsedOptions,
  option: string,
  allowed: ReadonlySet<string>,
): readonly T[] {
  return uniqueRepeated(parsed, option).map((value) => {
    if (!allowed.has(value)) {
      throw new UsageError(`--${option} must be one of ${[...allowed].join(", ")}`);
    }
    return value as T;
  });
}

function ensureDisjoint(
  left: readonly string[],
  leftOption: string,
  right: readonly string[],
  rightOption: string,
): void {
  const rightSet = new Set(right);
  const duplicate = left.find((value) => rightSet.has(value));
  if (duplicate !== undefined) {
    throw new UsageError(
      `--${leftOption} and --${rightOption} conflict for ${duplicate}`,
    );
  }
}

function taskTiming(
  parsed: ParsedOptions,
  required: boolean,
): { readonly duration: string } | { readonly estimate: TaskEstimateInput } | undefined {
  const duration = parsed.values.get("duration");
  const optimistic = parsed.values.get("optimistic");
  const mostLikely = parsed.values.get("most-likely");
  const pessimistic = parsed.values.get("pessimistic");
  const estimateValues = [optimistic, mostLikely, pessimistic];
  const hasEstimate = estimateValues.some((value) => value !== undefined);
  if (duration !== undefined && hasEstimate) {
    throw new UsageError("--duration and three-point estimate options are mutually exclusive");
  }
  if (hasEstimate && estimateValues.some((value) => value === undefined)) {
    throw new UsageError(
      "--optimistic, --most-likely, and --pessimistic must be specified together",
    );
  }
  if (duration !== undefined) return { duration };
  if (optimistic !== undefined && mostLikely !== undefined && pessimistic !== undefined) {
    return { estimate: { optimistic, mostLikely, pessimistic } };
  }
  if (required) {
    throw new UsageError("--duration or a complete three-point estimate is required");
  }
  return undefined;
}

function requirementOptions(parsed: ParsedOptions): readonly TaskRequirementInput[] {
  const requirements: TaskRequirementInput[] = [];
  const seen = new Set<string>();
  for (const raw of parsed.repeatedValues.get("require") ?? []) {
    const match = /^(.+)=([0-9]+)$/.exec(raw);
    if (match === null) {
      throw new UsageError("--require must be <resource-id>=<integer>");
    }
    const resourceId = match[1]!;
    const units = Number(match[2]!);
    if (!Number.isSafeInteger(units) || units < 1 || units > 2_147_483_647) {
      throw new UsageError("--require integer must be from 1 to 2147483647");
    }
    if (seen.has(resourceId)) {
      throw new UsageError(`duplicate --require for ${resourceId}`);
    }
    seen.add(resourceId);
    requirements.push({ resourceId, units });
  }
  return requirements;
}

function taskMutationFromOptions(action: string, parsed: ParsedOptions): Mutation {
  const expectedPositionals = action === "add" ? 4 : 2;
  if (parsed.positionals.length !== expectedPositionals) {
    throw new UsageError(
      `task ${action} requires ${action === "add" ? "<file> <id> <from> <to>" : "<file> <id>"}`,
    );
  }
  const id = parsed.positionals[1]!;
  if (action === "remove") return { kind: "task.remove", id };
  if (action === "finish") return { kind: "task.finish", id };

  const status = enumOption<TaskMutationStatus>(
    parsed.values.get("status"),
    "status",
    new Set(["planned", "active", "blocked", "done"]),
  );
  const priority = optionalInteger(parsed, "priority", 0, 2_147_483_647);
  const timing = taskTiming(parsed, action === "add");
  const requirements = requirementOptions(parsed);

  if (action === "add") {
    const title = requiredOption(parsed, "title");
    return {
      kind: "task.add",
      id,
      from: parsed.positionals[2]!,
      to: parsed.positionals[3]!,
      task: {
        title,
        ...timing!,
        ...(parsed.values.get("description") === undefined
          ? {}
          : { description: parsed.values.get("description")! }),
        ...(status === undefined ? {} : { status }),
        ...(priority === undefined ? {} : { priority }),
        ...(requirements.length === 0 ? {} : { requirements }),
        ...(parsed.values.get("owner") === undefined
          ? {}
          : { owner: parsed.values.get("owner")! }),
        ...((parsed.repeatedValues.get("tag") ?? []).length === 0
          ? {}
          : { tags: parsed.repeatedValues.get("tag")! }),
        ...(parsed.values.get("blocked-reason") === undefined
          ? {}
          : { blockedReason: parsed.values.get("blocked-reason")! }),
        ...(parsed.values.get("source") === undefined
          ? {}
          : { source: parsed.values.get("source")! }),
      },
    };
  }

  const clear = enumRepeated<TaskClearableField>(
    parsed,
    "clear",
    new Set([
      "description", "status", "priority", "owner", "blocked_reason", "source",
      "tags", "requires",
    ]),
  );
  const addTags = uniqueRepeated(parsed, "add-tag");
  const removeTags = uniqueRepeated(parsed, "remove-tag");
  const removeRequirements = uniqueRepeated(parsed, "remove-require");
  ensureDisjoint(addTags, "add-tag", removeTags, "remove-tag");
  ensureDisjoint(
    requirements.map(({ resourceId }) => resourceId),
    "require",
    removeRequirements,
    "remove-require",
  );
  const set = {
    ...(parsed.values.get("title") === undefined
      ? {}
      : { title: parsed.values.get("title")! }),
    ...(parsed.values.get("description") === undefined
      ? {}
      : { description: parsed.values.get("description")! }),
    ...timing,
    ...(status === undefined ? {} : { status }),
    ...(priority === undefined ? {} : { priority }),
    ...(parsed.values.get("owner") === undefined
      ? {}
      : { owner: parsed.values.get("owner")! }),
    ...(parsed.values.get("blocked-reason") === undefined
      ? {}
      : { blockedReason: parsed.values.get("blocked-reason")! }),
    ...(parsed.values.get("source") === undefined
      ? {}
      : { source: parsed.values.get("source")! }),
  };
  const clearConflicts = new Map<TaskClearableField, boolean>([
    ["description", parsed.values.has("description")],
    ["status", status !== undefined],
    ["priority", priority !== undefined],
    ["owner", parsed.values.has("owner")],
    ["blocked_reason", parsed.values.has("blocked-reason")],
    ["source", parsed.values.has("source")],
    ["tags", addTags.length > 0 || removeTags.length > 0],
    ["requires", requirements.length > 0 || removeRequirements.length > 0],
  ]);
  const conflict = clear.find((field) => clearConflicts.get(field) === true);
  if (conflict !== undefined) {
    throw new UsageError(`--clear ${conflict} conflicts with another field option`);
  }
  return {
    kind: "task.set",
    id,
    ...(parsed.values.get("from") === undefined ? {} : { from: parsed.values.get("from")! }),
    ...(parsed.values.get("to") === undefined ? {} : { to: parsed.values.get("to")! }),
    ...(Object.keys(set).length === 0 ? {} : { set }),
    ...(clear.length === 0 ? {} : { clear }),
    ...(addTags.length === 0 ? {} : { addTags }),
    ...(removeTags.length === 0 ? {} : { removeTags }),
    ...(requirements.length === 0 ? {} : { upsertRequirements: requirements }),
    ...(removeRequirements.length === 0 ? {} : { removeRequirements }),
  };
}

function milestoneMutationFromOptions(action: string, parsed: ParsedOptions): Mutation {
  if (parsed.positionals.length !== 2) {
    throw new UsageError(`milestone ${action} requires <file> <id>`);
  }
  const id = parsed.positionals[1]!;
  if (action === "remove") return { kind: "milestone.remove", id };
  const state = enumOption<MilestoneMutationState>(
    parsed.values.get("state"),
    "state",
    new Set(["planned", "reached"]),
  );
  if (action === "add") {
    return {
      kind: "milestone.add",
      id,
      milestone: {
        title: requiredOption(parsed, "title"),
        ...(parsed.values.get("description") === undefined
          ? {}
          : { description: parsed.values.get("description")! }),
        ...(state === undefined ? {} : { state }),
        ...((parsed.repeatedValues.get("tag") ?? []).length === 0
          ? {}
          : { tags: parsed.repeatedValues.get("tag")! }),
      },
    };
  }
  const clear = enumRepeated<MilestoneClearableField>(
    parsed,
    "clear",
    new Set(["description", "state", "tags"]),
  );
  const addTags = uniqueRepeated(parsed, "add-tag");
  const removeTags = uniqueRepeated(parsed, "remove-tag");
  ensureDisjoint(addTags, "add-tag", removeTags, "remove-tag");
  if (
    clear.some((field) =>
      (field === "description" && parsed.values.has("description")) ||
      (field === "state" && state !== undefined) ||
      (field === "tags" && (addTags.length > 0 || removeTags.length > 0)))
  ) {
    throw new UsageError("--clear conflicts with another milestone field option");
  }
  const set = {
    ...(parsed.values.get("title") === undefined
      ? {}
      : { title: parsed.values.get("title")! }),
    ...(parsed.values.get("description") === undefined
      ? {}
      : { description: parsed.values.get("description")! }),
    ...(state === undefined ? {} : { state }),
  };
  return {
    kind: "milestone.set",
    id,
    ...(Object.keys(set).length === 0 ? {} : { set }),
    ...(clear.length === 0 ? {} : { clear }),
    ...(addTags.length === 0 ? {} : { addTags }),
    ...(removeTags.length === 0 ? {} : { removeTags }),
  };
}

function resourceMutationFromOptions(action: string, parsed: ParsedOptions): Mutation {
  if (parsed.positionals.length !== 2) {
    throw new UsageError(`resource ${action} requires <file> <id>`);
  }
  const id = parsed.positionals[1]!;
  if (action === "remove") return { kind: "resource.remove", id };
  const capacity = optionalInteger(parsed, "capacity", 1, 2_147_483_647);
  if (action === "add") {
    if (capacity === undefined) throw new UsageError("option --capacity is required");
    return {
      kind: "resource.add",
      id,
      resource: {
        title: requiredOption(parsed, "title"),
        capacity,
        ...(parsed.values.get("description") === undefined
          ? {}
          : { description: parsed.values.get("description")! }),
      },
    };
  }
  const clear = enumRepeated<ResourceClearableField>(
    parsed,
    "clear",
    new Set(["description"]),
  );
  if (clear.length > 0 && parsed.values.has("description")) {
    throw new UsageError("--clear description conflicts with --description");
  }
  const set = {
    ...(parsed.values.get("title") === undefined
      ? {}
      : { title: parsed.values.get("title")! }),
    ...(parsed.values.get("description") === undefined
      ? {}
      : { description: parsed.values.get("description")! }),
    ...(capacity === undefined ? {} : { capacity }),
  };
  return {
    kind: "resource.set",
    id,
    ...(Object.keys(set).length === 0 ? {} : { set }),
    ...(clear.length === 0 ? {} : { clear }),
  };
}

function previewResultJson(
  result: MutationResult | FormatPreviewResult,
  exposeCandidate: boolean,
  writeRequest: EditingWriteRequest = { mode: "preview", target: null },
  writeResult: DocumentWriteResult | null = null,
): Readonly<Record<string, unknown>> {
  return {
    changed: exposeCandidate ? result.changed : false,
    original_digest: result.originalDigest,
    updated_digest: exposeCandidate ? result.updatedDigest : null,
    updated_text: exposeCandidate ? result.updatedText : null,
    diff: exposeCandidate ? result.diff : null,
    edits: (exposeCandidate ? result.edits : []).map((edit) => ({
      start_offset: edit.startOffset,
      end_offset: edit.endOffset,
      replacement: edit.replacement,
    })),
    write: {
      mode: writeRequest.mode,
      target: writeRequest.target,
      written: writeResult?.written ?? false,
    },
  };
}

async function readMutationRequest(source: string): Promise<unknown> {
  const bytes = source === "-" ? await readStdin() : await readFile(source);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new UsageError(
      `mutation request is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function runMutation(
  resource: "task" | "milestone" | "resource" | "mutation",
  action: string,
  args: readonly string[],
): Promise<number> {
  const config = mutationOptionSets(resource, action);
  const parsed = parseOptions(args, config.values, config.flags, config.repeatable);
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const maxDiagnostics = boundedInteger(
    parsed.values.get("max-diagnostics"),
    "max-diagnostics",
    100,
    1,
    1000,
  );
  const operation = `${resource}.${action}`;
  let sourceOperand: string;
  let writeRequest: EditingWriteRequest;
  let mutation: Mutation;

  if (resource === "mutation") {
    if (parsed.positionals.length !== 1) {
      throw new UsageError("mutation apply requires exactly one <file>");
    }
    sourceOperand = parsed.positionals[0]!;
    writeRequest = editingWriteRequest(parsed, sourceOperand);
    const requestSource = requiredOption(parsed, "request");
    if (sourceOperand === "-" && requestSource === "-") {
      throw new UsageError("document and mutation request cannot both use stdin");
    }
    let request: unknown;
    try {
      request = await readMutationRequest(requestSource);
    } catch (error) {
      if (error instanceof UsageError) throw error;
      return cliError(
        error instanceof Error ? error : new Error(String(error)),
        3,
        operation,
        format === "json",
      );
    }
    mutation = request as Mutation;
  } else {
    mutation =
      resource === "task"
        ? taskMutationFromOptions(action, parsed)
        : resource === "milestone"
          ? milestoneMutationFromOptions(action, parsed)
          : resourceMutationFromOptions(action, parsed);
    sourceOperand = parsed.positionals[0]!;
    writeRequest = editingWriteRequest(parsed, sourceOperand);
  }

  const source = sourceOperand === "-" ? "<stdin>" : sourceOperand;
  let input: Awaited<ReturnType<typeof readDocument>>;
  try {
    input = await readDocument(sourceOperand);
  } catch (error) {
    return cliError(
      error instanceof Error ? error : new Error(String(error)),
      3,
      operation,
      format === "json",
    );
  }
  const mutationOptions = {
    maxDiagnostics,
    originalLabel: source,
    updatedLabel: "candidate",
  };
  const result = resource === "mutation"
    ? planBatchMutation(input.text, mutation, mutationOptions)
    : planMutation(input.text, mutation, mutationOptions);
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated ||
      result.diagnostics.some((diagnostic) => diagnostic.severity === "warning"));
  const ok = result.ok && !warningFailure;
  let writeResult: DocumentWriteResult | null = null;
  if (result.ok) {
    try {
      assertExpectedDigest(writeRequest, input.digest);
      if (ok && writeRequest.mode !== "preview") {
        writeResult = await commitCandidate(writeRequest, result.updatedText, input.digest);
      }
    } catch (error) {
      return writeFailureExit(error, operation, format === "json");
    }
  }
  if (format === "json") {
    writeJson({
      schema_version: "Perttool.MutationResult.v1",
      tool_version: TOOL_VERSION,
      operation,
      ok,
      document_id: result.documentId,
      source,
      source_digest: input.digest,
      diagnostics: result.diagnostics.map(jsonDiagnostic),
      diagnostics_truncated: result.diagnosticsTruncated,
      ...previewResultJson(result, result.ok, writeRequest, writeResult),
    });
  } else {
    if (ok) {
      if (writeResult !== null) {
        process.stderr.write(renderWriteSummary(operation, writeResult));
      } else {
        process.stdout.write(
          parsed.flags.has("diff") ? (result.diff ?? "") : (result.updatedText ?? ""),
        );
        if (!parsed.flags.has("diff")) {
          process.stderr.write(
            `PREVIEW ${operation} changed=${result.changed} original_digest=${result.originalDigest} updated_digest=${result.updatedDigest}\n`,
          );
        }
      }
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    if (result.diagnosticsTruncated) {
      process.stderr.write(`DIAGNOSTICS_TRUNCATED true limit=${maxDiagnostics}\n`);
    }
  }
  return ok ? 0 : 1;
}

function advanceResultJson(
  details: AdvanceDetails | null,
): Readonly<Record<string, unknown>> | null {
  return details === null
    ? null
    : {
        removed_task_ids: details.removedTaskIds,
        removed_gate_ids: details.removedGateIds,
        removed_milestone_ids: details.removedMilestoneIds,
        frontier_before: details.frontierBefore,
        frontier_after: details.frontierAfter,
        ready_before: details.readyBefore,
        ready_after: details.readyAfter,
      };
}

function renderAdvanceSummary(details: AdvanceDetails): string {
  const list = (ids: readonly string[]): string => ids.join(",") || "-";
  return [
    `ADVANCE removed_tasks=${list(details.removedTaskIds)} removed_gates=${list(details.removedGateIds)} removed_milestones=${list(details.removedMilestoneIds)}`,
    `ADVANCE frontier_before=${list(details.frontierBefore)} frontier_after=${list(details.frontierAfter)} ready_before=${list(details.readyBefore)} ready_after=${list(details.readyAfter)}`,
    "",
  ].join("\n");
}

async function runAdvance(args: readonly string[]): Promise<number> {
  const parsed = parseOptions(
    args,
    new Set(["format", "color", "max-diagnostics", "out", "expect-digest"]),
    new Set(["diff", "write", "warnings-as-errors"]),
  );
  if (parsed.positionals.length !== 1) {
    throw new UsageError("dag advance requires exactly one <file>");
  }
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const maxDiagnostics = boundedInteger(
    parsed.values.get("max-diagnostics"),
    "max-diagnostics",
    100,
    1,
    1000,
  );
  const sourceOperand = parsed.positionals[0]!;
  const writeRequest = editingWriteRequest(parsed, sourceOperand);
  const source = sourceOperand === "-" ? "<stdin>" : sourceOperand;
  let input: Awaited<ReturnType<typeof readDocument>>;
  try {
    input = await readDocument(sourceOperand);
  } catch (error) {
    return cliError(
      error instanceof Error ? error : new Error(String(error)),
      3,
      "dag.advance",
      format === "json",
    );
  }
  const result = planAdvance(input.text, {
    maxDiagnostics,
    originalLabel: source,
    updatedLabel: "candidate",
  });
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated ||
      result.diagnostics.some((diagnostic) => diagnostic.severity === "warning"));
  const ok = result.ok && !warningFailure;
  let writeResult: DocumentWriteResult | null = null;
  if (result.ok) {
    try {
      assertExpectedDigest(writeRequest, input.digest);
      if (ok && writeRequest.mode !== "preview") {
        writeResult = await commitCandidate(writeRequest, result.updatedText, input.digest);
      }
    } catch (error) {
      return writeFailureExit(error, "dag.advance", format === "json");
    }
  }
  if (format === "json") {
    writeJson({
      schema_version: "Perttool.MutationResult.v1",
      tool_version: TOOL_VERSION,
      operation: "dag.advance",
      ok,
      document_id: result.documentId,
      source,
      source_digest: input.digest,
      diagnostics: result.diagnostics.map(jsonDiagnostic),
      diagnostics_truncated: result.diagnosticsTruncated,
      ...previewResultJson(result, result.ok, writeRequest, writeResult),
      advance: advanceResultJson(result.advance),
    });
  } else {
    if (ok && result.advance !== null) {
      if (writeResult !== null) {
        process.stderr.write(renderWriteSummary("dag.advance", writeResult));
      } else {
        process.stdout.write(
          parsed.flags.has("diff") ? (result.diff ?? "") : (result.updatedText ?? ""),
        );
        if (!parsed.flags.has("diff")) {
          process.stderr.write(
            `PREVIEW dag.advance changed=${result.changed} original_digest=${result.originalDigest} updated_digest=${result.updatedDigest}\n`,
          );
        }
      }
      process.stderr.write(renderAdvanceSummary(result.advance));
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    if (result.diagnosticsTruncated) {
      process.stderr.write(`DIAGNOSTICS_TRUNCATED true limit=${maxDiagnostics}\n`);
    }
  }
  return ok ? 0 : 1;
}

type RationalUnit =
  | DurationUnit
  | "day^2"
  | "hour^2"
  | "point^2"
  | "ratio";

function rationalJson(
  value: Rational,
  unit: RationalUnit,
  precision: number,
): Readonly<Record<string, string>> {
  return {
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
    unit,
    display: formatDecimal(value, precision),
  };
}

function precedenceJson(
  result: NonNullable<ReturnType<typeof analyzeDocument>["precedence"]>,
  unit: DurationUnit,
  precision: number,
): Readonly<Record<string, unknown>> {
  const varianceUnit = `${unit}^2` as "day^2" | "hour^2" | "point^2";
  const path = (value: typeof result.critical.representativePath) => ({
    edge_ids: value.edgeIds,
    task_ids: value.taskIds,
    gate_ids: value.gateIds,
    variance: rationalJson(value.variance, varianceUnit, precision),
  });
  return {
    makespan: rationalJson(result.makespan, unit, precision),
    conditional_on_blocks_resolved: result.conditionalOnBlocksResolved,
    blocked_task_ids: result.blockedTaskIds,
    milestones: result.milestones.map((milestone) => ({
      id: milestone.id,
      earliest: rationalJson(milestone.earliest, unit, precision),
      latest: rationalJson(milestone.latest, unit, precision),
      slack: rationalJson(milestone.slack, unit, precision),
    })),
    edges: result.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
      status: edge.status,
      expected: rationalJson(edge.expected, unit, precision),
      variance: rationalJson(edge.variance, varianceUnit, precision),
      es: rationalJson(edge.es, unit, precision),
      ef: rationalJson(edge.ef, unit, precision),
      ls: rationalJson(edge.ls, unit, precision),
      lf: rationalJson(edge.lf, unit, precision),
      total_float: rationalJson(edge.totalFloat, unit, precision),
      free_float: rationalJson(edge.freeFloat, unit, precision),
      is_critical: edge.isCritical,
      is_driving: edge.isDriving,
    })),
    critical: {
      milestone_ids: result.critical.milestoneIds,
      task_ids: result.critical.taskIds,
      gate_ids: result.critical.gateIds,
      driving_edge_ids: result.critical.drivingEdgeIds,
      representative_path: path(result.critical.representativePath),
      path_count: result.critical.pathCount.toString(),
      paths: result.critical.paths.map(path),
      paths_truncated: result.critical.pathsTruncated,
    },
  };
}

function resourceJson(
  result: NonNullable<ReturnType<typeof analyzeDocument>["resource"]>,
  unit: DurationUnit,
  precision: number,
): Readonly<Record<string, unknown>> {
  const varianceUnit = `${unit}^2` as "day^2" | "hour^2" | "point^2";
  const schedulePath = (path: typeof result.scheduleCritical.representativePath) => ({
    task_ids: path.taskIds,
    constraints: path.constraints.map((constraint) => ({
      from_task_id: constraint.fromTaskId,
      to_task_id: constraint.toTaskId,
      kind: constraint.kind,
      resource_arc_id: constraint.resourceArcId,
    })),
    connector_ids: path.connectorIds,
  });
  return {
    algorithm: result.algorithm,
    conditional_on_blocks_resolved: result.conditionalOnBlocksResolved,
    blocked_task_ids: result.blockedTaskIds,
    capacities: result.capacities.map((capacity) => ({
      id: capacity.id,
      declared: capacity.declared,
      override: capacity.override,
      effective: capacity.effective,
    })),
    precedence_lower_bound: rationalJson(result.precedenceLowerBound, unit, precision),
    makespan: rationalJson(result.makespan, unit, precision),
    resource_delay: rationalJson(result.resourceDelay, unit, precision),
    tasks: result.tasks.map((task) => ({
      id: task.id,
      status: task.status,
      expected: rationalJson(task.expected, unit, precision),
      variance: rationalJson(task.variance, varianceUnit, precision),
      eligible_time: rationalJson(task.eligibleTime, unit, precision),
      start: rationalJson(task.start, unit, precision),
      finish: rationalJson(task.finish, unit, precision),
      resource_wait: rationalJson(task.resourceWait, unit, precision),
      requirements: task.requirements.map((requirement) => ({
        resource_id: requirement.resourceId,
        units: requirement.units,
      })),
      priority_key: {
        priority: task.priorityKey.priority,
        precedence_total_float: rationalJson(task.priorityKey.precedenceTotalFloat, unit, precision),
        expected: rationalJson(task.priorityKey.expected, unit, precision),
        task_id: task.priorityKey.taskId,
      },
      conditional_blocked: task.conditionalBlocked,
    })),
    resources: result.resources.map((resource) => ({
      id: resource.id,
      capacity: resource.capacity,
      amount_time: rationalJson(resource.amountTime, unit, precision),
      utilization: rationalJson(resource.utilization, "ratio", precision),
      peak_usage: resource.peakUsage,
      last_release: rationalJson(resource.lastRelease, unit, precision),
      timeline: resource.timeline.map((entry) => ({
        task_id: entry.taskId,
        start: rationalJson(entry.start, unit, precision),
        finish: rationalJson(entry.finish, unit, precision),
        units: entry.units,
      })),
    })),
    resource_arcs: result.resourceArcs.map((arc) => ({
      id: arc.id,
      from_task_id: arc.fromTaskId,
      to_task_id: arc.toTaskId,
      at_time: rationalJson(arc.atTime, unit, precision),
      wait_from: rationalJson(arc.waitFrom, unit, precision),
      resources: [...arc.resources]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([resourceId, contributedUnits]) => ({
          resource_id: resourceId,
          contributed_units: contributedUnits,
        })),
      schedule_float: rationalJson(arc.scheduleFloat, unit, precision),
      is_critical: arc.isCritical,
      is_driving: arc.isDriving,
    })),
    constraint_graph_replay: result.constraintGraphReplay,
    schedule_critical: {
      task_ids: result.scheduleCritical.taskIds,
      resource_arc_ids: result.scheduleCritical.resourceArcIds,
      driving_constraint_ids: result.scheduleCritical.drivingConstraintIds,
      representative_path: schedulePath(result.scheduleCritical.representativePath),
      path_count: result.scheduleCritical.pathCount.toString(),
      paths: result.scheduleCritical.paths.map(schedulePath),
      paths_truncated: result.scheduleCritical.pathsTruncated,
    },
  };
}

function durationText(value: Rational, unit: DurationUnit, precision: number): string {
  return `${formatDecimal(value, precision)}${durationSuffix(unit)}`;
}

function velocityJson(
  velocity: Velocity | null,
  precision: number,
): Readonly<Record<string, unknown>> | null {
  if (velocity === null) return null;
  return {
    points: rationalJson(velocity.points, "point", precision),
    period: rationalJson(velocity.period, velocity.periodUnit, precision),
  };
}

function velocityText(velocity: Velocity, precision: number): string {
  return `${durationText(velocity.points, "point", precision)}/${durationText(velocity.period, velocity.periodUnit, precision)}`;
}

function analysisVelocityForecastJson(
  result: ReturnType<typeof analyzeDocument>,
): Readonly<Record<string, unknown>> | null {
  const forecast = result.velocityForecast;
  if (forecast === null) return null;
  return {
    qualifier: forecast.qualifier,
    source_unit: forecast.sourceUnit,
    target_unit: forecast.targetUnit,
    precedence_makespan:
      result.precedence === null
        ? null
        : rationalJson(
            convertWithVelocity(result.precedence.makespan, forecast),
            forecast.targetUnit,
            result.precision,
          ),
    resource_makespan:
      result.resource === null
        ? null
        : rationalJson(
            convertWithVelocity(result.resource.makespan, forecast),
            forecast.targetUnit,
            result.precision,
          ),
  };
}

function renderAnalysisText(
  result: ReturnType<typeof analyzeDocument>,
): string {
  const unit = result.durationUnit!;
  const lines = [`PERTTOOL ANALYSIS ${result.documentId ?? "-"}`, "", "QUALIFIERS"];
  const conditional =
    result.precedence?.conditionalOnBlocksResolved === true ||
    result.resource?.conditionalOnBlocksResolved === true;
  const blockedTaskIds =
    result.precedence?.blockedTaskIds ?? result.resource?.blockedTaskIds ?? [];
  const pathsTruncated =
    result.precedence?.critical.pathsTruncated === true ||
    result.resource?.scheduleCritical.pathsTruncated === true;
  const overrides = [...result.capacityOverrides]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  lines.push(
    `CONDITIONAL_ON_BLOCKS_RESOLVED ${conditional}`,
    `BLOCKED_TASKS ${blockedTaskIds.join(", ") || "-"}`,
    `PATHS_TRUNCATED ${pathsTruncated}`,
    `CAPACITY_OVERRIDES ${overrides.map(([id, capacity]) => `${id}=${capacity}`).join(", ") || "-"}`,
    `VELOCITY ${result.velocity === null ? "-" : velocityText(result.velocity, result.precision)}`,
    `VELOCITY_FORECAST_UNIT ${result.velocityForecast?.targetUnit ?? "-"}`,
  );
  if (result.precedence !== null) {
    const precedence = result.precedence;
    lines.push(
      "",
      "PRECEDENCE",
      `MAKESPAN ${durationText(precedence.makespan, unit, result.precision)}`,
      ...(result.velocityForecast === null
        ? []
        : [
            `VELOCITY FORECAST ${durationText(
              convertWithVelocity(precedence.makespan, result.velocityForecast),
              result.velocityForecast.targetUnit,
              result.precision,
            )}`,
          ]),
      "EDGES",
      "ID EXPECTED ES EF LS LF TF FF CRITICAL",
    );
    for (const edge of precedence.edges) {
      lines.push(
        [
          edge.id,
          durationText(edge.expected, unit, result.precision),
          durationText(edge.es, unit, result.precision),
          durationText(edge.ef, unit, result.precision),
          durationText(edge.ls, unit, result.precision),
          durationText(edge.lf, unit, result.precision),
          durationText(edge.totalFloat, unit, result.precision),
          durationText(edge.freeFloat, unit, result.precision),
          edge.isCritical ? "yes" : "no",
        ].join(" "),
      );
    }
    lines.push(
      "",
      "PRECEDENCE CRITICAL",
      `TASKS ${precedence.critical.taskIds.join(", ") || "-"}`,
      `GATES ${precedence.critical.gateIds.join(", ") || "-"}`,
      `REPRESENTATIVE PATH ${precedence.critical.representativePath.edgeIds.join(" -> ") || "(complete)"}`,
      `PATH COUNT ${precedence.critical.pathCount.toString()}${precedence.critical.pathsTruncated ? " (truncated)" : ""}`,
    );
  }
  if (result.resource !== null) {
    const resource = result.resource;
    lines.push(
      "",
      "RESOURCE SCHEDULE",
      `ALGORITHM ${resource.algorithm.id}@${resource.algorithm.version} optimal=${resource.algorithm.optimal}`,
      `PRECEDENCE LOWER BOUND ${durationText(resource.precedenceLowerBound, unit, result.precision)}`,
      `MAKESPAN ${durationText(resource.makespan, unit, result.precision)}`,
      ...(result.velocityForecast === null
        ? []
        : [
            `VELOCITY FORECAST ${durationText(
              convertWithVelocity(resource.makespan, result.velocityForecast),
              result.velocityForecast.targetUnit,
              result.precision,
            )}`,
          ]),
      `DELAY ${durationText(resource.resourceDelay, unit, result.precision)}`,
      "TASKS",
      "ID ELIGIBLE START FINISH WAIT REQUIREMENTS",
    );
    for (const task of resource.tasks) {
      lines.push(
        [
          task.id,
          durationText(task.eligibleTime, unit, result.precision),
          durationText(task.start, unit, result.precision),
          durationText(task.finish, unit, result.precision),
          durationText(task.resourceWait, unit, result.precision),
          task.requirements.map((requirement) => `${requirement.resourceId}=${requirement.units}`).join(",") || "-",
        ].join(" "),
      );
    }
    lines.push("RESOURCE ARCS");
    for (const arc of resource.resourceArcs) {
      lines.push(
        `${arc.id} at=${durationText(arc.atTime, unit, result.precision)} resources=${[...arc.resources].map(([id, units]) => `${id}=${units}`).join(",")}`,
      );
    }
    if (resource.resourceArcs.length === 0) lines.push("-");
    lines.push(
      "",
      "RESOURCE CRITICAL",
      `TASKS ${resource.scheduleCritical.taskIds.join(", ") || "-"}`,
      `RESOURCE ARCS ${resource.scheduleCritical.resourceArcIds.join(", ") || "-"}`,
      `REPRESENTATIVE PATH ${resource.scheduleCritical.representativePath.taskIds.join(" -> ") || "(complete)"}`,
      `PATH COUNT ${resource.scheduleCritical.pathCount.toString()}${resource.scheduleCritical.pathsTruncated ? " (truncated)" : ""}`,
      "",
      "RESOURCE UTILIZATION",
      "ID CAPACITY AMOUNT_TIME UTILIZATION PEAK LAST_RELEASE",
    );
    for (const statistic of resource.resources) {
      lines.push(
        [
          statistic.id,
          statistic.capacity.toString(),
          durationText(statistic.amountTime, unit, result.precision),
          formatDecimal(statistic.utilization, result.precision),
          statistic.peakUsage.toString(),
          durationText(statistic.lastRelease, unit, result.precision),
        ].join(" "),
      );
    }
    if (resource.resources.length === 0) lines.push("-");
  }
  return `${lines.join("\n")}\n`;
}

async function runAnalyze(args: readonly string[]): Promise<number> {
  const parsed = parseOptions(
    args,
    new Set([
      "schedule",
      "max-paths",
      "precision",
      "max-diagnostics",
      "format",
      "color",
    ]),
    new Set(["warnings-as-errors"]),
    new Set(["capacity"]),
  );
  if (parsed.positionals.length !== 1) {
    throw new UsageError("dag analyze requires exactly one <file>");
  }
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const mode = analysisMode(parsed.values.get("schedule"));
  const maxPaths = boundedInteger(parsed.values.get("max-paths"), "max-paths", 1, 0, 1000);
  const precision = boundedInteger(parsed.values.get("precision"), "precision", 3, 0, 9);
  const maxDiagnostics = boundedInteger(
    parsed.values.get("max-diagnostics"),
    "max-diagnostics",
    100,
    1,
    1000,
  );
  const overrides = capacityOverrides(parsed.repeatedValues.get("capacity") ?? []);
  const sourceOperand = parsed.positionals[0]!;
  const source = sourceOperand === "-" ? "<stdin>" : sourceOperand;
  let input: Awaited<ReturnType<typeof readDocument>>;
  try {
    input = await readDocument(sourceOperand);
  } catch (error) {
    return cliError(
      error instanceof Error ? error : new Error(String(error)),
      3,
      "dag.analyze",
      format === "json",
    );
  }
  const result = analyzeDocument(input.text, {
    mode,
    capacityOverrides: overrides,
    maxPaths,
    precision,
    maxDiagnostics,
  });
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated ||
      result.diagnostics.some((diagnostic) => diagnostic.severity === "warning"));
  const ok = result.ok && !warningFailure;
  if (format === "json") {
    writeJson({
      schema_version: "Perttool.AnalysisResult.v2",
      tool_version: TOOL_VERSION,
      operation: "dag.analyze",
      ok,
      document_id: result.documentId,
      source,
      source_digest: input.digest,
      diagnostics: result.diagnostics.map(jsonDiagnostic),
      diagnostics_truncated: result.diagnosticsTruncated,
      mode: result.mode,
      precision: result.precision,
      ...(result.durationUnit === null
        ? {}
        : {
            duration_unit: result.durationUnit,
            critical_epsilon: rationalJson(
              result.criticalEpsilon!,
              result.durationUnit,
              result.precision,
            ),
            velocity: velocityJson(result.velocity, result.precision),
            velocity_forecast: analysisVelocityForecastJson(result),
          }),
      precedence:
        result.precedence === null || result.durationUnit === null
          ? null
          : precedenceJson(result.precedence, result.durationUnit, result.precision),
      resource:
        result.resource === null || result.durationUnit === null
          ? null
          : resourceJson(result.resource, result.durationUnit, result.precision),
    });
  } else {
    if (ok) process.stdout.write(renderAnalysisText(result));
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    if (result.diagnosticsTruncated) {
      process.stderr.write(`DIAGNOSTICS_TRUNCATED true limit=${maxDiagnostics}\n`);
    }
  }
  return ok ? 0 : 1;
}

function conversionLossJson(loss: ConversionLoss): Readonly<Record<string, unknown>> {
  return {
    code: loss.code,
    severity: loss.severity,
    message: loss.message,
    element_id: loss.elementId,
    span: loss.span === null ? null : jsonSpan(loss.span),
    lossy: loss.lossy,
  };
}

function renderConversionLoss(
  loss: ConversionLoss,
  source: string,
  color: ColorMode,
): string {
  return renderDiagnostic(
    {
      code: loss.code,
      severity: loss.severity,
      message: loss.message,
      ...(loss.elementId === null ? {} : { entityId: loss.elementId }),
      ...(loss.span === null ? {} : { span: loss.span }),
      helpTopic: "mermaid",
    },
    source,
    color,
  );
}

async function runRender(args: readonly string[]): Promise<number> {
  const parsed = parseOptions(
    args,
    new Set([
      "to",
      "profile",
      "analysis",
      "out",
      "max-diagnostics",
      "format",
      "color",
    ]),
    new Set(["strict-loss", "warnings-as-errors"]),
    new Set(["capacity"]),
  );
  if (parsed.positionals.length !== 1) {
    throw new UsageError("dag render requires exactly one <file>");
  }
  enumOption(requiredOption(parsed, "to"), "to", new Set(["mermaid"]));
  const profile = enumOption<MermaidProfile>(
    parsed.values.get("profile"),
    "profile",
    new Set(["perttool", "plain"]),
  ) ?? "perttool";
  const analysis = enumOption<MermaidAnalysisMode>(
    parsed.values.get("analysis"),
    "analysis",
    new Set(["none", "precedence", "resource", "both"]),
  ) ?? "none";
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const maxDiagnostics = boundedInteger(
    parsed.values.get("max-diagnostics"),
    "max-diagnostics",
    100,
    1,
    1000,
  );
  const overrides = capacityOverrides(parsed.repeatedValues.get("capacity") ?? []);
  if (overrides.size > 0 && analysis !== "resource" && analysis !== "both") {
    throw new UsageError("--capacity requires --analysis resource or both");
  }
  const sourceOperand = parsed.positionals[0]!;
  const source = sourceOperand === "-" ? "<stdin>" : sourceOperand;
  const out = parsed.values.get("out") ?? null;
  if (out !== null && out.length === 0) {
    throw new UsageError("--out path must not be empty");
  }
  let input: Awaited<ReturnType<typeof readDocument>>;
  try {
    input = await readDocument(sourceOperand);
  } catch (error) {
    return cliError(
      error instanceof Error ? error : new Error(String(error)),
      3,
      "dag.render",
      format === "json",
    );
  }
  const result = exportMermaid(input.text, {
    profile,
    analysis,
    capacityOverrides: overrides,
    maxDiagnostics,
  });
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated ||
      result.diagnostics.some((diagnostic) => diagnostic.severity === "warning"));
  const strictFailure =
    parsed.flags.has("strict-loss") &&
    result.lossReport.records.some((record) => record.lossy);
  const ok = result.ok && !warningFailure && !strictFailure;
  const exposeArtifact = result.ok && !strictFailure;
  let writeResult: DocumentWriteResult | null = null;
  if (ok && out !== null) {
    try {
      writeResult = await createArtifactFile(out, result.artifact!);
    } catch (error) {
      return writeFailureExit(error, "dag.render", format === "json");
    }
  }
  if (format === "json") {
    writeJson({
      schema_version: "Perttool.ExportResult.v1",
      tool_version: TOOL_VERSION,
      operation: "dag.render",
      ok,
      document_id: result.documentId,
      source,
      source_digest: input.digest,
      diagnostics: result.diagnostics.map(jsonDiagnostic),
      diagnostics_truncated: result.diagnosticsTruncated,
      artifact_format: "mermaid",
      profile: result.profile,
      analysis: result.analysis,
      capacity_overrides: [...result.capacityOverrides]
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([resourceId, capacity]) => ({ resource_id: resourceId, capacity })),
      artifact: exposeArtifact ? result.artifact : null,
      artifact_digest: exposeArtifact ? result.artifactDigest : null,
      loss_report: {
        lossless: result.lossReport.lossless,
        records: result.lossReport.records.map(conversionLossJson),
      },
      generated_ids: [],
      write: {
        mode: out === null ? "preview" : "out",
        target: out,
        written: writeResult?.written ?? false,
      },
    });
  } else {
    if (ok) {
      if (writeResult === null) {
        process.stdout.write(result.artifact!);
      } else {
        process.stderr.write(renderWriteSummary("dag.render", writeResult));
      }
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    for (const loss of result.lossReport.records) {
      process.stderr.write(`${renderConversionLoss(loss, source, color)}\n`);
    }
    if (result.diagnosticsTruncated) {
      process.stderr.write(`DIAGNOSTICS_TRUNCATED true limit=${maxDiagnostics}\n`);
    }
  }
  return strictFailure ? 4 : ok ? 0 : 1;
}

function explanationJson(
  node: ReturnType<typeof selectNextTasks>["tasks"][number]["explanation"][number],
): Readonly<Record<string, unknown>> {
  return {
    milestone_id: node.milestoneId,
    reached: node.reached,
    unsatisfied_edges: node.unsatisfiedEdges.map((edge) => ({
      edge_id: edge.edgeId,
      kind: edge.kind,
      status: edge.status,
      source_milestone_id: edge.sourceMilestoneId,
      source_reached: edge.sourceReached,
    })),
    children: node.children.map(explanationJson),
    truncated: node.truncated,
  };
}

function nextJson(
  result: ReturnType<typeof selectNextTasks>,
): Readonly<Record<string, unknown>> {
  const unit = result.durationUnit!;
  return {
    precision: result.precision,
    duration_unit: unit,
    velocity: velocityJson(result.velocity, result.precision),
    velocity_forecast:
      result.velocityForecast === null
        ? null
        : {
            qualifier: result.velocityForecast.qualifier,
            source_unit: result.velocityForecast.sourceUnit,
            target_unit: result.velocityForecast.targetUnit,
          },
    capacity_overrides: [...result.capacityOverrides]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([resourceId, capacity]) => ({ resource_id: resourceId, capacity })),
    groups: {
      active: result.groups.active,
      ready: result.groups.ready,
      runnable_now: result.groups.runnableNow,
      blocked_now: result.groups.blockedNow,
      upcoming: result.groups.upcoming,
    },
    tasks: result.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      classification: task.classification,
      runnable_now: task.runnableNow,
      priority: task.priority,
      owner: task.owner,
      blocked_reason: task.blockedReason,
      expected: rationalJson(task.expected, unit, result.precision),
      total_float: rationalJson(task.totalFloat, unit, result.precision),
      earliest_start: rationalJson(task.earliestStart, unit, result.precision),
      forecast_expected:
        task.forecastExpected === null || result.velocityForecast === null
          ? null
          : rationalJson(
              task.forecastExpected,
              result.velocityForecast.targetUnit,
              result.precision,
            ),
      forecast_total_float:
        task.forecastTotalFloat === null || result.velocityForecast === null
          ? null
          : rationalJson(
              task.forecastTotalFloat,
              result.velocityForecast.targetUnit,
              result.precision,
            ),
      forecast_earliest_start:
        task.forecastEarliestStart === null || result.velocityForecast === null
          ? null
          : rationalJson(
              task.forecastEarliestStart,
              result.velocityForecast.targetUnit,
              result.precision,
            ),
      precedence_critical: task.precedenceCritical,
      schedule_critical: task.scheduleCritical,
      requirements: task.requirements.map((requirement) => ({
        resource_id: requirement.resourceId,
        units: requirement.units,
      })),
      resource_rejections: task.resourceRejections.map((rejection) => ({
        resource_id: rejection.resourceId,
        capacity: rejection.capacity,
        active_usage: rejection.activeUsage,
        earlier_selected_usage: rejection.earlierSelectedUsage,
        used_before_decision: rejection.usedBeforeDecision,
        required: rejection.required,
        available: rejection.available,
        deficit: rejection.deficit,
        active_task_ids: rejection.activeTaskIds,
        earlier_selected_task_ids: rejection.earlierSelectedTaskIds,
      })),
      explanation: task.explanation.map(explanationJson),
    })),
  };
}

function renderNextTask(
  task: ReturnType<typeof selectNextTasks>["tasks"][number],
  unit: DurationUnit,
  precision: number,
  forecastUnit: DurationUnit | null,
): string {
  const resources = task.requirements
    .map((requirement) => `${requirement.resourceId}=${requirement.units}`)
    .join(",");
  return [
    task.id,
    `priority=${task.priority}`,
    `expected=${durationText(task.expected, unit, precision)}`,
    ...(task.forecastExpected === null || forecastUnit === null
      ? []
      : [`forecast=${durationText(task.forecastExpected, forecastUnit, precision)}`]),
    `TF=${durationText(task.totalFloat, unit, precision)}`,
    `precedence_critical=${task.precedenceCritical}`,
    `schedule_critical=${task.scheduleCritical}`,
    `owner=${task.owner ?? "-"}`,
    `resources=${resources || "-"}`,
  ].join(" ");
}

function renderExplanation(
  node: ReturnType<typeof selectNextTasks>["tasks"][number]["explanation"][number],
  indent: string,
): readonly string[] {
  const edges = node.unsatisfiedEdges.map((edge) => edge.edgeId).join(",") || "-";
  const lines = [
    `${indent}waiting milestone=${node.milestoneId} unsatisfied=${edges} truncated=${node.truncated}`,
  ];
  for (const child of node.children) lines.push(...renderExplanation(child, `${indent}  `));
  return lines;
}

function renderNextText(result: ReturnType<typeof selectNextTasks>): string {
  const unit = result.durationUnit!;
  const taskById = new Map(result.tasks.map((task) => [task.id, task]));
  const lines = [
    `PERTTOOL NEXT ${result.documentId ?? "-"}`,
    `VELOCITY ${result.velocity === null ? "-" : velocityText(result.velocity, result.precision)}`,
    `VELOCITY_FORECAST_UNIT ${result.velocityForecast?.targetUnit ?? "-"}`,
  ];
  const section = (title: string, ids: readonly string[], details: "none" | "rejection" | "blocked" | "explanation" = "none"): void => {
    lines.push("", title);
    if (ids.length === 0) {
      lines.push("-");
      return;
    }
    for (const id of ids) {
      const task = taskById.get(id)!;
      lines.push(
        renderNextTask(
          task,
          unit,
          result.precision,
          result.velocityForecast?.targetUnit ?? null,
        ),
      );
      if (details === "rejection") {
        for (const rejection of task.resourceRejections) {
          const occupants = [
            ...rejection.activeTaskIds,
            ...rejection.earlierSelectedTaskIds,
          ].join(",") || "-";
          lines.push(
            `  ${rejection.resourceId} capacity=${rejection.capacity} used=${rejection.usedBeforeDecision} required=${rejection.required} available=${rejection.available} deficit=${rejection.deficit} occupants=${occupants}`,
          );
        }
      } else if (details === "blocked") {
        lines.push(`  blocked_reason=${task.blockedReason ?? "-"}`);
      } else if (details === "explanation") {
        for (const explanation of task.explanation) {
          lines.push(...renderExplanation(explanation, "  "));
        }
      }
    }
  };
  section("ACTIVE", result.groups.active);
  section("RUNNABLE NOW", result.groups.runnableNow);
  section(
    "READY / WAITING RESOURCE",
    result.groups.ready.filter((id) => !result.groups.runnableNow.includes(id)),
    "rejection",
  );
  section("BLOCKED NOW", result.groups.blockedNow, "blocked");
  section("UPCOMING", result.groups.upcoming, "explanation");
  return `${lines.join("\n")}\n`;
}

async function runNext(args: readonly string[]): Promise<number> {
  const parsed = parseOptions(
    args,
    new Set(["explain-depth", "precision", "max-diagnostics", "format", "color"]),
    new Set(["warnings-as-errors"]),
    new Set(["capacity"]),
  );
  if (parsed.positionals.length !== 1) {
    throw new UsageError("dag next requires exactly one <file>");
  }
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const explainDepth = boundedInteger(
    parsed.values.get("explain-depth"),
    "explain-depth",
    1,
    0,
    32,
  );
  const precision = boundedInteger(parsed.values.get("precision"), "precision", 3, 0, 9);
  const maxDiagnostics = boundedInteger(
    parsed.values.get("max-diagnostics"),
    "max-diagnostics",
    100,
    1,
    1000,
  );
  const overrides = capacityOverrides(parsed.repeatedValues.get("capacity") ?? []);
  const sourceOperand = parsed.positionals[0]!;
  const source = sourceOperand === "-" ? "<stdin>" : sourceOperand;
  let input: Awaited<ReturnType<typeof readDocument>>;
  try {
    input = await readDocument(sourceOperand);
  } catch (error) {
    return cliError(
      error instanceof Error ? error : new Error(String(error)),
      3,
      "dag.next",
      format === "json",
    );
  }
  const result = selectNextTasks(input.text, {
    capacityOverrides: overrides,
    explainDepth,
    precision,
    maxDiagnostics,
  });
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated ||
      result.diagnostics.some((diagnostic) => diagnostic.severity === "warning"));
  const ok = result.ok && !warningFailure;
  if (format === "json") {
    writeJson({
      schema_version: "Perttool.NextResult.v2",
      tool_version: TOOL_VERSION,
      operation: "dag.next",
      ok,
      document_id: result.documentId,
      source,
      source_digest: input.digest,
      diagnostics: result.diagnostics.map(jsonDiagnostic),
      diagnostics_truncated: result.diagnosticsTruncated,
      ...(result.durationUnit === null ? {} : nextJson(result)),
    });
  } else {
    if (ok) process.stdout.write(renderNextText(result));
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    if (result.diagnosticsTruncated) {
      process.stderr.write(`DIAGNOSTICS_TRUNCATED true limit=${maxDiagnostics}\n`);
    }
  }
  return ok ? 0 : 1;
}

function renderHelpText(result: ReturnType<typeof getHelp>): string {
  const lines = [result.title, "", result.summary];
  if (result.topics.length > 0) {
    lines.push("", "Topics:");
    for (const topic of result.topics) lines.push(`  ${topic.id.padEnd(12)} ${topic.summary}`);
  }
  for (const section of result.sections) {
    lines.push("", section.title, section.body);
  }
  if (result.syntax.length > 0) lines.push("", "Syntax:", ...result.syntax.map((line) => `  ${line}`));
  if (result.examples.length > 0) {
    lines.push("", "Examples:", ...result.examples.map((example) => `  ${example.id}: ${example.text}`));
  }
  if (result.related.length > 0) lines.push("", `Related: ${result.related.join(", ")}`);
  return `${lines.join("\n")}\n`;
}

function runHelp(args: readonly string[]): number {
  const parsed = parseOptions(
    args,
    new Set(["level", "format", "color"]),
    new Set(),
  );
  if (parsed.positionals.length > 2) {
    throw new UsageError("dsl help accepts at most <topic> <subtopic>");
  }
  const format = outputFormat(parsed.values.get("format"));
  colorMode(parsed.values.get("color"), format);
  const topicId =
    parsed.positionals.length === 0 ? null : parsed.positionals.join(".");
  const level = helpLevel(parsed.values.get("level"), topicId !== null);
  const result = getHelp(topicId, level);
  if (format === "json") {
    writeJson({
      schema_version: "Perttool.HelpResult.v1",
      tool_version: TOOL_VERSION,
      operation: "dsl.help",
      ok: result.ok,
      diagnostics: result.diagnostics.map(jsonDiagnostic),
      topic_id: result.topicId,
      level: result.level,
      title: result.title,
      summary: result.summary,
      sections: result.sections,
      syntax: result.syntax,
      examples: result.examples,
      related: result.related,
      topics: result.topics,
    });
  } else if (result.ok) {
    process.stdout.write(renderHelpText(result));
  } else {
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, "<help>", "never")}\n`);
    }
  }
  return result.ok ? 0 : 1;
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv.length === 1 && argv[0] === "--version") {
    process.stdout.write(`perttool ${TOOL_VERSION}\n`);
    return 0;
  }
  if (argv.length === 1 && argv[0] === "--help") {
    process.stdout.write(`${topLevelHelp()}\n`);
    return 0;
  }
  if (argv.length < 2) throw new UsageError("expected <resource> <action>");
  const resource = argv[0]!;
  const action = argv[1]!;
  const entityActions = new Map<string, ReadonlySet<string>>([
    ["task", new Set(["add", "set", "remove", "finish"])],
    ["milestone", new Set(["add", "set", "remove"])],
    ["resource", new Set(["add", "set", "remove"])],
    ["mutation", new Set(["apply"])],
  ]);
  const isMutationCommand = entityActions.get(resource)?.has(action) === true;
  if (
    argv.length === 3 &&
    argv[2] === "--help" &&
    ((resource === "dsl" && ["check", "format", "help"].includes(action)) ||
      (resource === "dag" && ["analyze", "next", "advance", "render"].includes(action)) ||
      isMutationCommand)
  ) {
    process.stdout.write(`${commandHelp(resource, action)}\n`);
    return 0;
  }
  if (resource === "dag" && action === "analyze") {
    return runAnalyze(argv.slice(2));
  }
  if (resource === "dag" && action === "next") {
    return runNext(argv.slice(2));
  }
  if (resource === "dag" && action === "advance") {
    return runAdvance(argv.slice(2));
  }
  if (resource === "dag" && action === "render") {
    return runRender(argv.slice(2));
  }
  if (resource === "dsl" && action === "format") {
    return runFormat(argv.slice(2));
  }
  if (isMutationCommand) {
    return runMutation(
      resource as "task" | "milestone" | "resource" | "mutation",
      action,
      argv.slice(2),
    );
  }
  if (resource !== "dsl" || (action !== "check" && action !== "help")) {
    throw new UsageError(`unknown or not-yet-implemented command: ${resource} ${action}`);
  }
  return action === "check" ? runCheck(argv.slice(2)) : runHelp(argv.slice(2));
}

const args = process.argv.slice(2);
try {
  process.exitCode = await main(args);
} catch (error) {
  process.exitCode = cliError(
    error instanceof Error ? error : new Error(String(error)),
    error instanceof UsageError ? 2 : 70,
    args.length >= 2 ? `${args[0]}.${args[1]}` : null,
    jsonRequested(args),
  );
}
