import {
  MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  milestoneAcceptanceBaseText,
  parseMilestoneAcceptanceSource,
} from "../milestone-acceptance/source.js";
import {
  limitDiagnostics,
  normalizeMaxDiagnostics,
  sortDiagnostics,
} from "../model/diagnostics.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { createUnifiedDiff } from "../editing/unified-diff.js";
import { applyTextEdits } from "../mutation/text-edits.js";
import {
  planFormat as planContract7Format,
  type FormatPreviewResultV7,
} from "./contract7-source.js";
import {
  planUnitMigration as planContract7UnitMigration,
  type UnitMigrationOptions,
  type UnitMigrationResult,
} from "./contract7-unit-migration.js";
import type { UnitMigrationRequest } from "../migration/request.js";
import {
  planAssuranceMutation as planContract7AssuranceMutation,
  planBatchMutation as planContract7BatchMutation,
  planFinishActuals as planContract7FinishActuals,
  planLifecycle as planContract7Lifecycle,
  planMutation as planContract7Mutation,
  type AdvanceResultV2,
  type LifecycleResultV4,
  type MutationResultV4,
} from "./contract7-mutation.js";
import {
  getProjectMetadata as getContract7ProjectMetadata,
  type ProjectMetadataResult,
} from "./contract7-project.js";
import type { CheckOptions } from "./check.js";
import {
  inspectTargetPlanAssurance as inspectContract7PlanAssurance,
  type PlanAssuranceInspectionRequest,
  type TargetPlanAssuranceInspectionResultV1,
} from "./target-assurance-inspection.js";
import type { TargetGrammar6Capability } from "../parser/document-parser.js";
import { contract8MilestoneSourceDiagnostics as sourceDiagnostics } from "./contract8-milestone-read.js";
export {
  ANALYSIS_RESULT_V6,
  CHECK_RESULT_V5,
  NEXT_RESULT_V7,
  analyzeDocument,
  checkDocument,
  selectNextTasks,
} from "./contract8-milestone-read.js";
export type {
  AnalysisResultV6,
  CheckResultV5,
  NextResultV7,
} from "./contract8-milestone-read.js";

export interface Contract8CandidateOptions {
  readonly originalLabel?: string;
  readonly updatedLabel?: string;
}

export type Contract8LiftedCandidate<T> =
  T extends { readonly schemaVersion: "Perttool.MutationResult.v4" }
    ? Omit<T, "schemaVersion"> & { readonly schemaVersion: "Perttool.MutationResult.v5" }
    : T extends { readonly schemaVersion: "Perttool.AdvanceResult.v2" }
      ? Omit<T, "schemaVersion"> & { readonly schemaVersion: "Perttool.AdvanceResult.v3" }
      : T;

export type MutationResultV5 = Contract8LiftedCandidate<MutationResultV4>;
export type LifecycleResultV5 = Contract8LiftedCandidate<LifecycleResultV4>;
export type AdvanceResultV3 = Contract8LiftedCandidate<AdvanceResultV2>;

function contract8CandidateIdentity<T>(value: T): Contract8LiftedCandidate<T> {
  if (typeof value !== "object" || value === null || !("schemaVersion" in value)) {
    return value as Contract8LiftedCandidate<T>;
  }
  const schemaVersion = value.schemaVersion === "Perttool.MutationResult.v4"
    ? "Perttool.MutationResult.v5"
    : value.schemaVersion === "Perttool.AdvanceResult.v2"
      ? "Perttool.AdvanceResult.v3"
      : value.schemaVersion;
  return Object.freeze({ ...value, schemaVersion }) as Contract8LiftedCandidate<T>;
}

export function liftMilestoneAcceptanceCandidate<T extends {
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly diff: string | null;
  readonly edits: readonly { readonly startOffset: number; readonly endOffset: number; readonly replacement: string }[];
}>(
  text: string,
  planner: (baseText: string) => T,
  options: Contract8CandidateOptions = {},
): Contract8LiftedCandidate<T> {
  const source = parseMilestoneAcceptanceSource(text, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  if (source.grammarVersion !== 7) return contract8CandidateIdentity(planner(text));
  if (!source.ok) return contract8CandidateIdentity(planner(text));
  const planned = planner(milestoneAcceptanceBaseText(text));
  if (planned.updatedText === null) {
    return contract8CandidateIdentity(Object.freeze({
      ...planned,
      originalDigest: sha256DigestUtf8(text),
    }));
  }
  const updatedText = applyTextEdits(text, planned.edits);
  const checked = parseMilestoneAcceptanceSource(updatedText, MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY);
  if (!checked.ok) throw new Error("Contract 8 mutation lost milestone acceptance source validity");
  return contract8CandidateIdentity(Object.freeze({
    ...planned,
    originalDigest: sha256DigestUtf8(text),
    updatedDigest: sha256DigestUtf8(updatedText),
    updatedText,
    diff: createUnifiedDiff(text, updatedText, {
      ...(options.originalLabel === undefined ? {} : { originalLabel: options.originalLabel }),
      ...(options.updatedLabel === undefined ? {} : { updatedLabel: options.updatedLabel }),
    }),
  }));
}

export function inspectPlanAssurance(
  text: string,
  request: PlanAssuranceInspectionRequest,
  capability: TargetGrammar6Capability,
  options: { readonly maxDiagnostics?: number } = {},
): TargetPlanAssuranceInspectionResultV1 {
  const source = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  if (source.grammarVersion !== 7) {
    return inspectContract7PlanAssurance(text, request, capability, options);
  }

  const base = inspectContract7PlanAssurance(
    milestoneAcceptanceBaseText(text),
    request,
    capability,
    options,
  );
  const extra = sourceDiagnostics(text);
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const limited = limitDiagnostics(
    sortDiagnostics([...base.diagnostics, ...extra]),
    maximum,
  );
  return Object.freeze({
    ...base,
    ok: base.ok && extra.length === 0,
    documentId: source.documentId ?? base.documentId,
    grammarVersion: 7,
    sourceDigest: sha256DigestUtf8(text),
    diagnostics: Object.freeze(limited.diagnostics),
    diagnosticsTruncated:
      base.diagnosticsTruncated || limited.truncated,
  });
}

export function getProjectMetadata(
  text: string,
  options: CheckOptions = {},
): ProjectMetadataResult {
  const source = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  const base = getContract7ProjectMetadata(
    source.grammarVersion === 7 ? milestoneAcceptanceBaseText(text) : text,
    options,
  );
  if (source.grammarVersion !== 7 || !source.ok || !base.ok || base.project === null) {
    return base;
  }
  return Object.freeze({
    ...base,
    grammarVersion: 7,
    project: Object.freeze({ ...base.project, version: 7 }),
  });
}

export function planFormat(
  text: string,
  options: Parameters<typeof planContract7Format>[1] = {},
): FormatPreviewResultV7 {
  return liftMilestoneAcceptanceCandidate(
    text,
    (baseText) => planContract7Format(baseText, options),
    options,
  );
}

export function planUnitMigration(
  text: string,
  request: UnitMigrationRequest,
  options: UnitMigrationOptions = {},
): UnitMigrationResult {
  const source = parseMilestoneAcceptanceSource(
    text,
    MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY,
  );
  const result = liftMilestoneAcceptanceCandidate(
    text,
    (baseText) => planContract7UnitMigration(baseText, request, options),
    options,
  );
  return source.grammarVersion === 7 && source.ok
    ? Object.freeze({
        ...result,
        sourceGrammarVersion: 7,
        targetGrammarVersion: result.targetGrammarVersion === null ? null : 7,
        grammarDisposition: result.grammarDisposition === null
          ? null
          : "retained" as const,
      })
    : result;
}

export function planMutation(...args: Parameters<typeof planContract7Mutation>) {
  return liftMilestoneAcceptanceCandidate(
    args[0],
    (baseText) => planContract7Mutation(baseText, args[1], args[2]),
    args[2],
  );
}

export function planBatchMutation(...args: Parameters<typeof planContract7BatchMutation>) {
  return liftMilestoneAcceptanceCandidate(
    args[0],
    (baseText) => planContract7BatchMutation(baseText, args[1], args[2]),
    args[2],
  );
}

export function planLifecycle(...args: Parameters<typeof planContract7Lifecycle>) {
  return liftMilestoneAcceptanceCandidate(
    args[0],
    (baseText) => planContract7Lifecycle(baseText, args[1], args[2]),
    args[2],
  );
}

export function planFinishActuals(...args: Parameters<typeof planContract7FinishActuals>) {
  return liftMilestoneAcceptanceCandidate(
    args[0],
    (baseText) => planContract7FinishActuals(baseText, args[1], args[2]),
    args[2],
  );
}

export function planAssuranceMutation(...args: Parameters<typeof planContract7AssuranceMutation>) {
  return liftMilestoneAcceptanceCandidate(
    args[0],
    (baseText) => planContract7AssuranceMutation(baseText, args[1], args[2]),
    args[2],
  );
}
