#!/usr/bin/env node

import { lstat } from "node:fs/promises";
import process from "node:process";
import { TextDecoder } from "node:util";
import type { AnalysisMode } from "./application/analyze.js";
import type { FormatPreviewResultV7 as FormatPreviewResult } from "./application/contract7-source.js";
import type { UnitMigrationResult } from "./application/contract7-unit-migration.js";
import type {
  AdvanceResultV2,
  LifecycleResultV4,
  MutationResultV4,
} from "./application/contract7-mutation.js";
import type { TargetGovernanceWriteProjection } from "./application/target-governance-projection.js";
import type { PlanAssuranceHashKind } from "./application/target-assurance-inspection.js";
import type {
  PlanAssuranceMutation,
} from "./assurance/mutation.js";
import {
  createCliApplicationFacade,
  type TargetPlanAssuranceAdvanceResultV2WithHistory,
} from "./application/cli-facade.js";
import type {
  HistoricalGraphAnalysisModeV1,
  HistoricalGraphAncestryProfileV1,
  HistoricalGraphViewV1,
} from "./application/target-historical-graph.js";
import { createNodeHost } from "./node/host.js";
import { createHistoricalGraphGitEvidenceHost } from "./node/historical-host.js";
import {
  exportMermaid,
  type ConversionLoss,
  type MermaidAnalysisMode,
  type MermaidProfile,
} from "./conversion/mermaid.js";
import { importMermaid } from "./conversion/mermaid-import.js";
import type { HelpLevel } from "./help/registry.js";
import {
  getAssuranceGuide,
  renderAssuranceGuideResult,
  serializeAssuranceGuideResult,
} from "./help/assurance-guide.js";
import {
  commandOptionSets,
  type ProjectedCommandDescriptor,
} from "./command/registry.js";
import {
  ASSURANCE_COMMAND_REGISTRY,
  getAssuranceCommandDiscovery,
  renderAssuranceCommandHelpResult,
  serializeAssuranceCommandHelpResult,
  type AssuranceCommandDescriptor,
} from "./command/assurance-discovery.js";
import {
  handlerCommandUsageError,
} from "./command/usage.js";
import {
  renderAssuranceCommandUsageError,
  serializeAssuranceCommandUsageError,
  validateAssuranceCommandInvocation,
} from "./command/assurance-usage.js";
import { agentGuidanceResultToJson } from "./guidance/projection.js";
import {
  agentGuidanceExitCode,
  renderAgentGuidanceText,
} from "./guidance/text.js";
import {
  SafeWriteConflictError,
  SafeWriteVerificationError,
  type DocumentWriteResult,
} from "./io/safe-write.js";
import type { Diagnostic, SourceSpan } from "./model/diagnostics.js";
import type { Rational } from "./model/rational.js";
import { formatDecimal } from "./model/rational.js";
import type { DurationUnit, Velocity } from "./model/units.js";
import { convertWithVelocity, durationSuffix } from "./model/units.js";
import { recommendationInvariantExitCode } from "./recommendation/failure.js";
import { recommendationAnalysisToJson } from "./recommendation/json.js";
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
import type {
  TargetGovernanceMutation,
  TargetGovernanceProjectClearableField,
} from "./mutation/target-types.js";
import type { AdvanceDetails } from "./mutation/advance.js";
import { applyTextEdits, normalizeTextEdits } from "./mutation/text-edits.js";
import { createUnifiedDiff } from "./editing/unified-diff.js";
import { sha256DigestUtf8 } from "./model/sha256.js";
import type { LifecycleMutation } from "./actuals/lifecycle.js";
import {
  TARGET_GRAMMAR_6_CAPABILITY,
} from "./parser/document-parser.js";
import {
  exportPlanAssuranceMermaid,
  importPlanAssuranceMermaid,
} from "./assurance/mermaid.js";
import {
  getJsonSchemaResult,
  renderJsonSchemaResult,
  serializeJsonSchemaResult,
} from "./schema/registry.js";
import { TOOL_VERSION } from "./version.js";
import {
  analyzeDocument as analyzeContract8Document,
  checkDocument as checkContract8Document,
  selectNextTasks as selectContract8NextTasks,
} from "./application/contract8-milestone-acceptance.js";
import {
  persistMilestoneAcceptanceMutation,
  planAcceptanceReceiptMutation,
  planCriterionSetReplacement,
  showMilestoneAcceptance,
} from "./milestone-acceptance/mutation.js";
import {
  planMilestoneAcceptanceMigration,
  recheckCommittedMigrationProof,
  type CommittedMigrationProofV1,
} from "./milestone-acceptance/migration.js";
import { MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY, milestoneAcceptanceBaseText, parseMilestoneAcceptanceSource } from "./milestone-acceptance/source.js";
import {
  coalesceMilestoneAcceptanceDeletionOverlaps,
  planMilestoneAcceptanceAdvance,
  preserveMilestoneAcceptanceRecords,
} from "./milestone-acceptance/advance.js";

const {
  analyzeDocument: _analyzeContract7Document,
  checkDocument: _checkContract7Document,
  selectNextTasks: _selectContract7NextTasks,
  planFormat,
  planProjectInit,
  projectInitResultToJson,
  renderProjectInitResult,
  withProjectInitOutput,
  planUnitMigration,
  withUnitMigrationWrite,
  getProjectMetadata,
  contract7ProjectResultToJson,
  renderContract7ProjectText,
  planAdvance,
  planBatchMutation,
  planFinishActuals,
  planLifecycle,
  planMutation,
  planAssuranceMutation,
  renderTargetGovernanceDecision,
  contract7InspectionResultToJson,
  contract7MutationResultToJson,
  contract7SnakeJson,
  contract6WorkEventToJson,
  renderAdvanceHistoryGuard,
  prepareTargetPlanAssuranceAdvanceHistory,
  prepareAdvanceHistory,
  withAdvanceHistoryRace,
  withTargetPlanAssuranceAdvanceHistoryRace,
  persistTargetPlanAssuranceResult,
  inspectTargetPlanAssurance,
  inspectTargetCurrentProjectActuals,
  inspectTargetProjectHistoryFile,
  renderTargetProjectHistoryText,
  targetProjectHistoryResultToJson,
  observeTargetProjectVelocity,
  renderTargetVelocityObservationText,
  targetVelocityObservationResultToJson,
  getAgentHelp,
  documentContentFromBytes,
  readDocumentContent,
  readBytes,
  recheckAdvanceHistoryBaseline,
  captureAdvanceHistoryBaseline,
  createArtifactFile,
  createValidatedDocumentFile,
  createTargetGrammar6DocumentFile,
  replaceTargetGrammar6DocumentFile,
  replaceValidatedDocumentFile,
  inspectTargetHistoricalGraphFile,
  renderTargetHistoricalGraphText,
  targetHistoricalGraphResultToJson,
} = createCliApplicationFacade(
  createNodeHost(),
  createHistoricalGraphGitEvidenceHost(),
);
const analyzeDocument = analyzeContract8Document;
const checkDocument = checkContract8Document;
const selectNextTasks = selectContract8NextTasks;

function contract8MutationResultToJson(
  result: Parameters<typeof contract7MutationResultToJson>[0] | Readonly<Record<string, unknown>>,
  ...args: Tail<Parameters<typeof contract7MutationResultToJson>>
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ...contract7MutationResultToJson(
      result as Parameters<typeof contract7MutationResultToJson>[0],
      ...args,
    ),
    schema_version: "Perttool.MutationResult.v5",
    cli_contract_version: 8,
  });
}

type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer Rest]
  ? Rest
  : never;

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

function parseCommandOptions(
  operation: string,
  args: readonly string[],
): ParsedOptions {
  const descriptor = ASSURANCE_COMMAND_REGISTRY.find(
    (candidate) => candidate.operation === operation,
  );
  if (descriptor === undefined) {
    throw new Error(`command descriptor is missing for ${operation}`);
  }
  const optionSets = commandOptionSets(descriptor);
  return parseOptions(
    args,
    optionSets.values,
    optionSets.flags,
    optionSets.repeatable,
  );
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
    help_topic: null,
    guide_topic: diagnostic.helpTopic ?? null,
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
      `  guide: perttool guide ${topic}${subtopic === undefined ? "" : ` ${subtopic}`} --level quick`,
    );
  }
  return lines.join("\n");
}

async function readDocument(source: string): Promise<{
  readonly text: string;
  readonly digest: string;
  readonly bytes: Uint8Array;
  readonly modifiedAt: string | null;
}> {
  const content = source === "-"
    ? documentContentFromBytes(await readStdin())
    : await readDocumentContent(source);
  let modifiedAt: string | null = null;
  if (source !== "-") {
    try {
      const metadata = await lstat(source, { bigint: true });
      if (metadata.isFile() && !metadata.isSymbolicLink()) {
        modifiedAt = new Date(
          Number(metadata.mtimeNs / 1_000_000n),
        ).toISOString();
      }
    } catch {
      modifiedAt = null;
    }
  }
  return {
    text: content.text,
    digest: content.digest,
    bytes: content.bytes,
    modifiedAt,
  };
}

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

function writeJson(value: unknown): void {
  const contract8Value =
    typeof value === "object" && value !== null && !Array.isArray(value) &&
      "cli_contract_version" in value
      ? { ...value, cli_contract_version: 8 }
      : value;
  process.stdout.write(`${JSON.stringify(contract8Value)}\n`);
}

function snakeJson(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(snakeJson);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(),
      snakeJson(item),
    ]),
  );
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
      cli_contract_version: 8,
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
  const parsed = parseCommandOptions("document.check", args);
  if (parsed.positionals.length !== 1) {
    throw new UsageError("document check requires exactly one <file>");
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
      "document.check",
      format === "json",
    );
  }
  const result = checkDocument(input.text, { maxDiagnostics });
  const warningsAsErrors = parsed.flags.has("warnings-as-errors");
  const warningFailure = warningsAsErrors && result.summary.warnings > 0;
  const ok = result.ok && !warningFailure;
  if (format === "json") {
    writeJson({
      schema_version: result.schemaVersion,
      cli_contract_version: 8,
      tool_version: TOOL_VERSION,
      operation: "document.check",
      ok,
      document_id: result.documentId,
      source,
      source_digest: input.digest,
      diagnostics: result.diagnostics.map(jsonDiagnostic),
      diagnostics_truncated: result.diagnosticsTruncated,
      grammar_version: result.grammarVersion,
      summary: result.summary,
      temporal_inputs: snakeJson(result.temporalInputs),
      actuals_inputs:
        result.actualsInputs === null
          ? null
          : {
              model_version: result.actualsInputs.modelVersion,
              events:
                result.actualsInputs.events.map(contract6WorkEventToJson),
            },
      assurance: contract7SnakeJson(result.assurance),
      assurance_state_counts:
        contract7SnakeJson(result.assuranceStateCounts),
      acceptance: snakeJson(result.acceptance),
    });
  } else {
    if (ok) {
      process.stdout.write(
        `OK ${source} project=${result.documentId ?? "-"} milestones=${result.summary.milestones} tasks=${result.summary.tasks} gates=${result.summary.gates} resources=${result.summary.resources} temporal=milestone_deadlines:${result.temporalInputs?.milestoneDeadlines.length ?? 0},task_not_before:${result.temporalInputs?.taskConstraints.filter(({ notBefore }) => notBefore !== null).length ?? 0},task_deadlines:${result.temporalInputs?.taskConstraints.filter(({ deadline }) => deadline !== null).length ?? 0}\n`,
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

async function runProjectShow(args: readonly string[]): Promise<number> {
  const parsed = parseCommandOptions("project.show", args);
  if (parsed.positionals.length !== 1) {
    throw new UsageError("project show requires exactly one <file>");
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
  const source = sourceOperand === "-" ? "<stdin>" : sourceOperand;
  let input: Awaited<ReturnType<typeof readDocument>>;
  try {
    input = await readDocument(sourceOperand);
  } catch (error) {
    return cliError(
      error instanceof Error ? error : new Error(String(error)),
      3,
      "project.show",
      format === "json",
    );
  }
  const result = getProjectMetadata(input.text, { maxDiagnostics });
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated ||
      result.diagnostics.some((diagnostic) => diagnostic.severity === "warning"));
  const ok = result.ok && !warningFailure;
  if (format === "json") {
    writeJson(
      contract7ProjectResultToJson(
        result,
        source,
        input.digest,
        ok,
      ),
    );
  } else {
    if (ok && result.project !== null) {
      process.stdout.write(renderContract7ProjectText(result.project));
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

async function runProjectInit(args: readonly string[]): Promise<number> {
  const parsed = parseCommandOptions("project.init", args);
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const durationUnit = enumOption<"day" | "hour" | "point">(
    parsed.values.get("duration-unit") ?? "point",
    "duration-unit",
    new Set(["day", "hour", "point"]),
  )!;
  const version = optionalInteger(parsed, "version", 0, 2_147_483_647);
  let result = planProjectInit({
    projectId: parsed.positionals[0]!,
    title: requiredOption(parsed, "title"),
    durationUnit,
    initialMilestone: requiredOption(parsed, "initial-milestone"),
    initialMilestoneTitle: requiredOption(
      parsed,
      "initial-milestone-title",
    ),
    finish: requiredOption(parsed, "finish"),
    ...(version === undefined ? {} : { version }),
    ...(parsed.values.get("as-of") === undefined
      ? {}
      : { asOf: parsed.values.get("as-of")! }),
    ...(parsed.values.get("velocity") === undefined
      ? {}
      : { velocity: parsed.values.get("velocity")! }),
    ...(parsed.values.get("initial-milestone-deadline") === undefined
      ? {}
      : {
          initialMilestoneDeadline:
            parsed.values.get("initial-milestone-deadline")!,
        }),
    ...(parsed.values.get("goal-owner") === undefined
      ? {}
      : { goalOwner: parsed.values.get("goal-owner")! }),
    ...(parsed.values.get("goal-delegates") === undefined
      ? {}
      : {
          goalDelegates:
            principalListOption(parsed.values.get("goal-delegates")!),
        }),
    ...(parsed.values.get("dag-owner") === undefined
      ? {}
      : { dagOwner: parsed.values.get("dag-owner")! }),
    ...(parsed.values.get("dag-delegates") === undefined
      ? {}
      : {
          dagDelegates:
            principalListOption(parsed.values.get("dag-delegates")!),
        }),
  });
  let writeResult: DocumentWriteResult | null = null;
  const output = parsed.values.get("out");
  if (result.ok && output !== undefined) {
    try {
      writeResult = await createTargetGrammar6DocumentFile(
        output,
        result.candidateText!,
        TARGET_GRAMMAR_6_CAPABILITY,
      );
      result = withProjectInitOutput(result, writeResult);
    } catch (error) {
      return writeFailureExit(error, "project.init", format === "json");
    }
  }
  if (format === "json") {
    writeJson(projectInitResultToJson(result));
  } else {
    if (result.ok) {
      if (writeResult === null) {
        process.stdout.write(renderProjectInitResult(result));
      } else {
        process.stderr.write(renderWriteSummary("project.init", writeResult));
      }
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(
        `${renderDiagnostic(diagnostic, "<project-init>", color)}\n`,
      );
    }
  }
  return result.ok ? 0 : 1;
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

function governanceRequest(
  parsed: ParsedOptions,
  writeRequest: EditingWriteRequest,
) {
  return Object.freeze({
    intent: writeRequest.mode === "preview"
      ? "preview" as const
      : "persist" as const,
    actor: parsed.values.get("actor") ?? null,
    acceptedByOwner: Object.freeze([
      ...(parsed.repeatedValues.get("accepted-by-owner") ?? []),
    ]),
  });
}

async function persistGovernedResult(
  result:
    | MutationResultV4
    | LifecycleResultV4
    | AdvanceResultV2
    | TargetPlanAssuranceAdvanceResultV2WithHistory,
  request: EditingWriteRequest,
  sourceOperand: string,
): Promise<TargetGovernanceWriteProjection> {
  if (request.mode === "preview") {
    return Object.freeze({
      mode: "preview",
      target: null,
      written: false,
    });
  }
  return persistTargetPlanAssuranceResult(
    result,
    TARGET_GRAMMAR_6_CAPABILITY,
    request.mode === "in_place"
      ? {
          mode: "in_place",
          target: request.target,
          ...(request.expectedDigest === undefined
            ? {}
            : { expectedDigest: request.expectedDigest }),
        }
      : {
          mode: "out",
          source: sourceOperand,
          target: request.target,
        },
  );
}

async function persistContract8CandidateResult(
  result: {
    readonly ok: boolean;
    readonly changed: boolean;
    readonly originalDigest: string;
    readonly updatedText: string | null;
    readonly governance: { readonly writeAuthorized: boolean } | null;
  },
  request: EditingWriteRequest,
): Promise<TargetGovernanceWriteProjection> {
  if (request.mode === "preview" || !result.changed) {
    return Object.freeze({ mode: request.mode, target: request.target, written: false });
  }
  if (!result.ok || !result.governance?.writeAuthorized || result.updatedText === null) {
    throw new TypeError("authorized Contract 8 result does not contain a digest-bound candidate");
  }
  const validator = (candidate: string) => {
    const parsed = parseMilestoneAcceptanceSource(candidate, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
    return { ok: parsed.ok, diagnostics: [] };
  };
  if (request.mode === "in_place") {
    await replaceValidatedDocumentFile(
      request.target,
      result.updatedText,
      {
        initialDigest: result.originalDigest,
        ...(request.expectedDigest === undefined ? {} : { expectedDigest: request.expectedDigest }),
      },
      validator,
    );
  } else {
    await createValidatedDocumentFile(request.target, result.updatedText, validator);
  }
  return Object.freeze({ mode: request.mode, target: request.target, written: true });
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
      "--expect-digest does not match the initial document digest",
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
      "successful editing result has no candidate text",
    );
  }
  const acceptanceSource = parseMilestoneAcceptanceSource(
    candidateText,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  if (acceptanceSource.grammarVersion === 7) {
    const validator = (candidate: string) => {
      const parsed = parseMilestoneAcceptanceSource(
        candidate,
        MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
      );
      return { ok: parsed.ok, diagnostics: [] };
    };
    return request.mode === "in_place"
      ? replaceValidatedDocumentFile(
          request.target,
          candidateText,
          {
            initialDigest,
            ...(request.expectedDigest === undefined
              ? {}
              : { expectedDigest: request.expectedDigest }),
          },
          validator,
        )
      : createValidatedDocumentFile(request.target, candidateText, validator);
  }
  return request.mode === "in_place"
    ? replaceTargetGrammar6DocumentFile(
        request.target,
        candidateText,
        TARGET_GRAMMAR_6_CAPABILITY,
        {
          initialDigest,
          ...(request.expectedDigest === undefined
            ? {}
            : { expectedDigest: request.expectedDigest }),
        },
      )
    : createTargetGrammar6DocumentFile(
        request.target,
        candidateText,
        TARGET_GRAMMAR_6_CAPABILITY,
      );
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

function renderGovernanceWriteSummary(
  operation: string,
  result: TargetGovernanceWriteProjection,
  digest: string | null,
): string {
  return `WRITE ${operation} mode=${result.mode} target=${result.target ?? "-"} digest=${digest ?? "-"} written=${result.written}\n`;
}

async function runFormat(args: readonly string[]): Promise<number> {
  const parsed = parseCommandOptions("document.format", args);
  if (parsed.positionals.length !== 1) {
    throw new UsageError("document format requires exactly one <file>");
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
      "document.format",
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
      return writeFailureExit(error, "document.format", format === "json");
    }
  }
  if (format === "json") {
    writeJson({
      schema_version: "Perttool.FormatResult.v1",
      cli_contract_version: 8,
      tool_version: TOOL_VERSION,
      operation: "document.format",
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
        process.stderr.write(renderWriteSummary("document.format", writeResult));
      } else if (parsed.flags.has("check")) {
        if (parsed.flags.has("diff")) process.stdout.write(result.diff ?? "");
      } else {
        process.stdout.write(
          parsed.flags.has("diff") ? (result.diff ?? "") : (result.updatedText ?? ""),
        );
        if (!parsed.flags.has("diff")) {
          process.stderr.write(
            `PREVIEW document.format changed=${result.changed} original_digest=${result.originalDigest} updated_digest=${result.updatedDigest}\n`,
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

function requiredOption(parsed: ParsedOptions, name: string): string {
  const value = parsed.values.get(name);
  if (value === undefined) throw new UsageError(`option --${name} is required`);
  return value;
}

function exactMeasurementToken(
  value: string,
  suffix: "h" | "ph",
): string {
  return /^(?:[0-9]+(?:\.[0-9]+)?|[0-9]+\/[1-9][0-9]*)$/.test(value)
    ? `${value}${suffix}`
    : value;
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

function principalListOption(value: string): readonly string[] {
  const interior = value.slice(1, -1).trim();
  return interior === ""
    ? Object.freeze([])
    : Object.freeze(interior.split(",").map((item) => item.trim()));
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
        ...(parsed.values.get("not-before") === undefined
          ? {}
          : { notBefore: parsed.values.get("not-before")! }),
        ...(parsed.values.get("deadline") === undefined
          ? {}
          : { deadline: parsed.values.get("deadline")! }),
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
      "tags", "requires", "not_before", "deadline",
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
    ...(parsed.values.get("not-before") === undefined
      ? {}
      : { notBefore: parsed.values.get("not-before")! }),
    ...(parsed.values.get("deadline") === undefined
      ? {}
      : { deadline: parsed.values.get("deadline")! }),
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
    ["not_before", parsed.values.has("not-before")],
    ["deadline", parsed.values.has("deadline")],
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

function projectMutationFromOptions(
  parsed: ParsedOptions,
): TargetGovernanceMutation {
  if (parsed.positionals.length !== 1) {
    throw new UsageError("project set requires exactly one <file>");
  }
  const version = optionalInteger(parsed, "version", 0, 2_147_483_647);
  const durationUnit = enumOption<"day" | "hour" | "point">(
    parsed.values.get("duration-unit"),
    "duration-unit",
    new Set(["day", "hour", "point"]),
  );
  const clear = enumRepeated<TargetGovernanceProjectClearableField>(
    parsed,
    "clear",
    new Set([
      "description",
      "as_of",
      "velocity",
      "critical_epsilon",
      "target_duration",
      "goal_owner",
      "goal_delegates",
      "dag_owner",
      "dag_delegates",
    ]),
  );
  const conflicts = new Map<TargetGovernanceProjectClearableField, boolean>([
    ["description", parsed.values.has("description")],
    ["as_of", parsed.values.has("as-of")],
    ["velocity", parsed.values.has("velocity")],
    ["critical_epsilon", parsed.values.has("critical-epsilon")],
    ["target_duration", parsed.values.has("target-duration")],
    ["goal_owner", parsed.values.has("goal-owner")],
    ["goal_delegates", parsed.values.has("goal-delegates")],
    ["dag_owner", parsed.values.has("dag-owner")],
    ["dag_delegates", parsed.values.has("dag-delegates")],
  ]);
  const conflict = clear.find((field) => conflicts.get(field) === true);
  if (conflict !== undefined) {
    throw new UsageError(`--clear ${conflict} conflicts with another project field option`);
  }
  const set = {
    ...(parsed.values.get("id") === undefined ? {} : { id: parsed.values.get("id")! }),
    ...(version === undefined ? {} : { version }),
    ...(parsed.values.get("title") === undefined
      ? {}
      : { title: parsed.values.get("title")! }),
    ...(parsed.values.get("description") === undefined
      ? {}
      : { description: parsed.values.get("description")! }),
    ...(parsed.values.get("as-of") === undefined
      ? {}
      : { asOf: parsed.values.get("as-of")! }),
    ...(durationUnit === undefined ? {} : { durationUnit }),
    ...(parsed.values.get("velocity") === undefined
      ? {}
      : { velocity: parsed.values.get("velocity")! }),
    ...(parsed.values.get("finish") === undefined
      ? {}
      : { finish: parsed.values.get("finish")! }),
    ...(parsed.values.get("critical-epsilon") === undefined
      ? {}
      : { criticalEpsilon: parsed.values.get("critical-epsilon")! }),
    ...(parsed.values.get("target-duration") === undefined
      ? {}
      : { targetDuration: parsed.values.get("target-duration")! }),
    ...(parsed.values.get("goal-owner") === undefined
      ? {}
      : { goalOwner: parsed.values.get("goal-owner")! }),
    ...(parsed.values.get("goal-delegates") === undefined
      ? {}
      : {
          goalDelegates:
            principalListOption(parsed.values.get("goal-delegates")!),
        }),
    ...(parsed.values.get("dag-owner") === undefined
      ? {}
      : { dagOwner: parsed.values.get("dag-owner")! }),
    ...(parsed.values.get("dag-delegates") === undefined
      ? {}
      : {
          dagDelegates:
            principalListOption(parsed.values.get("dag-delegates")!),
        }),
  };
  return {
    kind: "project.set",
    ...(Object.keys(set).length === 0 ? {} : { set }),
    ...(clear.length === 0 ? {} : { clear }),
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
        ...(parsed.values.get("deadline") === undefined
          ? {}
          : { deadline: parsed.values.get("deadline")! }),
        ...((parsed.repeatedValues.get("tag") ?? []).length === 0
          ? {}
          : { tags: parsed.repeatedValues.get("tag")! }),
      },
    };
  }
  const clear = enumRepeated<MilestoneClearableField>(
    parsed,
    "clear",
    new Set(["description", "state", "deadline", "tags"]),
  );
  const addTags = uniqueRepeated(parsed, "add-tag");
  const removeTags = uniqueRepeated(parsed, "remove-tag");
  ensureDisjoint(addTags, "add-tag", removeTags, "remove-tag");
  if (
    clear.some((field) =>
      (field === "description" && parsed.values.has("description")) ||
      (field === "state" && state !== undefined) ||
      (field === "deadline" && parsed.values.has("deadline")) ||
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
    ...(parsed.values.get("deadline") === undefined
      ? {}
      : { deadline: parsed.values.get("deadline")! }),
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

function gateMutationFromOptions(action: string, parsed: ParsedOptions): Mutation {
  const expectedPositionals = action === "add" ? 4 : 2;
  if (parsed.positionals.length !== expectedPositionals) {
    throw new UsageError(
      `gate ${action} requires ${action === "add" ? "<file> <id> <from> <to>" : "<file> <id>"}`,
    );
  }
  const id = parsed.positionals[1]!;
  if (action === "remove") return { kind: "gate.remove", id };
  if (action === "add") {
    return {
      kind: "gate.add",
      id,
      from: parsed.positionals[2]!,
      to: parsed.positionals[3]!,
      gate: { reason: requiredOption(parsed, "reason") },
    };
  }
  const from = parsed.values.get("from");
  const to = parsed.values.get("to");
  const reason = parsed.values.get("reason");
  if (from === undefined && to === undefined && reason === undefined) {
    throw new UsageError("gate set requires --from, --to, or --reason");
  }
  return {
    kind: "gate.set",
    id,
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    ...(reason === undefined ? {} : { set: { reason } }),
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
  const bytes = source === "-" ? await readStdin() : await readBytes(source);
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
  resource: "project" | "task" | "gate" | "milestone" | "resource" | "batch",
  action: string,
  args: readonly string[],
): Promise<number> {
  const parsed = parseCommandOptions(`${resource}.${action}`, args);
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
  let mutation: TargetGovernanceMutation;
  let lifecycleMutation: LifecycleMutation | null = null;

  if (resource === "batch") {
    if (parsed.positionals.length !== 1) {
      throw new UsageError("batch apply requires exactly one <file>");
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
    mutation = request as TargetGovernanceMutation;
  } else {
    mutation =
      resource === "project"
        ? projectMutationFromOptions(parsed)
        : resource === "task"
          ? taskMutationFromOptions(action, parsed)
          : resource === "gate"
            ? gateMutationFromOptions(action, parsed)
          : resource === "milestone"
            ? milestoneMutationFromOptions(action, parsed)
            : resourceMutationFromOptions(action, parsed);
    sourceOperand = parsed.positionals[0]!;
    writeRequest = editingWriteRequest(parsed, sourceOperand);
    if (
      resource === "task" &&
      action === "finish" &&
      parsed.values.has("at")
    ) {
      lifecycleMutation = {
        kind: "task.finish.actual",
        taskId: parsed.positionals[1]!,
        event: {
          occurredAt: parsed.values.get("at")!,
          ...(parsed.values.get("event-id") === undefined
            ? {}
            : { id: parsed.values.get("event-id")! }),
          ...(parsed.values.get("active-time") === undefined
            ? {}
            : {
                activeTime: exactMeasurementToken(
                  parsed.values.get("active-time")!,
                  "h",
                ),
              }),
          ...(parsed.values.get("effort") === undefined
            ? {}
            : {
                effort: exactMeasurementToken(
                  parsed.values.get("effort")!,
                  "ph",
                ),
              }),
        },
      };
    } else if (
      resource === "task" &&
      action === "finish" &&
      (
        parsed.values.has("event-id") ||
        parsed.values.has("active-time") ||
        parsed.values.has("effort")
      )
    ) {
      throw new UsageError(
        "--event-id, --active-time, and --effort require --at",
      );
    }
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
    governance: governanceRequest(parsed, writeRequest),
  };
  const result = lifecycleMutation !== null
    ? planFinishActuals(
        input.text,
        lifecycleMutation,
        mutationOptions,
      )
    : resource === "batch"
    ? planBatchMutation(
        input.text,
        mutation as Extract<
          TargetGovernanceMutation,
          { readonly kind: "batch" }
        >,
        mutationOptions,
      )
    : planMutation(
        input.text,
        mutation as Mutation,
        mutationOptions,
      );
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated ||
      result.diagnostics.some((diagnostic) => diagnostic.severity === "warning"));
  const ok = result.ok && !warningFailure;
  let writeResult: TargetGovernanceWriteProjection = Object.freeze({
    mode: writeRequest.mode,
    target: writeRequest.target,
    written: false,
  });
  if (result.ok) {
    try {
      if (ok && writeRequest.mode !== "preview") {
        writeResult = await persistContract8CandidateResult(result, writeRequest);
      }
    } catch (error) {
      return writeFailureExit(error, operation, format === "json");
    }
  }
  if (format === "json") {
    writeJson(
      contract8MutationResultToJson(
        ok ? result : Object.freeze({ ...result, ok: false }),
        operation,
        source,
        writeResult,
      ),
    );
  } else {
    if (ok) {
      if (writeRequest.mode !== "preview") {
        process.stderr.write(
          renderGovernanceWriteSummary(
            operation,
            writeResult,
            result.updatedDigest,
          ),
        );
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
    if (result.governance !== null) {
      process.stderr.write(
        renderTargetGovernanceDecision(
          result.governance as unknown as Parameters<
            typeof renderTargetGovernanceDecision
          >[0],
        ),
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

async function runLifecycleMutation(
  action: "start" | "suspend" | "resume",
  args: readonly string[],
): Promise<number> {
  const operation = `task.${action}`;
  const parsed = parseCommandOptions(operation, args);
  if (parsed.positionals.length !== 2) {
    throw new UsageError(`task ${action} requires <file> <task-id>`);
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
  const source = sourceOperand === "-" ? "<stdin>" : sourceOperand;
  const writeRequest = editingWriteRequest(parsed, sourceOperand);
  const event = {
    occurredAt: requiredOption(parsed, "at"),
    ...(parsed.values.get("event-id") === undefined
      ? {}
      : { id: parsed.values.get("event-id")! }),
    ...(action !== "suspend" || parsed.values.get("reason") === undefined
      ? {}
      : { reason: parsed.values.get("reason")! }),
  };
  const mutation: LifecycleMutation =
    action === "start"
      ? { kind: "task.start", taskId: parsed.positionals[1]!, event }
      : action === "suspend"
        ? { kind: "task.suspend", taskId: parsed.positionals[1]!, event }
        : { kind: "task.resume", taskId: parsed.positionals[1]!, event };
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
  const result = planLifecycle(input.text, mutation, {
    maxDiagnostics,
    originalLabel: source,
    updatedLabel: "candidate",
    governance: governanceRequest(parsed, writeRequest),
  });
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (
      result.diagnosticsTruncated ||
      result.diagnostics.some(
        (diagnostic) => diagnostic.severity === "warning",
      )
    );
  const ok = result.ok && !warningFailure;
  let writeResult: TargetGovernanceWriteProjection = Object.freeze({
    mode: writeRequest.mode,
    target: writeRequest.target,
    written: false,
  });
  if (result.ok && ok && writeRequest.mode !== "preview") {
    try {
      writeResult = await persistContract8CandidateResult(result, writeRequest);
    } catch (error) {
      return writeFailureExit(error, operation, format === "json");
    }
  }
  if (format === "json") {
    writeJson(
      contract8MutationResultToJson(
        ok ? result : Object.freeze({ ...result, ok: false }),
        operation,
        source,
        writeResult,
      ),
    );
  } else {
    if (ok) {
      if (writeRequest.mode !== "preview") {
        process.stderr.write(
          renderGovernanceWriteSummary(
            operation,
            writeResult,
            result.updatedDigest,
          ),
        );
      } else {
        process.stdout.write(
          parsed.flags.has("diff")
            ? (result.diff ?? "")
            : (result.updatedText ?? ""),
        );
        if (!parsed.flags.has("diff")) {
          process.stderr.write(
            `PREVIEW ${operation} changed=${result.changed} original_digest=${result.originalDigest} updated_digest=${result.updatedDigest}\n`,
          );
        }
      }
    }
    if (result.lifecycle !== null) {
      process.stderr.write(
        `LIFECYCLE task=${result.lifecycle.taskId} from=${result.lifecycle.fromState} to=${result.lifecycle.toState} event=${result.lifecycle.event.id} coverage=${result.lifecycle.coverage}\n`,
      );
    }
    if (result.governance !== null) {
      process.stderr.write(
        renderTargetGovernanceDecision(
          result.governance as unknown as Parameters<
            typeof renderTargetGovernanceDecision
          >[0],
        ),
      );
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    if (result.diagnosticsTruncated) {
      process.stderr.write(
        `DIAGNOSTICS_TRUNCATED true limit=${maxDiagnostics}\n`,
      );
    }
  }
  return ok ? 0 : 1;
}

function unitMigrationJson(
  result: UnitMigrationResult,
  source: string,
  sourceDigest: string,
  ok: boolean,
): Readonly<Record<string, unknown>> {
  const exact = (
    value: UnitMigrationResult["convertedFields"][number]["original"],
  ) => ({
    numerator: value.numerator.toString(),
    denominator: value.denominator.toString(),
    unit: value.unit,
  });
  return {
    schema_version: result.schemaVersion,
    cli_contract_version: 8,
    tool_version: TOOL_VERSION,
    operation: "project.migrate-unit",
    ok,
    document_id: result.documentId,
    source,
    source_digest: sourceDigest,
    diagnostics: result.diagnostics.map(jsonDiagnostic),
    diagnostics_truncated: result.diagnosticsTruncated,
    unit_migration: result.unitMigration,
    source_grammar_version: result.sourceGrammarVersion,
    target_grammar_version: result.targetGrammarVersion,
    grammar_disposition: result.grammarDisposition,
    source_unit: result.sourceUnit,
    target_unit: result.targetUnit,
    effective_velocity: result.effectiveVelocity === null
      ? null
      : {
          points: exact(result.effectiveVelocity.points),
          period: exact(result.effectiveVelocity.period),
        },
    velocity_disposition: result.velocityDisposition,
    changed: result.changed,
    converted_fields: result.convertedFields.map((field) => ({
      entity_kind: field.entityKind,
      entity_id: field.entityId,
      field_path: field.fieldPath,
      original: exact(field.original),
      converted: exact(field.converted),
      canonical_token: field.canonicalToken,
    })),
    reversibility: result.reversibility,
    qualifications: result.qualifications,
    unavailable_causes: result.unavailableCauses.map((cause) => ({
      cause: cause.cause,
      diagnostic_code: cause.diagnosticCode,
      field_paths: cause.fieldPaths,
    })),
    original_digest: result.originalDigest,
    updated_digest: result.updatedDigest,
    updated_text: result.updatedText,
    diff: result.diff,
    edits: result.edits.map((edit) => ({
      start_offset: edit.startOffset,
      end_offset: edit.endOffset,
      replacement: edit.replacement,
    })),
    write: {
      mode: result.write.mode,
      target: result.write.target,
      written: result.write.written,
    },
  };
}

async function runUnitMigration(args: readonly string[]): Promise<number> {
  const parsed = parseCommandOptions("project.migrate-unit", args);
  if (parsed.positionals.length !== 1) {
    throw new UsageError("project migrate-unit requires exactly one <file>");
  }
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const targetUnit = enumOption<DurationUnit>(
    requiredOption(parsed, "to-unit"),
    "to-unit",
    new Set(["day", "hour", "point"]),
  )!;
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
      "project.migrate-unit",
      format === "json",
    );
  }
  let result = planUnitMigration(
    input.text,
    {
      targetUnit,
      ...(parsed.values.get("replacement-velocity") === undefined
        ? {}
        : {
            replacementVelocity:
              parsed.values.get("replacement-velocity")!,
          }),
    },
    {
      maxDiagnostics,
      originalLabel: source,
      updatedLabel: "candidate",
    },
  );
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated ||
      result.diagnostics.some(({ severity }) => severity === "warning"));
  const ok = result.ok && !warningFailure;
  let writeResult: DocumentWriteResult | null = null;
  if (result.ok) {
    try {
      assertExpectedDigest(writeRequest, input.digest);
      if (ok && writeRequest.mode !== "preview") {
        writeResult = await commitCandidate(
          writeRequest,
          result.updatedText,
          input.digest,
        );
        result = withUnitMigrationWrite(result, writeResult);
      }
    } catch (error) {
      return writeFailureExit(
        error,
        "project.migrate-unit",
        format === "json",
      );
    }
  }
  if (format === "json") {
    writeJson(unitMigrationJson(result, source, input.digest, ok));
  } else {
    if (ok) {
      if (writeResult !== null) {
        process.stderr.write(
          renderWriteSummary("project.migrate-unit", writeResult),
        );
      } else {
        process.stdout.write(
          parsed.flags.has("diff")
            ? (result.diff ?? "")
            : (result.updatedText ?? ""),
        );
        if (!parsed.flags.has("diff")) {
          process.stderr.write(
            `PREVIEW project.migrate-unit changed=${result.changed} source_unit=${result.sourceUnit ?? "-"} target_unit=${result.targetUnit} original_digest=${result.originalDigest} updated_digest=${result.updatedDigest ?? "-"}\n`,
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

async function readHistoryForCommand(
  operation: "project.history" | "project.observe-velocity",
  parsed: ParsedOptions,
  format: OutputFormat,
  expectedSourceDigest?: string,
) {
  if (parsed.positionals.length !== 1) {
    throw new UsageError(
      `${operation.replace(".", " ")} requires exactly one <file>`,
    );
  }
  const source = parsed.positionals[0]!;
  if (source === "-") {
    throw new UsageError(`${operation.replace(".", " ")} requires an on-disk file`);
  }
  try {
    return await inspectTargetProjectHistoryFile(
      {
        targetPath: source,
        ...(parsed.values.get("rev") === undefined
          ? {}
          : { revision: parsed.values.get("rev")! }),
        ...(parsed.repeatedValues.get("task") === undefined
          ? {}
          : { taskIds: parsed.repeatedValues.get("task")! }),
        ...(expectedSourceDigest === undefined
          ? {}
          : { expectedSourceDigest }),
      },
      TARGET_GRAMMAR_6_CAPABILITY,
    );
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

async function runProjectHistory(args: readonly string[]): Promise<number> {
  const parsed = parseCommandOptions("project.history", args);
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const result = await readHistoryForCommand(
    "project.history",
    parsed,
    format,
  );
  if (result instanceof Error) {
    return cliError(result, 3, "project.history", format === "json");
  }
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    result.diagnostics.some(
      (diagnostic) => diagnostic.severity === "warning",
    );
  const ok = result.ok && !warningFailure;
  if (format === "json") {
    writeJson(
      targetProjectHistoryResultToJson(
        ok ? result : Object.freeze({ ...result, ok: false }),
        parsed.positionals[0]!,
      ),
    );
  } else {
    if (ok) process.stdout.write(renderTargetProjectHistoryText(result));
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(
        `${renderDiagnostic(
          diagnostic,
          parsed.positionals[0]!,
          color,
        )}\n`,
      );
    }
  }
  return ok ? 0 : 1;
}

async function runHistoricalGraph(args: readonly string[]): Promise<number> {
  const parsed = parseCommandOptions("dag.history", args);
  if (parsed.positionals.length !== 1) {
    throw new UsageError("dag history requires exactly one <file>");
  }
  const source = parsed.positionals[0]!;
  if (source === "-") {
    throw new UsageError("dag history requires an on-disk file");
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
  const ancestry = enumOption<"first-parent" | "three-way">(
    parsed.values.get("history"),
    "history",
    new Set(["first-parent", "three-way"]),
  ) ?? "first-parent";
  const view = enumOption<HistoricalGraphViewV1>(
    parsed.values.get("view"),
    "view",
    new Set(["snapshot", "lineage", "timeline"]),
  ) ?? "lineage";
  const analysis = enumOption<HistoricalGraphAnalysisModeV1>(
    parsed.values.get("analysis"),
    "analysis",
    new Set(["none", "precedence", "resource", "both"]),
  ) ?? "none";
  const ancestryProfile: HistoricalGraphAncestryProfileV1 =
    ancestry === "first-parent" ? "first_parent" : "three_way";
  let result: Awaited<ReturnType<typeof inspectTargetHistoricalGraphFile>>;
  try {
    result = await inspectTargetHistoricalGraphFile({
      targetPath: source,
      requestedEndpoint: parsed.values.get("rev") ?? "HEAD",
      ...(parsed.values.get("base") === undefined
        ? {}
        : { lowerBoundary: parsed.values.get("base")! }),
      ancestryProfile,
      view,
      ...(parsed.values.get("snapshot") === undefined
        ? {}
        : { snapshotCommitId: parsed.values.get("snapshot")! }),
      analysisMode: analysis,
      maxDiagnostics,
    });
  } catch (error) {
    return cliError(
      error instanceof Error ? error : new Error(String(error)),
      3,
      "dag.history",
      format === "json",
    );
  }
  const warningFailure = parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated || result.diagnostics.some(
      ({ severity }) => severity === "warning",
    ));
  const ok = result.ok && !warningFailure;
  if (format === "json") {
    writeJson(targetHistoricalGraphResultToJson(
      ok ? result : Object.freeze({ ...result, ok: false }),
    ));
  } else {
    if (ok) process.stdout.write(renderTargetHistoricalGraphText(result));
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    if (result.diagnosticsTruncated) {
      process.stderr.write(`DIAGNOSTICS_TRUNCATED true limit=${maxDiagnostics}\n`);
    }
  }
  return ok ? 0 : 1;
}

async function runProjectVelocityObservation(
  args: readonly string[],
): Promise<number> {
  const parsed = parseCommandOptions("project.observe-velocity", args);
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const evidenceValue = parsed.values.get("evidence") ?? "declared";
  const evidence =
    evidenceValue === "git-recorded"
      ? "git_recorded" as const
      : evidenceValue as "declared" | "all";
  const source = parsed.positionals[0];
  let current: Awaited<ReturnType<typeof readDocumentContent>> | null = null;
  if (evidence !== "git_recorded" && source !== undefined && source !== "-") {
    try {
      current = await readDocumentContent(source);
    } catch (error) {
      return cliError(
        error instanceof Error ? error : new Error(String(error)),
        3,
        "project.observe-velocity",
        format === "json",
      );
    }
  }
  const history = await readHistoryForCommand(
    "project.observe-velocity",
    parsed,
    format,
    current?.digest,
  );
  if (history instanceof Error) {
    return cliError(
      history,
      3,
      "project.observe-velocity",
      format === "json",
    );
  }
  const taskIds = parsed.repeatedValues.get("task");
  const currentActuals = current === null
    ? null
    : inspectTargetCurrentProjectActuals(
        { bytes: current.bytes, digest: current.digest },
        taskIds === undefined ? {} : { taskIds },
        TARGET_GRAMMAR_6_CAPABILITY,
      );
  const result = observeTargetProjectVelocity(history, {
    ...(taskIds === undefined ? {} : { taskIds }),
    evidence,
  }, currentActuals === null || current === null
    ? {}
    : {
        currentActuals,
        currentSourceDigest: current.digest,
      });
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    result.diagnostics.some(
      (diagnostic) => diagnostic.severity === "warning",
    );
  const ok = result.ok && !warningFailure;
  if (format === "json") {
    writeJson(
      targetVelocityObservationResultToJson(
        ok ? result : Object.freeze({ ...result, ok: false }),
        parsed.positionals[0]!,
      ),
    );
  } else {
    if (ok) {
      process.stdout.write(renderTargetVelocityObservationText(result));
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(
        `${renderDiagnostic(
          diagnostic,
          parsed.positionals[0]!,
          color,
        )}\n`,
      );
    }
  }
  return ok ? 0 : 1;
}

function renderAdvanceSummary(details: AdvanceDetails): string {
  const list = (ids: readonly string[]): string => ids.join(",") || "-";
  return [
    `ADVANCE removed_tasks=${list(details.removedTaskIds)} removed_gates=${list(details.removedGateIds)} removed_milestones=${list(details.removedMilestoneIds)} removed_work_events=${list("removedWorkEventIds" in details ? details.removedWorkEventIds as readonly string[] : [])}`,
    `ADVANCE frontier_before=${list(details.frontierBefore)} frontier_after=${list(details.frontierAfter)} ready_before=${list(details.readyBefore)} ready_after=${list(details.readyAfter)}`,
    "",
  ].join("\n");
}

function renderAssuranceGuard(
  guard: NonNullable<AdvanceResultV2["assuranceGuard"]>,
): string {
  const list = (values: readonly string[]) => values.join(",") || "-";
  return [
    `ASSURANCE_GUARD status=${guard.status} cause=${guard.cause}`,
    `ASSURANCE_GUARD crossing_producers=${list(guard.crossingProducerTaskIds)} created_receipts=${list(guard.createdReceiptIds)} updated_receipts=${list(guard.updatedReceiptIds)} removed_receipts=${list(guard.removedReceiptIds)}`,
    ...guard.retainedBasisChecks.map((check) =>
      `ASSURANCE_BASIS task=${check.taskId} before=${check.beforeBasisHash ?? "-"} after=${check.afterBasisHash ?? "-"} equal=${check.equal}`
    ),
    "",
  ].join("\n");
}

async function runAdvance(args: readonly string[]): Promise<number> {
  const parsed = parseCommandOptions("dag.advance", args);
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
  const forceRequested = parsed.flags.has("force-history-loss");
  if (forceRequested && writeRequest.mode !== "in_place") {
    throw new UsageError(
      "--force-history-loss can only be used with --write",
    );
  }
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
  const acceptancePlan = planMilestoneAcceptanceAdvance(input.text, {
    maxDiagnostics,
    originalLabel: source,
    updatedLabel: "candidate",
    provisionalPlanner: (baseText) => planAdvance(baseText, {
      maxDiagnostics,
      originalLabel: source,
      updatedLabel: "candidate",
    }),
  });
  if (!acceptancePlan.ok) {
    if (format === "json") writeJson({
      schema_version: "Perttool.AdvanceResult.v3",
      cli_contract_version: 8,
      tool_version: TOOL_VERSION,
      operation: "dag.advance",
      ok: false,
      document_id: /^project ([A-Za-z][A-Za-z0-9_-]*):$/mu.exec(input.text)?.[1] ?? null,
      source,
      source_digest: input.digest,
      diagnostics: acceptancePlan.diagnostics.map(jsonDiagnostic),
      diagnostics_truncated: false,
      changed: acceptancePlan.provisional !== null,
      original_digest: acceptancePlan.originalDigest,
      updated_digest: acceptancePlan.provisional?.updatedDigest ?? null,
      updated_text: acceptancePlan.provisional?.updatedText ?? null,
      diff: acceptancePlan.provisional?.diff ?? null,
      edits: snakeJson(acceptancePlan.provisional?.edits ?? []),
      write: { mode: writeRequest.mode, target: writeRequest.target, written: false },
      governance: null,
      lifecycle: null,
      advance: acceptancePlan.provisional === null ? null : snakeJson({
        ...acceptancePlan.provisional.advance,
        removedWorkEventIds: [],
        removedAssuranceRecordIds: [],
        updatedAssuranceReceiptIds: [],
      }),
      history_guard: null,
      assurance_guard: null,
      acceptance_guard: snakeJson(acceptancePlan.acceptanceGuard),
    });
    else {
      if (acceptancePlan.provisional !== null) process.stdout.write(parsed.flags.has("diff") ? acceptancePlan.provisional.diff : acceptancePlan.provisional.updatedText);
      for (const diagnostic of acceptancePlan.diagnostics) process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    return 1;
  }
  const contract7BaseText = milestoneAcceptanceBaseText(input.text);
  const contract7Planned = planAdvance(
    contract7BaseText,
    {
      maxDiagnostics,
      originalLabel: source,
      updatedLabel: "candidate",
      governance: governanceRequest(parsed, writeRequest),
    },
  );
  const combinedEdits = contract7Planned.updatedText === null
    ? contract7Planned.edits
    : normalizeTextEdits(
        input.text,
        coalesceMilestoneAcceptanceDeletionOverlaps([
          ...preserveMilestoneAcceptanceRecords(
            input.text,
            contract7Planned.edits,
            acceptancePlan.provisional!.advance.stateChangedMilestoneIds,
          ),
          ...acceptancePlan.provisional!.edits,
        ]),
        "Contract 8 acceptance-aware advance",
      );
  const combinedText = contract7Planned.updatedText === null
    ? null
    : applyTextEdits(input.text, combinedEdits);
  const combinedSource = combinedText === null
    ? null
    : parseMilestoneAcceptanceSource(combinedText, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  if (combinedSource !== null && !combinedSource.ok) {
    throw new Error("acceptance-aware assurance advance lost Grammar 7 validation");
  }
  const planned = Object.freeze({
    ...contract7Planned,
    schemaVersion: "Perttool.AdvanceResult.v3" as const,
    originalDigest: input.digest,
    updatedText: combinedText,
    updatedDigest: combinedText === null ? null : sha256DigestUtf8(combinedText),
    diff: combinedText === null ? null : createUnifiedDiff(input.text, combinedText, {
      originalLabel: source,
      updatedLabel: "candidate",
    }),
    edits: combinedEdits,
    acceptanceGuard: acceptancePlan.acceptanceGuard,
  });
  const initialWarningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (planned.diagnosticsTruncated ||
      planned.diagnostics.some(
        (diagnostic) => diagnostic.severity === "warning",
      ));
  const preparedBase = await prepareAdvanceHistory(
    input.text,
    planned as never,
    {
      mode:
        writeRequest.mode === "out"
          ? "out"
          : writeRequest.mode,
      sourceBytes: input.bytes,
      sourceModifiedAt: input.modifiedAt,
      ...(writeRequest.mode === "in_place"
        ? { targetPath: sourceOperand }
        : {}),
      forceRequested,
      warningDenied: initialWarningFailure,
      maxDiagnostics,
      documentValidator: (candidateText, candidateMaxDiagnostics) => {
        const acceptanceSource = parseMilestoneAcceptanceSource(candidateText, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
        const checked = checkContract8Document(candidateText, { maxDiagnostics: candidateMaxDiagnostics });
        return {
          ok: checked.ok && acceptanceSource.ok,
          document: checked.document,
          documentId: checked.documentId,
          diagnostics: checked.diagnostics,
          diagnosticsTruncated: checked.diagnosticsTruncated,
        };
      },
    },
  );
  const prepared = Object.freeze({
    ...preparedBase,
    result: Object.freeze({
      ...preparedBase.result,
      schemaVersion: "Perttool.AdvanceResult.v3" as const,
      governance: planned.governance,
      assuranceGuard: planned.assuranceGuard,
      acceptanceGuard: acceptancePlan.acceptanceGuard,
      advance: planned.advance,
    }),
  });
  let result = prepared.result;
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated ||
      result.diagnostics.some(
        (diagnostic) => diagnostic.severity === "warning",
      ));
  let ok = result.ok && !warningFailure;
  let historyRace = false;
  let writeResult: TargetGovernanceWriteProjection = Object.freeze({
    mode: writeRequest.mode,
    target: writeRequest.target,
    written: false,
  });
  if (result.updatedText !== null) {
    try {
      if (
        ok &&
        writeRequest.mode === "in_place" &&
        prepared.baseline !== null &&
        prepared.baseline.status === "complete" &&
        (
          result.historyGuard?.status === "passed" ||
          result.historyGuard?.status === "forced"
        )
      ) {
        const recheck = await recheckAdvanceHistoryBaseline(
          prepared.baseline,
          sourceOperand,
        );
        if (!recheck.ok) {
          result = Object.freeze({
            ...withAdvanceHistoryRace(result as never, recheck, maxDiagnostics),
            schemaVersion: "Perttool.AdvanceResult.v3" as const,
            governance: result.governance,
            assuranceGuard: result.assuranceGuard,
            acceptanceGuard: result.acceptanceGuard,
            advance: result.advance,
          });
          ok = false;
          historyRace = true;
        }
      }
      if (ok && writeRequest.mode !== "preview") {
        writeResult = await persistContract8CandidateResult(result, writeRequest);
      }
    } catch (error) {
      return writeFailureExit(error, "dag.advance", format === "json");
    }
  }
  if (format === "json") {
    writeJson({
      ...contract7MutationResultToJson(
        (ok ? result : Object.freeze({ ...result, ok: false })) as never,
        "dag.advance",
        source,
        writeResult,
      ),
      schema_version: "Perttool.AdvanceResult.v3",
      cli_contract_version: 8,
      acceptance_guard: snakeJson(result.acceptanceGuard),
    });
  } else {
    if (result.advance !== null) {
      if (ok) {
        if (writeRequest.mode !== "preview") {
          process.stderr.write(
            renderGovernanceWriteSummary(
              "dag.advance",
              writeResult,
              result.updatedDigest,
            ),
          );
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
      }
      if (
        ok ||
        result.historyGuard?.status === "blocked" ||
        result.historyGuard?.status === "forced"
      ) {
        process.stderr.write(renderAdvanceSummary(result.advance));
      }
    }
    if (result.historyGuard !== null) {
      process.stderr.write(
        renderAdvanceHistoryGuard(result.historyGuard),
      );
    }
    if (result.assuranceGuard !== null) {
      process.stderr.write(renderAssuranceGuard(result.assuranceGuard));
    }
    if (result.governance !== null) {
      process.stderr.write(
        renderTargetGovernanceDecision(
          result.governance as unknown as Parameters<
            typeof renderTargetGovernanceDecision
          >[0],
        ),
      );
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    if (result.diagnosticsTruncated) {
      process.stderr.write(`DIAGNOSTICS_TRUNCATED true limit=${maxDiagnostics}\n`);
    }
  }
  return ok ? 0 : historyRace ? 5 : 1;
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
    conditional_on_suspensions_resumed:
      result.conditionalOnSuspensionsResumed,
    suspended_task_ids: result.suspendedTaskIds,
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
    conditional_on_suspensions_resumed:
      result.conditionalOnSuspensionsResumed,
    suspended_task_ids: result.suspendedTaskIds,
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
  const suspendedTaskIds =
    result.precedence?.suspendedTaskIds ??
    result.resource?.suspendedTaskIds ??
    [];
  const pathsTruncated =
    result.precedence?.critical.pathsTruncated === true ||
    result.resource?.scheduleCritical.pathsTruncated === true;
  const overrides = [...result.capacityOverrides]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  lines.push(
    `CONDITIONAL_ON_BLOCKS_RESOLVED ${conditional}`,
    `BLOCKED_TASKS ${blockedTaskIds.join(", ") || "-"}`,
    `CONDITIONAL_ON_SUSPENSIONS_RESUMED ${suspendedTaskIds.length > 0}`,
    `SUSPENDED_TASKS ${suspendedTaskIds.join(", ") || "-"}`,
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
  if (result.temporal !== null) {
    const temporalPoint = (
      point: typeof result.temporal.precedence.tasks[number]["start"],
    ): string => {
      const causes = point.unavailableCauses
        .map(({ cause }) => cause)
        .join(",") || "-";
      return [
        `state=${point.state}`,
        `relative=${point.relative === null ? "-" : `${point.relative.numerator}/${point.relative.denominator}${durationSuffix(point.relative.unit)}`}`,
        `calendar=${point.calendar?.sourceText ?? "-"}`,
        `causes=${causes}`,
      ].join(" ");
    };
    for (const [title, projection] of [
      ["TEMPORAL PRECEDENCE", result.temporal.precedence],
      ["TEMPORAL RESOURCE", result.temporal.resource],
    ] as const) {
      lines.push(
        "",
        title,
        `STATE ${projection.state}`,
        `ALGORITHM ${projection.algorithm === null ? "-" : `${projection.algorithm.id}@${projection.algorithm.version} optimal=${projection.algorithm.optimal}`}`,
        `CONDITIONAL_ON_BLOCKS_RESOLVED ${projection.conditionalOnBlocksResolved}`,
        `BLOCKED_TASKS ${projection.blockedTaskIds.join(",") || "-"}`,
        `CONDITIONAL_ON_SUSPENSIONS_RESUMED ${projection.conditionalOnSuspensionsResumed}`,
        `SUSPENDED_TASKS ${projection.suspendedTaskIds.join(",") || "-"}`,
      );
      for (const task of projection.tasks) {
        lines.push(
          `${task.taskId} START ${temporalPoint(task.start)} FINISH ${temporalPoint(task.finish)}`,
        );
      }
      if (projection.tasks.length === 0) lines.push("-");
    }
    lines.push("", "DEADLINES");
    for (const evaluation of result.temporal.deadlineEvaluations) {
      const causes = [
        ...evaluation.current.unavailableCauses,
        ...evaluation.precedence.unavailableCauses,
        ...evaluation.resource.unavailableCauses,
      ].map(({ cause }) => cause).join(",") || "-";
      lines.push(
        `${evaluation.subject.kind}:${evaluation.subject.id} assessment=${evaluation.combinedAssessment} precedence=${evaluation.precedence.assessment ?? evaluation.precedence.state} resource=${evaluation.resource.assessment ?? evaluation.resource.state} conditional=${evaluation.conditionalOnBlocksResolved} causes=${causes}`,
      );
    }
    if (result.temporal.deadlineEvaluations.length === 0) lines.push("-");
  }
  return `${lines.join("\n")}\n`;
}

async function runAnalyze(args: readonly string[]): Promise<number> {
  const parsed = parseCommandOptions("dag.analyze", args);
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
      schema_version: result.schemaVersion,
      cli_contract_version: 8,
      tool_version: TOOL_VERSION,
      operation: "dag.analyze",
      ok,
      document_id: result.documentId,
      source,
      source_digest: input.digest,
      diagnostics: result.diagnostics.map(jsonDiagnostic),
      diagnostics_truncated: result.diagnosticsTruncated,
      grammar_version: result.grammarVersion,
      task_actuals: result.taskActuals.map((actuals) => ({
        task_id: actuals.taskId,
        status: actuals.status,
        coverage: actuals.coverage,
      })),
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
      temporal: snakeJson(result.temporal),
      assurance: contract7SnakeJson(result.assurance),
      acceptance: snakeJson(result.acceptance),
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
  const parsed = parseCommandOptions("dag.render", args);
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
  const sourceCheck = checkDocument(input.text, { maxDiagnostics });
  const grammar6 = sourceCheck.grammarVersion === 6;
  const assuranceExport = grammar6
    ? exportPlanAssuranceMermaid(
        input.text,
        TARGET_GRAMMAR_6_CAPABILITY,
        {
          profile: profile === "perttool" ? 2 : "plain",
          allowLoss: !parsed.flags.has("strict-loss"),
          analysis,
          capacityOverrides: overrides,
          maxDiagnostics,
        },
        analyzeDocument,
      )
    : null;
  const legacyExport = grammar6
    ? null
    : exportMermaid(input.text, {
        profile,
        analysis,
        capacityOverrides: overrides,
        maxDiagnostics,
      });
  const result = assuranceExport === null
    ? legacyExport!
    : Object.freeze({
        ok: assuranceExport.ok,
        documentId: assuranceExport.documentId,
        diagnostics: assuranceExport.diagnostics,
        diagnosticsTruncated: assuranceExport.diagnosticsTruncated,
        profile,
        analysis,
        capacityOverrides: overrides,
        artifact: assuranceExport.artifact,
        artifactDigest: assuranceExport.artifactDigest,
        lossReport: assuranceExport.lossReport,
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
      cli_contract_version: 8,
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

async function runImport(args: readonly string[]): Promise<number> {
  const parsed = parseCommandOptions("dag.import", args);
  if (parsed.positionals.length !== 1) {
    throw new UsageError("dag import requires exactly one <file>");
  }
  enumOption(requiredOption(parsed, "from"), "from", new Set(["mermaid"]));
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
      "dag.import",
      format === "json",
    );
  }
  const profile2 = input.text.startsWith(
    "flowchart LR\n  %% perttool:profile {\"schema_version\":\"Perttool.MermaidProfile.v2\"",
  );
  const assuranceImport = profile2
    ? importPlanAssuranceMermaid(
        input.text,
        TARGET_GRAMMAR_6_CAPABILITY,
        analyzeDocument,
      )
    : null;
  const legacyImport = profile2
    ? null
    : importMermaid(input.text, { maxDiagnostics });
  const result = assuranceImport === null
    ? legacyImport!
    : Object.freeze({
        ok: assuranceImport.ok,
        documentId: assuranceImport.documentId,
        diagnostics: assuranceImport.diagnostics,
        diagnosticsTruncated: assuranceImport.diagnosticsTruncated,
        profile: "perttool" as const,
        analysis: assuranceImport.analysis,
        capacityOverrides: assuranceImport.capacityOverrides,
        artifact: assuranceImport.sourceText,
        artifactDigest: assuranceImport.sourceDigest,
        lossReport: assuranceImport.lossReport,
        generatedIds: Object.freeze([]),
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
      writeResult = await createTargetGrammar6DocumentFile(
        out,
        result.artifact!,
        TARGET_GRAMMAR_6_CAPABILITY,
      );
    } catch (error) {
      return writeFailureExit(error, "dag.import", format === "json");
    }
  }
  if (format === "json") {
    writeJson({
      schema_version: "Perttool.ImportResult.v1",
      cli_contract_version: 8,
      tool_version: TOOL_VERSION,
      operation: "dag.import",
      ok,
      document_id: result.documentId,
      source,
      source_digest: input.digest,
      diagnostics: result.diagnostics.map(jsonDiagnostic),
      diagnostics_truncated: result.diagnosticsTruncated,
      artifact_format: "pert",
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
      generated_ids: result.generatedIds.map(({ sourceElement, generatedId }) => ({
        source_element: sourceElement,
        generated_id: generatedId,
      })),
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
        process.stderr.write(renderWriteSummary("dag.import", writeResult));
      }
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    for (const conversionLoss of result.lossReport.records) {
      process.stderr.write(`${renderConversionLoss(conversionLoss, source, color)}\n`);
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
    recommendation: recommendationAnalysisToJson(result.recommendation!),
    groups: {
      active: result.groups.active,
      ready: result.groups.ready,
      runnable_now: result.groups.runnableNow,
      blocked_now: result.groups.blockedNow,
      upcoming: result.groups.upcoming,
      suspended: result.groups.suspended,
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

function recommendationParameterTaskIds(
  description: NonNullable<ReturnType<typeof selectNextTasks>["recommendation"]>["descriptions"][number],
  name: string,
): readonly string[] {
  const parameter = description.parameters.find((item) => item.name === name);
  if (parameter === undefined) return [];
  if (parameter.value.type === "entity" && parameter.value.value.kind === "task") {
    return [parameter.value.value.id];
  }
  if (parameter.value.type !== "list" && parameter.value.type !== "set") return [];
  return parameter.value.items.flatMap((item) =>
    item.type === "entity" && item.value.kind === "task" ? [item.value.id] : [],
  );
}

function recommendationParameterEntityId(
  description: NonNullable<ReturnType<typeof selectNextTasks>["recommendation"]>["descriptions"][number],
  name: string,
): string | null {
  const parameter = description.parameters.find((item) => item.name === name);
  return parameter?.value.type === "entity" ? parameter.value.value.id : null;
}

function renderRecommendationSummary(
  recommendation: NonNullable<ReturnType<typeof selectNextTasks>["recommendation"]>,
): readonly string[] {
  const steps = new Map(recommendation.decisionSteps.map((step) => [step.id, step]));
  const reasons = new Map(
    recommendation.reasonOccurrences.map((reason) => [reason.id, reason]),
  );
  const descriptions = new Map(
    recommendation.descriptions.map((description) => [description.id, description]),
  );
  const lines = [
    "RECOMMENDATION",
    `ALGORITHM ${recommendation.algorithm.id}@${recommendation.algorithm.version} optimal=${recommendation.algorithm.optimal}`,
    'EXPLANATION detail=summary complete=false machine_trace="--format json"',
    `RECOMMENDED SET ${recommendation.recommendedTaskIds.join(",") || "-"}`,
  ];
  const sections = [
    ["RECOMMENDED START", "recommended"],
    ["ALLOWED ADDITIONAL START", "allowed"],
    ["DEFERRED START", "deferred"],
    ["DISCOURAGED START", "discouraged"],
  ] as const;
  for (const [title, tier] of sections) {
    lines.push("", title);
    const decisions = recommendation.taskDecisions.filter(
      (decision) => decision.tier === tier,
    );
    if (decisions.length === 0) {
      lines.push("-");
      continue;
    }
    for (const decision of decisions) {
      const description = descriptions.get(decision.summaryDescriptionId)!;
      const primaryReason = reasons.get(description.sourceReasonIds[0]!)!;
      const rule = recommendationParameterEntityId(description, "decisive_rule_id") ??
        steps.get(primaryReason.decisionStepId)!.rule.id;
      const blockerIds = [
        ...recommendationParameterTaskIds(description, "higher_priority_task_ids"),
        ...recommendationParameterTaskIds(description, "active_blocker_task_ids"),
      ];
      lines.push(
        `${decision.subjectTaskId} tier=${decision.tier} rule=${rule} higher_priority=${decision.primaryHigherPriorityTaskId ?? "-"} blockers=${blockerIds.join(",") || "-"}`,
        `  reason=${primaryReason.code}`,
        `  why: ${description.text}`,
      );
    }
  }
  return lines;
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
  const authority = result.temporal!.authority;
  const lines = [
    "START AUTHORITY",
    `POLICY ${authority.policy}`,
    `STARTABLE RECOMMENDED ${authority.startableRecommendedTaskIds.join(",") || "-"}`,
    `DELAYED RECOMMENDED ${authority.delayedRecommendedTaskIds.join(",") || "-"}`,
    `UNAVAILABLE RECOMMENDED ${authority.unavailableRecommendedTaskIds.join(",") || "-"}`,
    "DEADLINE FACTS INFORMATIONAL FOR RANKING v1",
    "",
    `PERTTOOL NEXT ${result.documentId ?? "-"}`,
    `VELOCITY ${result.velocity === null ? "-" : velocityText(result.velocity, result.precision)}`,
    `VELOCITY_FORECAST_UNIT ${result.velocityForecast?.targetUnit ?? "-"}`,
  ];
  lines.push("", ...renderRecommendationSummary(result.recommendation!));
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
  section("SUSPENDED", result.groups.suspended);
  section("UPCOMING", result.groups.upcoming, "explanation");
  lines.push("", "TEMPORAL CONTEXT");
  for (const temporal of result.temporal!.tasks) {
    const causes = temporal.timeEligibility.unavailableCauses
      .map(({ cause }) => cause)
      .join(",") || "-";
    lines.push(
      `${temporal.taskId} eligibility=${temporal.timeEligibility.state} release=${temporal.timeEligibility.releaseBound === null ? "-" : `${temporal.timeEligibility.releaseBound.numerator}/${temporal.timeEligibility.releaseBound.denominator}${durationSuffix(temporal.timeEligibility.releaseBound.unit)}`} task_deadline=${temporal.taskDeadline?.sourceText ?? "-"} destination=${temporal.destinationMilestoneId} destination_deadline=${temporal.destinationDeadline?.sourceText ?? "-"} causes=${causes}`,
    );
  }
  if (result.temporal!.tasks.length === 0) lines.push("-");
  return `${lines.join("\n")}\n`;
}

async function runNext(args: readonly string[]): Promise<number> {
  const parsed = parseCommandOptions("dag.next", args);
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
    sourceDigest: input.digest,
  });
  const invariantExitCode = recommendationInvariantExitCode(result.diagnostics);
  if (invariantExitCode !== null) {
    if (format === "json") {
      writeJson({
        schema_version: "Perttool.CliError.v1",
        cli_contract_version: 8,
        tool_version: TOOL_VERSION,
        operation: "dag.next",
        ok: false,
        diagnostics: result.diagnostics.map(jsonDiagnostic),
      });
    } else {
      for (const diagnostic of result.diagnostics) {
        process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
      }
    }
    return invariantExitCode;
  }
  const warningFailure =
    parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated ||
      result.diagnostics.some((diagnostic) => diagnostic.severity === "warning"));
  const ok = result.ok && !warningFailure;
  if (format === "json") {
    writeJson({
      schema_version: result.schemaVersion,
      cli_contract_version: 8,
      recommendation_interface_version: 1,
      tool_version: TOOL_VERSION,
      operation: "dag.next",
      ok,
      document_id: result.documentId,
      source,
      source_digest: input.digest,
      diagnostics: result.diagnostics.map(jsonDiagnostic),
      diagnostics_truncated: result.diagnosticsTruncated,
      grammar_version: result.grammarVersion,
      ...(result.durationUnit === null ? {} : nextJson(result)),
      temporal: snakeJson(result.temporal),
      assurance: contract7SnakeJson(result.assurance),
      acceptance: snakeJson(result.acceptance),
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

async function runMilestoneAcceptance(action: string, args: readonly string[]): Promise<number> {
  const operation = `milestone-acceptance.${action}`;
  const parsed = parseCommandOptions(operation, args);
  const format = outputFormat(parsed.values.get("format"));
  const sourceOperand = parsed.positionals[0];
  if (sourceOperand === undefined) throw new UsageError(`${operation} requires <file>`);
  const input = await readDocument(sourceOperand);
  if (action === "show") {
    if (parsed.positionals.length !== 1) throw new UsageError("milestone acceptance show requires exactly one <file>");
    const result = checkDocument(input.text).acceptance ?? showMilestoneAcceptance(input.text, []);
    if (format === "json") writeJson({ schema_version: "Perttool.MilestoneAcceptanceResult.v1", cli_contract_version: 8, tool_version: TOOL_VERSION, operation, ok: result.ok, milestones: snakeJson(result.milestones), diagnostics: snakeJson(result.diagnostics) });
    else process.stdout.write(`${result.milestones.map(({ milestoneId, closure, acceptance }) => `${milestoneId} closure=${closure} acceptance=${acceptance}`).join("\n")}\n`);
    return result.ok ? 0 : 1;
  }
  if (parsed.positionals.length !== 4) throw new UsageError(`${operation} requires four operands`);
  const request = editingWriteRequest(parsed, sourceOperand);
  if (request.mode === "out") throw new UsageError(`${operation} does not support --out in Contract 8`);
  const governance = governanceRequest(parsed, request);
  let result;
  if (action === "replace") {
    const criteria = (parsed.repeatedValues.get("criterion") ?? []).map((value) => {
      const [criterionId, requiredText, evidenceKind, ...description] = value.split(":");
      if (criterionId === undefined || !["required", "optional"].includes(requiredText ?? "") || !["test", "command", "artifact", "observation", "owner"].includes(evidenceKind ?? "") || description.length === 0) throw new UsageError("--criterion must be ID:required|optional:kind:description");
      return { criterionId, required: requiredText === "required", evidenceKind: evidenceKind as "test" | "command" | "artifact" | "observation" | "owner", description: description.join(":") };
    });
    result = planCriterionSetReplacement(input.text, { milestoneId: parsed.positionals[1]!, setId: parsed.positionals[2]!, revisionId: parsed.positionals[3]!, criteria }, { governance });
  } else {
    result = planAcceptanceReceiptMutation(input.text, {
      setId: parsed.positionals[1]!, criterionId: parsed.positionals[2]!, receiptId: parsed.positionals[3]!, action: action as "verify" | "fail" | "unavailable" | "revoke" | "waive",
      ...(parsed.values.get("evidence-kind") === undefined ? {} : { evidenceKind: parsed.values.get("evidence-kind") as "test" | "command" | "artifact" | "observation" | "owner" }),
      ...(parsed.values.get("evidence-reference") === undefined ? {} : { evidenceReference: parsed.values.get("evidence-reference")! }),
      ...(parsed.values.get("evidence-revision") === undefined ? {} : { evidenceRevision: parsed.values.get("evidence-revision")! }),
      ...(parsed.values.get("verifier") === undefined ? {} : { verifier: parsed.values.get("verifier")! }),
      ...(parsed.values.get("occurred-at") === undefined ? {} : { occurredAt: parsed.values.get("occurred-at")! }),
      ...(parsed.values.get("reason") === undefined ? {} : { reason: parsed.values.get("reason")! }),
      ...(parsed.values.get("revokes") === undefined ? {} : { revokes: parsed.values.get("revokes")! }),
    }, { governance });
  }
  let written = false;
  if (result.ok && request.mode === "in_place" && result.changed) {
    await persistMilestoneAcceptanceMutation(sourceOperand, result, request.expectedDigest);
    written = true;
  }
  if (format === "json") writeJson({
    schema_version: "Perttool.MutationResult.v5",
    cli_contract_version: 8,
    tool_version: TOOL_VERSION,
    operation,
    ok: result.ok,
    document_id: /^project ([A-Za-z][A-Za-z0-9_-]*):$/mu.exec(input.text)?.[1] ?? null,
    source: sourceOperand,
    source_digest: input.digest,
    diagnostics: result.diagnostics.map((code) => jsonDiagnostic({
      code,
      severity: code === "PTGOV-103" || code === "PTGOV-104" ? "warning" : "error",
      message: code,
      helpTopic: "editing",
    })),
    diagnostics_truncated: false,
    changed: result.changed,
    original_digest: result.originalDigest,
    updated_digest: result.updatedDigest,
    updated_text: result.updatedText,
    diff: result.updatedText === null ? null : createUnifiedDiff(input.text, result.updatedText, { originalLabel: sourceOperand, updatedLabel: "candidate" }),
    edits: result.changed && result.updatedText !== null ? [{ start_offset: 0, end_offset: input.text.length, replacement: result.updatedText }] : [],
    write: { mode: request.mode, target: request.target, written },
    governance: result.governance === null ? null : {
      ...snakeJson(result.governance) as Readonly<Record<string, unknown>>,
      schema_version: "Perttool.GovernanceDecision.v2",
      governance_interface_version: 2,
      governance_semantics_version: 2,
    },
    lifecycle: null,
    assurance_impact: null,
  });
  else if (result.updatedText !== null) process.stdout.write(result.updatedText);
  return result.ok ? 0 : 1;
}

async function runDocumentMigration(args: readonly string[]): Promise<number> {
  const parsed = parseCommandOptions("document.migrate", args);
  if (parsed.positionals.length !== 1 || parsed.values.get("target-grammar") !== "7") throw new UsageError("document migrate requires <file> --target-grammar 7");
  const sourceOperand = parsed.positionals[0]!;
  if (sourceOperand === "-") throw new UsageError("document migrate requires a repository file");
  const format = outputFormat(parsed.values.get("format"));
  const input = await readDocument(sourceOperand);
  const baseline = await captureAdvanceHistoryBaseline({ targetPath: sourceOperand, expectedSourceDigest: input.digest });
  const toProof = (value: typeof baseline): CommittedMigrationProofV1 | null =>
    value.status === "complete" && value.repositorySnapshotId !== null &&
      value.repositoryRelativePath !== null && value.objectFormat !== null &&
      value.headCommitId !== null && value.headBlobId !== null &&
      value.indexBlobId !== null && value.currentSourceDigest !== null
      ? {
          repositoryId: value.repositorySnapshotId,
          repositoryRelativePath: value.repositoryRelativePath,
          objectFormat: value.objectFormat,
          headCommit: value.headCommitId,
          headBlob: value.headBlobId,
          stage0Blob: value.indexBlobId,
          sourceDigest: value.currentSourceDigest as `sha256:${string}`,
        }
      : null;
  const proof = toProof(baseline);
  let result = proof === null
    ? { ok: false, modelVersion: 1 as const, changed: false, sourceGrammarVersion: null, targetGrammarVersion: null, sourceDigest: input.digest as `sha256:${string}`, candidateDigest: null, grandfatheredMilestoneIds: Object.freeze([]), candidateText: null, diagnostics: Object.freeze(["PTMAC-109"]) }
    : planMilestoneAcceptanceMigration(input.text, proof);
  let race = false;
  if (result.ok && result.changed && result.candidateText !== null && parsed.flags.has("write")) {
    const current = toProof(await captureAdvanceHistoryBaseline({
      targetPath: sourceOperand,
      expectedSourceDigest: input.digest,
    }));
    if (proof === null || current === null || !recheckCommittedMigrationProof(proof, current)) {
      result = Object.freeze({ ...result, ok: false, diagnostics: Object.freeze(["PTMAC-110"]) });
      race = true;
    } else {
      await replaceValidatedDocumentFile(sourceOperand, result.candidateText, { initialDigest: input.digest, ...(parsed.values.get("expect-digest") === undefined ? {} : { expectedDigest: parsed.values.get("expect-digest")! }) }, (candidate) => ({ ok: parseMilestoneAcceptanceSource(candidate, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY).ok, diagnostics: [] }));
    }
  }
  if (format === "json") writeJson({ schema_version: "Perttool.MilestoneAcceptanceMigrationResult.v1", cli_contract_version: 8, tool_version: TOOL_VERSION, operation: "document.migrate", ...snakeJson(result) as Readonly<Record<string, unknown>> });
  else if (result.candidateText !== null) process.stdout.write(result.candidateText);
  return result.ok ? 0 : race ? 5 : 1;
}

function runGuide(args: readonly string[]): number {
  const parsed = parseCommandOptions("guide", args);
  if (parsed.positionals.length > 2) {
    throw new UsageError("guide accepts at most <topic> <subtopic>");
  }
  const format = outputFormat(parsed.values.get("format"));
  colorMode(parsed.values.get("color"), format);
  const topicId =
    parsed.positionals.length === 0 ? null : parsed.positionals.join(".");
  const level = helpLevel(parsed.values.get("level"), topicId !== null);
  const result = getAssuranceGuide(topicId, level);
  if (format === "json") {
    process.stdout.write(serializeAssuranceGuideResult(result));
  } else {
    const rendered = renderAssuranceGuideResult(result);
    if (result.ok) {
      process.stdout.write(rendered);
    } else {
      process.stderr.write(rendered);
    }
  }
  return result.ok ? 0 : 1;
}

function runCommandHelp(args: readonly string[]): number {
  const parsed = parseCommandOptions("help", args);
  if (parsed.positionals.length > 3) {
    throw new UsageError("help accepts at most <resource> <group> <action>");
  }
  const format = outputFormat(parsed.values.get("format"));
  const result = getAssuranceCommandDiscovery({
    resource: parsed.positionals[0] ?? null,
    action: parsed.positionals.length < 2 ? null : parsed.positionals.slice(1).join(" "),
  });
  if (format === "json") {
    process.stdout.write(serializeAssuranceCommandHelpResult(result));
  } else {
    const rendered = renderAssuranceCommandHelpResult(result);
    if (result.ok) {
      process.stdout.write(rendered);
    } else {
      process.stderr.write(rendered);
    }
  }
  return result.ok ? 0 : 1;
}

function runJsonSchema(args: readonly string[]): number {
  const parsed = parseCommandOptions("schema", args);
  if (parsed.positionals.length > 1) {
    throw new UsageError("schema accepts at most one <schema-id>");
  }
  const viewValue = parsed.values.get("view");
  const view =
    viewValue === undefined || viewValue === "full" || viewValue === "outline"
      ? viewValue
      : (() => {
          throw new UsageError("--view must be full or outline");
        })();
  const reference = parsed.values.get("ref");
  if (
    parsed.positionals.length === 0 &&
    (view !== undefined || reference !== undefined)
  ) {
    throw new UsageError(
      "schema view selection requires one <schema-id>",
    );
  }
  if (reference !== undefined && view !== "outline") {
    throw new UsageError("--ref requires --view outline");
  }
  const format = outputFormat(parsed.values.get("format"));
  const result = getJsonSchemaResult(parsed.positionals[0] ?? null, {
    ...(view === undefined ? {} : { view }),
    ...(reference === undefined ? {} : { ref: reference }),
  });
  if (format === "json") {
    process.stdout.write(serializeJsonSchemaResult(result));
  } else {
    const rendered = renderJsonSchemaResult(result);
    if (result.ok) {
      process.stdout.write(rendered);
    } else {
      process.stderr.write(rendered);
    }
  }
  return result.ok ? 0 : 1;
}

function runAgentHelp(args: readonly string[]): number {
  const parsed = parseCommandOptions("agent.help", args);
  if (parsed.positionals.length > 2) {
    throw new UsageError("agent help accepts at most <provider> <surface>");
  }
  const format = outputFormat(parsed.values.get("format"));
  const color = colorMode(parsed.values.get("color"), format);
  const providerId = parsed.positionals[0] ?? null;
  const surfaceId = parsed.positionals[1] ?? null;
  const level = helpLevel(parsed.values.get("level"), providerId !== null);
  const result = getAgentHelp({
    providerId,
    surfaceId,
    level,
  });
  if (format === "json") {
    const projected = agentGuidanceResultToJson(result);
    const {
      schema_version: schemaVersion,
      ...payload
    } = projected;
    writeJson({
      schema_version: schemaVersion,
      cli_contract_version: 8,
      ...payload,
    });
  } else {
    if (result.ok) {
      process.stdout.write(renderAgentGuidanceText(result));
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(
        `${renderDiagnostic(
          {
            code: diagnostic.code,
            severity: diagnostic.severity,
            message: diagnostic.message,
            data: {
              provider_id: diagnostic.providerId,
              surface_id: diagnostic.surfaceId,
            },
          },
          "<agent-guidance>",
          color,
        )}\n`,
      );
    }
  }
  return agentGuidanceExitCode(result.diagnostics);
}

function renderPlanAssuranceProjection(
  value: NonNullable<
    ReturnType<typeof inspectTargetPlanAssurance>["assurance"]
  >,
): string {
  const list = (values: readonly string[]) => values.join(",") || "-";
  const lines = [
    `PLAN_ASSURANCE model=${value.modelVersion ?? "-"} hash_model=${value.hashModelVersion ?? "-"} coverage=${value.coverage}`,
    `REPLAN_REQUIRED ${list(value.replanRequiredTaskIds)}`,
    `ACTIVE_ATTENTION ${list(value.activeAttentionRequiredTaskIds)}`,
  ];
  for (const task of value.taskResults) {
    lines.push(
      `TASK ${task.taskId} status=${task.status} contract=${task.contractHash ?? "-"} computed_basis=${task.computedBasisHash ?? "-"} accepted_basis=${task.acceptedBasisHash ?? "-"} exported=${task.exportedAssuranceHash ?? "-"}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

async function runPlanAssuranceInspection(
  action: "show" | "hash",
  args: readonly string[],
): Promise<number> {
  const operation = `plan-assurance.${action}`;
  const parsed = parseCommandOptions(operation, args);
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
  const result = inspectTargetPlanAssurance(
    input.text,
    action === "show"
      ? {
          operation: "plan-assurance.show",
          taskIds: parsed.repeatedValues.get("task") ?? Object.freeze([]),
        }
      : {
          operation: "plan-assurance.hash",
          taskId: parsed.positionals[1]!,
          kind: requiredOption(parsed, "kind") as PlanAssuranceHashKind,
        },
    TARGET_GRAMMAR_6_CAPABILITY,
    { maxDiagnostics },
  );
  const warningFailure = parsed.flags.has("warnings-as-errors") &&
    (result.diagnosticsTruncated || result.diagnostics.some(({ severity }) =>
      severity === "warning"
    ));
  const ok = result.ok && !warningFailure;
  if (format === "json") {
    writeJson(contract7InspectionResultToJson(
      ok ? result : Object.freeze({ ...result, ok: false }),
      source,
    ));
  } else if (ok) {
    if (action === "hash") {
      if (result.selectedHash === null) {
        throw new Error("successful assurance hash result has no digest");
      }
      process.stdout.write(`${result.selectedHash}\n`);
    } else if (result.assurance !== null) {
      process.stdout.write(renderPlanAssuranceProjection(result.assurance));
    }
  }
  for (const diagnostic of result.diagnostics) {
    process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
  }
  if (result.diagnosticsTruncated) {
    process.stderr.write(`DIAGNOSTICS_TRUNCATED true limit=${maxDiagnostics}\n`);
  }
  return ok ? 0 : 1;
}

function dependencyMode(
  value: string,
): "both" | "execution_only" | "planning_only" {
  return value === "execution-only"
    ? "execution_only"
    : value === "planning-only"
      ? "planning_only"
      : "both";
}

function assuranceMutationFromOptions(
  resource: "plan-assurance" | "plan-dependency" | "task-outcome",
  action: string,
  parsed: ParsedOptions,
): PlanAssuranceMutation {
  if (resource === "plan-assurance") {
    return action === "seal"
      ? {
          kind: "plan_assurance.seal",
          reason: requiredOption(parsed, "reason"),
        }
      : {
          kind: "plan_assurance.reseal",
          taskIds: uniqueRepeated(parsed, "task"),
          reason: requiredOption(parsed, "reason"),
        };
  }
  const id = parsed.positionals[1]!;
  if (resource === "plan-dependency") {
    if (action === "add") {
      return {
        kind: "plan_dependency.add",
        id,
        predecessorTaskId: parsed.positionals[2]!,
        successorTaskId: parsed.positionals[3]!,
        mode: dependencyMode(requiredOption(parsed, "mode")),
        ...(parsed.values.get("reason") === undefined
          ? {}
          : { reason: parsed.values.get("reason")! }),
      };
    }
    if (action === "remove") return { kind: "plan_dependency.remove", id };
    const clear = uniqueRepeated(parsed, "clear");
    return {
      kind: "plan_dependency.set",
      id,
      ...(parsed.values.get("predecessor") === undefined
        ? {}
        : { predecessorTaskId: parsed.values.get("predecessor")! }),
      ...(parsed.values.get("successor") === undefined
        ? {}
        : { successorTaskId: parsed.values.get("successor")! }),
      ...(parsed.values.get("mode") === undefined
        ? {}
        : { mode: dependencyMode(parsed.values.get("mode")!) }),
      ...(parsed.values.get("reason") === undefined
        ? {}
        : { reason: parsed.values.get("reason")! }),
      ...(clear.includes("reason") ? { clearReason: true } : {}),
    };
  }
  if (action === "add") {
    return {
      kind: "task_outcome.add",
      id,
      taskId: parsed.positionals[2]!,
      status: requiredOption(parsed, "status") as "conformant" | "changed",
      ...(parsed.values.get("summary") === undefined
        ? {}
        : { summary: parsed.values.get("summary")! }),
      reason: requiredOption(parsed, "reason"),
    };
  }
  if (action === "remove") return { kind: "task_outcome.remove", id };
  const clear = uniqueRepeated(parsed, "clear");
  return {
    kind: "task_outcome.set",
    id,
    ...(parsed.values.get("status") === undefined
      ? {}
      : {
          status: parsed.values.get("status") as "conformant" | "changed",
        }),
    ...(parsed.values.get("summary") === undefined
      ? {}
      : { summary: parsed.values.get("summary")! }),
    ...(clear.includes("summary") ? { clearSummary: true } : {}),
    ...(parsed.values.get("reason") === undefined
      ? {}
      : { reason: parsed.values.get("reason")! }),
    ...(parsed.flags.has("rebind-current-basis")
      ? { rebindCurrentBasis: true }
      : {}),
  };
}

async function runAssuranceMutation(
  resource: "plan-assurance" | "plan-dependency" | "task-outcome",
  action: string,
  args: readonly string[],
): Promise<number> {
  const operation = `${resource}.${action}`;
  const parsed = parseCommandOptions(operation, args);
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
  const source = sourceOperand === "-" ? "<stdin>" : sourceOperand;
  const writeRequest = editingWriteRequest(parsed, sourceOperand);
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
  const result = planAssuranceMutation(
    input.text,
    assuranceMutationFromOptions(resource, action, parsed),
    {
      maxDiagnostics,
      originalLabel: source,
      updatedLabel: "candidate",
      warningsAsErrors: parsed.flags.has("warnings-as-errors"),
      governance: governanceRequest(parsed, writeRequest),
    },
  );
  let writeResult: TargetGovernanceWriteProjection = Object.freeze({
    mode: writeRequest.mode,
    target: writeRequest.target,
    written: false,
  });
  if (result.ok && writeRequest.mode !== "preview") {
    try {
      writeResult = await persistContract8CandidateResult(result, writeRequest);
    } catch (error) {
      return writeFailureExit(error, operation, format === "json");
    }
  }
  if (format === "json") {
    writeJson(contract8MutationResultToJson(
      result,
      operation,
      source,
      writeResult,
    ));
  } else {
    if (result.ok) {
      if (writeRequest.mode === "preview") {
        process.stdout.write(parsed.flags.has("diff")
          ? (result.diff ?? "")
          : (result.updatedText ?? ""));
        if (!parsed.flags.has("diff")) {
          process.stderr.write(
            `PREVIEW ${operation} changed=${result.changed} original_digest=${result.originalDigest} updated_digest=${result.updatedDigest}\n`,
          );
        }
      } else {
        process.stderr.write(renderGovernanceWriteSummary(
          operation,
          writeResult,
          result.updatedDigest,
        ));
      }
    }
    if (result.governance !== null) {
      process.stderr.write(renderTargetGovernanceDecision(
        result.governance as unknown as Parameters<
          typeof renderTargetGovernanceDecision
        >[0],
      ));
    }
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${renderDiagnostic(diagnostic, source, color)}\n`);
    }
    if (result.diagnosticsTruncated) {
      process.stderr.write(`DIAGNOSTICS_TRUNCATED true limit=${maxDiagnostics}\n`);
    }
  }
  return result.ok ? 0 : 1;
}

async function dispatchCommand(
  descriptor: AssuranceCommandDescriptor,
  args: readonly string[],
): Promise<number> {
  switch (descriptor.operation) {
    case "help":
      return runCommandHelp(args);
    case "schema":
      return runJsonSchema(args);
    case "guide":
      return runGuide(args);
    case "document.check":
      return runCheck(args);
    case "document.format":
      return runFormat(args);
    case "document.migrate":
      return runDocumentMigration(args);
    case "agent.help":
      return runAgentHelp(args);
    case "project.init":
      return runProjectInit(args);
    case "project.show":
      return runProjectShow(args);
    case "project.history":
      return runProjectHistory(args);
    case "project.observe-velocity":
      return runProjectVelocityObservation(args);
    case "project.migrate-unit":
      return runUnitMigration(args);
    case "dag.analyze":
      return runAnalyze(args);
    case "dag.next":
      return runNext(args);
    case "dag.advance":
      return runAdvance(args);
    case "dag.render":
      return runRender(args);
    case "dag.history":
      return runHistoricalGraph(args);
    case "dag.import":
      return runImport(args);
    case "task.start":
      return runLifecycleMutation("start", args);
    case "task.suspend":
      return runLifecycleMutation("suspend", args);
    case "task.resume":
      return runLifecycleMutation("resume", args);
    case "milestone-acceptance.show":
    case "milestone-acceptance.replace":
    case "milestone-acceptance.verify":
    case "milestone-acceptance.fail":
    case "milestone-acceptance.unavailable":
    case "milestone-acceptance.revoke":
    case "milestone-acceptance.waive":
      return runMilestoneAcceptance(descriptor.path[2]!, args);
    case "plan-assurance.show":
      return runPlanAssuranceInspection("show", args);
    case "plan-assurance.hash":
      return runPlanAssuranceInspection("hash", args);
  }
  if (
    descriptor.path.length === 2 &&
    (
      descriptor.path[0] === "plan-assurance" ||
      descriptor.path[0] === "plan-dependency" ||
      descriptor.path[0] === "task-outcome"
    )
  ) {
    return runAssuranceMutation(
      descriptor.path[0],
      descriptor.path[1],
      args,
    );
  }
  if (
    descriptor.path.length === 2
    && (
      descriptor.operation === "project.set"
      || descriptor.operation === "batch.apply"
      || /^(?:task|gate|milestone|resource)\.(?:add|set|remove|finish)$/.test(
        descriptor.operation,
      )
    )
  ) {
    const [resource, action] = descriptor.path;
    return runMutation(
      resource as
        | "project"
        | "task"
        | "gate"
        | "milestone"
        | "resource"
        | "batch",
      action,
      args,
    );
  }
  throw new Error(`no Contract 8 handler for ${descriptor.operation}`);
}

function emitCommandUsage(
  error: ReturnType<typeof handlerCommandUsageError>,
  json: boolean,
): number {
  if (json) {
    process.stdout.write(
      serializeAssuranceCommandUsageError(error),
    );
  } else {
    process.stderr.write(renderAssuranceCommandUsageError(error));
  }
  return 2;
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv.length === 1 && argv[0] === "--version") {
    process.stdout.write(`perttool ${TOOL_VERSION}\n`);
    return 0;
  }
  if (argv.length === 1 && argv[0] === "--help") {
    return runCommandHelp([]);
  }
  const validation = validateAssuranceCommandInvocation(argv);
  if (!validation.ok) {
    if (jsonRequested(argv)) {
      process.stdout.write(
        serializeAssuranceCommandUsageError(validation.error),
      );
    } else {
      process.stderr.write(
        renderAssuranceCommandUsageError(validation.error),
      );
    }
    return 2;
  }
  const descriptor = validation.descriptor;
  if (validation.helpAlias) {
    return runCommandHelp([...descriptor.path]);
  }
  try {
    return await dispatchCommand(
      descriptor,
      argv.slice(descriptor.path.length),
    );
  } catch (error) {
    if (error instanceof UsageError) {
      return emitCommandUsage(
        handlerCommandUsageError(
          descriptor as unknown as ProjectedCommandDescriptor,
          error.message,
        ),
        jsonRequested(argv),
      );
    }
    throw error;
  }
}

const args = process.argv.slice(2);
try {
  process.exitCode = await main(args);
} catch (error) {
  process.exitCode = cliError(
    error instanceof Error ? error : new Error(String(error)),
    70,
    null,
    jsonRequested(args),
  );
}
