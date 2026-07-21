#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { TextDecoder } from "node:util";
import type { AnalysisMode } from "./application/analyze.js";
import { analyzeDocument } from "./application/analyze.js";
import { checkDocument } from "./application/check.js";
import { selectNextTasks } from "./application/next.js";
import type { HelpLevel } from "./help/registry.js";
import { getHelp } from "./help/registry.js";
import type { Diagnostic, SourceSpan } from "./model/diagnostics.js";
import type { Rational } from "./model/rational.js";
import { formatDecimal } from "./model/rational.js";
import type { DurationUnit, Velocity } from "./model/units.js";
import { convertWithVelocity, durationSuffix } from "./model/units.js";
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
    "  perttool dsl help [topic [subtopic]] [--level index|quick|detail] [--format text|json]",
    "  perttool dag analyze <file> [--schedule precedence|resource|both] [--format text|json]",
    "  perttool dag next <file> [--capacity <resource-id>=<integer>] [--format text|json]",
    "",
    "The current bootstrap implements dsl check, dsl help, dag analyze, and dag next.",
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
  if (resource === "dsl" && action === "help") return [
    "Usage: perttool dsl help [topic [subtopic]]",
    "  [--level index|quick|detail]",
    "  [--format text|json]",
    "  [--color auto|always|never]",
  ].join("\n");
  if (action === "analyze") return [
    "Usage: perttool dag analyze <file>",
    "  [--schedule precedence|resource|both]",
    "  [--capacity <resource-id>=<integer>]...",
    "  [--max-paths <integer>] [--precision <integer>]",
    "  [--max-diagnostics <integer>]",
    "  [--warnings-as-errors]",
    "  [--format text|json] [--color auto|always|never]",
  ].join("\n");
  return [
    "Usage: perttool dag next <file>",
    "  [--capacity <resource-id>=<integer>]...",
    "  [--explain-depth <integer>] [--precision <integer>]",
    "  [--max-diagnostics <integer>]",
    "  [--warnings-as-errors]",
    "  [--format text|json] [--color auto|always|never]",
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
  if (
    argv.length === 3 &&
    argv[2] === "--help" &&
    ((resource === "dsl" && ["check", "help"].includes(action)) ||
      (resource === "dag" && ["analyze", "next"].includes(action)))
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
