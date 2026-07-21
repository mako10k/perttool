#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { TextDecoder } from "node:util";
import { checkDocument } from "./application/check.js";
import type { HelpLevel } from "./help/registry.js";
import { getHelp } from "./help/registry.js";
import type { Diagnostic, SourceSpan } from "./model/diagnostics.js";
import { TOOL_VERSION } from "./version.js";

type OutputFormat = "text" | "json";
type ColorMode = "auto" | "always" | "never";

interface ParsedOptions {
  readonly positionals: readonly string[];
  readonly values: ReadonlyMap<string, string>;
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
    "  perttool dsl help [topic [subtopic]] [--level index|quick|detail] [--format text|json]",
    "",
    "The current bootstrap implements dsl check and dsl help.",
  ].join("\n");
}

function commandHelp(action: string): string {
  if (action === "check") {
    return [
      "Usage: perttool dsl check <file>",
      "  [--warnings-as-errors]",
      "  [--format text|json]",
      "  [--color auto|always|never]",
    ].join("\n");
  }
  return [
    "Usage: perttool dsl help [topic [subtopic]]",
    "  [--level index|quick|detail]",
    "  [--format text|json]",
    "  [--color auto|always|never]",
  ].join("\n");
}

function parseOptions(
  args: readonly string[],
  valueOptions: ReadonlySet<string>,
  flagOptions: ReadonlySet<string>,
): ParsedOptions {
  const positionals: string[] = [];
  const values = new Map<string, string>();
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
    if (!valueOptions.has(name)) throw new UsageError(`unknown option --${name}`);
    if (values.has(name)) throw new UsageError(`duplicate option --${name}`);
    const value = equals === -1 ? args[index + 1] : argument.slice(equals + 1);
    if (value === undefined || value.startsWith("--")) {
      throw new UsageError(`option --${name} requires a value`);
    }
    if (equals === -1) index += 1;
    values.set(name, value);
  }
  return { positionals, values, flags };
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
  const bytes = source === "-" ? await readStdin() : await readFile(source);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const text = decoder.decode(bytes);
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  return { text, digest };
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
  const diagnostic: Diagnostic = {
    code: error instanceof UsageError ? error.code : exitCode === 3 ? "PTCLI-003" : "PTCLI-070",
    severity: "error",
    message: error.message,
    helpTopic: "errors",
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
    new Set(["format", "color"]),
    new Set(["warnings-as-errors"]),
  );
  if (parsed.positionals.length !== 1) {
    throw new UsageError("dsl check requires exactly one <file>");
  }
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const sourceOperand = parsed.positionals[0]!;
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
  const result = checkDocument(input.text);
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
  if (argv.length === 3 && argv[2] === "--help" && resource === "dsl" && ["check", "help"].includes(action)) {
    process.stdout.write(`${commandHelp(action)}\n`);
    return 0;
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
