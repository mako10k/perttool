import * as contract9 from "./contract9-runtime.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import { serializeExactDurationSource } from "../model/exact-duration-source.js";
import { divide, multiply, rational, type Rational } from "../model/rational.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import {
  applyTextEdits,
  normalizeTextEdits,
  type TextEdit,
} from "../mutation/text-edits.js";
import {
  formatPlanningPoolSource,
  planPlanningPoolMigration,
} from "../planning-pool/format.js";
import {
  planningPoolBaseText,
  scanPlanningDeclarationBlocks,
} from "../planning-pool/source-lexical.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "../planning-pool/source.js";
import { liftContract10Candidate } from "./contract10-candidate.js";

function isGrammar9(text: string): boolean {
  return /^  version 9$/mu.test(text);
}

function baseText(text: string): string {
  return planningPoolBaseText(text, scanPlanningDeclarationBlocks(text));
}

function planningDiagnostics(text: string) {
  return parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY).diagnostics;
}

export function checkDocument(
  text: string,
  options: Parameters<typeof contract9.checkDocument>[1] = {},
): ReturnType<typeof contract9.checkDocument> {
  if (!isGrammar9(text)) return contract9.checkDocument(text, options);
  const source = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY, options);
  const base = contract9.checkDocument(baseText(text), options);
  const diagnostics = Object.freeze([...base.diagnostics, ...source.diagnostics]);
  const errors = source.diagnostics.filter(({ severity }) => severity === "error").length;
  const warnings = source.diagnostics.filter(({ severity }) => severity === "warning").length;
  return Object.freeze({
    ...base,
    document: Object.freeze({ ...base.document, text }),
    documentId: source.documentId,
    grammarVersion: 9,
    ok: base.ok && source.ok,
    diagnostics,
    diagnosticsTruncated: base.diagnosticsTruncated || source.diagnosticsTruncated,
    summary: Object.freeze({
      ...base.summary,
      errors: base.summary.errors + errors,
      warnings: base.summary.warnings + warnings,
    }),
  });
}

export function analyzeDocument(
  text: string,
  options: Parameters<typeof contract9.analyzeDocument>[1] = {},
): ReturnType<typeof contract9.analyzeDocument> {
  return planningRead(text, options, contract9.analyzeDocument);
}

export function selectNextTasks(
  text: string,
  options: Parameters<typeof contract9.selectNextTasks>[1] = {},
): ReturnType<typeof contract9.selectNextTasks> {
  return planningRead(text, options, contract9.selectNextTasks);
}

function planningRead<Options extends Readonly<{ maxDiagnostics?: number }>, Result>(
  text: string,
  options: Options,
  read: (source: string, options: Options) => Result,
): Result {
  if (!isGrammar9(text)) return read(text, options);
  const source = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY, options);
  const result = read(baseText(text), options) as Readonly<{
  ok: boolean;
  grammarVersion: number | null;
  documentId: string | null;
  diagnostics: readonly unknown[];
  diagnosticsTruncated: boolean;
  }>;
  return Object.freeze({
    ...result,
    grammarVersion: 9,
    documentId: source.documentId,
    ok: result.ok && source.ok,
    diagnostics: Object.freeze([...result.diagnostics, ...source.diagnostics]),
    diagnosticsTruncated: result.diagnosticsTruncated || source.diagnosticsTruncated,
  }) as unknown as Result;
}

export function planFormat(
  text: string,
  options: Parameters<typeof contract9.planFormat>[1] = {},
) {
  if (!isGrammar9(text)) return contract9.planFormat(text, options);
  const result = formatPlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY, options);
  if (!result.ok || result.formattedText === null) {
    return Object.freeze({
      ok: false,
      documentId: result.documentId,
      changed: false,
      originalDigest: sha256DigestUtf8(text),
      updatedDigest: null,
      updatedText: null,
      diff: null,
      edits: Object.freeze([]),
      diagnostics: result.diagnostics,
      diagnosticsTruncated: result.diagnosticsTruncated,
    });
  }
  return Object.freeze({
    ok: true,
    documentId: result.documentId,
    changed: result.changed,
    originalDigest: sha256DigestUtf8(text),
    updatedDigest: sha256DigestUtf8(result.formattedText),
    updatedText: result.formattedText,
    diff: createUnifiedDiff(text, result.formattedText, {
      originalLabel: "original",
      updatedLabel: "candidate",
    }),
    edits: result.edits,
    diagnostics: result.diagnostics,
    diagnosticsTruncated: result.diagnosticsTruncated,
  });
}

export function planGrammarMigration(text: string) {
  const result = planPlanningPoolMigration(text, PLANNING_POOL_SOURCE_CAPABILITY);
  const originalDigest = sha256DigestUtf8(text);
  return Object.freeze({
    ...result,
    originalDigest,
    updatedDigest: result.candidateText === null
      ? null
      : sha256DigestUtf8(result.candidateText),
    updatedText: result.candidateText,
    diff: result.candidateText === null
      ? null
      : createUnifiedDiff(text, result.candidateText, {
          originalLabel: "original",
          updatedLabel: "candidate",
        }),
    migratedTaskIds: Object.freeze([]),
    requiredAction: null,
  });
}

function lifted<Args extends readonly unknown[], Result extends Parameters<typeof liftContract10Candidate>[1] extends (text: string) => infer R ? R : never>(
  planner: (text: string, ...args: Args) => Result,
) {
  return (text: string, ...args: Args) =>
    liftContract10Candidate(text, (base) => planner(base, ...args));
}

export const planMutation = lifted(contract9.planMutation);
export const planBatchMutation = lifted(contract9.planBatchMutation);
export const planLifecycle = lifted(contract9.planLifecycle);
export const planFinishActuals = lifted(contract9.planFinishActuals);
export const planAssuranceMutation = lifted(contract9.planAssuranceMutation);

function migrationFactor(
  sourceUnit: "day" | "hour" | "point",
  targetUnit: "day" | "hour" | "point",
  velocity: NonNullable<ReturnType<typeof contract9.planUnitMigration>["effectiveVelocity"]>,
): Rational {
  return sourceUnit === "point"
    ? divide(velocity.period, velocity.points)
    : targetUnit === "point"
      ? divide(velocity.points, velocity.period)
      : rational(1n);
}

function activityMigrationFields(
  model: NonNullable<ReturnType<typeof parsePlanningPoolSource>["model"]>,
  targetUnit: "day" | "hour" | "point",
  factor: Rational,
) {
  const edits: TextEdit[] = [];
  const convertedFields: Array<{
    readonly entityKind: "activity";
    readonly entityId: string;
    readonly fieldPath: string;
    readonly original: Rational & { readonly unit: "day" | "hour" | "point" };
    readonly converted: Rational & { readonly unit: "day" | "hour" | "point" };
    readonly canonicalToken: string;
  }> = [];
  for (const activity of model.activities) {
    const fields = activity.duration === null
      ? activity.estimate === null
        ? []
        : [
            ["estimate.optimistic", activity.estimate.optimistic] as const,
            ["estimate.most_likely", activity.estimate.mostLikely] as const,
            ["estimate.pessimistic", activity.estimate.pessimistic] as const,
          ]
      : [["duration", activity.duration] as const];
    for (const [suffix, field] of fields) {
      const converted = multiply(field.value, factor);
      const token = serializeExactDurationSource(converted, targetUnit).token;
      edits.push(Object.freeze({
        startOffset: field.span.start.offset,
        endOffset: field.span.end.offset,
        replacement: token,
      }));
      convertedFields.push(Object.freeze({
        entityKind: "activity" as const,
        entityId: activity.id,
        fieldPath: `activity.${activity.id}.${suffix}`,
        original: Object.freeze({
          numerator: field.value.numerator,
          denominator: field.value.denominator,
          unit: field.unit,
        }),
        converted: Object.freeze({
          numerator: converted.numerator,
          denominator: converted.denominator,
          unit: targetUnit,
        }),
        canonicalToken: token,
      }));
    }
  }
  return Object.freeze({
    edits: Object.freeze(edits),
    convertedFields: Object.freeze(convertedFields),
  });
}

export function planUnitMigration(
  text: string,
  ...args: Parameters<typeof contract9.planUnitMigration> extends readonly [string, ...infer Rest]
    ? Rest
    : never
) {
  const source = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY);
  if (source.grammarVersion !== 9 || !source.ok || source.model === null) {
    return liftContract10Candidate(text, (base) => contract9.planUnitMigration(base, ...args));
  }
  const base = baseText(text);
  const planned = contract9.planUnitMigration(base, ...args);
  const identity = Object.freeze({
    ...planned,
    schemaVersion: "Perttool.UnitMigrationResult.v5" as const,
    unitMigration: Object.freeze({ id: "perttool.unit-migration" as const, version: 5 as const }),
    originalDigest: sha256DigestUtf8(text),
    sourceGrammarVersion: 9 as const,
    targetGrammarVersion: planned.ok ? 9 as const : null,
    grammarDisposition: planned.ok ? "retained" as const : null,
  });
  if (
    !planned.ok || !planned.changed || planned.updatedText === null ||
    planned.sourceUnit === null || planned.effectiveVelocity === null
  ) {
    return identity;
  }
  const activities = activityMigrationFields(
    source.model,
    planned.targetUnit,
    migrationFactor(planned.sourceUnit, planned.targetUnit, planned.effectiveVelocity),
  );
  const edits = normalizeTextEdits(
    text,
    [...planned.edits, ...activities.edits],
    "Grammar 9 complete unit migration",
  );
  const candidateText = applyTextEdits(text, edits);
  const checked = parsePlanningPoolSource(candidateText, PLANNING_POOL_SOURCE_CAPABILITY);
  if (!checked.ok || checked.model === null) {
    return Object.freeze({
      ...identity,
      ok: false as const,
      changed: false as const,
      updatedDigest: null,
      updatedText: null,
      diff: null,
      edits: Object.freeze([]),
      convertedFields: Object.freeze([]),
      diagnostics: Object.freeze([...planned.diagnostics, ...checked.diagnostics]),
      diagnosticsTruncated: planned.diagnosticsTruncated || checked.diagnosticsTruncated,
    });
  }
  return Object.freeze({
    ...identity,
    changed: candidateText !== text,
    updatedDigest: sha256DigestUtf8(candidateText),
    updatedText: candidateText,
    diff: createUnifiedDiff(text, candidateText, {
      originalLabel: "original",
      updatedLabel: "candidate",
    }),
    edits,
    convertedFields: Object.freeze([
      ...planned.convertedFields,
      ...activities.convertedFields,
    ]),
  });
}
export const inspectPlanAssurance = contract9.inspectPlanAssurance;
export const getProjectMetadata = contract9.getProjectMetadata;
export function withUnitMigrationWrite(
  result: ReturnType<typeof planUnitMigration>,
  output: Parameters<typeof contract9.withUnitMigrationWrite>[1],
): ReturnType<typeof planUnitMigration> {
  return contract9.withUnitMigrationWrite(
    result as unknown as ReturnType<typeof contract9.planUnitMigration>,
    output,
  ) as unknown as ReturnType<typeof planUnitMigration>;
}

export { planningDiagnostics };
