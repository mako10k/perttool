import { validateStoredLifecycleState } from "../actuals/lifecycle.js";
import {
  PLAN_ASSURANCE_ADVANCE_RESULT_SCHEMA_VERSION,
  type TargetPlanAssuranceAdvanceResultV2,
} from "../assurance/advance.js";
import { sortDiagnostics } from "../model/diagnostics.js";
import type {
  AdvanceDocumentValidation,
  AdvanceDocumentValidator,
} from "../mutation/advance.js";
import type { TargetGrammar6Capability } from "../parser/document-parser.js";
import {
  validateTargetGrammar6Document,
  type TargetGrammar5ValidatedDocument,
} from "../semantic/target-validator.js";
import {
  prepareAdvanceHistory,
  withAdvanceHistoryRace,
  type AdvanceHistoryGuardV1,
  type AdvanceHistoryPreparationOptions,
  type PreparedAdvanceHistory,
} from "./advance-history.js";
import type { AdvanceHistoryBaselineRecheck } from "../history/git-probe.js";
import type { TargetActualsAdvanceResultV3 } from "./target-actuals-advance.js";

export interface TargetPlanAssuranceAdvanceResultV2WithHistory
  extends Omit<TargetPlanAssuranceAdvanceResultV2, "historyGuard"> {
  readonly historyGuard: AdvanceHistoryGuardV1 | null;
}

export interface PreparedTargetPlanAssuranceAdvanceHistory
  extends Omit<PreparedAdvanceHistory, "result"> {
  readonly result: TargetPlanAssuranceAdvanceResultV2WithHistory;
}

export type TargetPlanAssuranceAdvanceHistoryOptions = Omit<
  AdvanceHistoryPreparationOptions,
  "documentValidator"
>;

function grammar6HistoryValidator(
  capability: TargetGrammar6Capability,
): AdvanceDocumentValidator {
  return (
    text: string,
    maxDiagnostics: number,
  ): AdvanceDocumentValidation => {
    const checked = validateTargetGrammar6Document(
      text,
      capability,
      { maxDiagnostics },
    );
    const lifecycleDiagnostics = checked.validatedDocument === null
      ? []
      : validateStoredLifecycleState(
          checked.validatedDocument as unknown as TargetGrammar5ValidatedDocument,
        );
    return {
      ok: checked.ok && lifecycleDiagnostics.length === 0,
      document: checked.document,
      documentId: checked.documentId,
      diagnostics: sortDiagnostics([
        ...checked.diagnostics,
        ...lifecycleDiagnostics,
      ]),
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  };
}

/**
 * Composes history safety only after plan assurance has produced a trustworthy
 * candidate. The history-loss force option is therefore unable to change a
 * blocked assurance decision into write authority.
 */
export async function prepareTargetPlanAssuranceAdvanceHistory(
  text: string,
  result: TargetPlanAssuranceAdvanceResultV2,
  capability: TargetGrammar6Capability,
  options: TargetPlanAssuranceAdvanceHistoryOptions,
): Promise<PreparedTargetPlanAssuranceAdvanceHistory> {
  if (result.assuranceGuard?.status === "blocked") {
    return Object.freeze({
      result,
      baseline: null,
    });
  }
  const prepared = await prepareAdvanceHistory(
    text,
    result as unknown as TargetActualsAdvanceResultV3,
    {
      ...options,
      documentValidator: grammar6HistoryValidator(capability),
    },
  );
  return Object.freeze({
    result: Object.freeze({
      ...prepared.result,
      schemaVersion: PLAN_ASSURANCE_ADVANCE_RESULT_SCHEMA_VERSION,
      governance: result.governance,
      assuranceGuard: result.assuranceGuard,
      advance: result.advance,
    }),
    baseline: prepared.baseline,
  });
}

export function withTargetPlanAssuranceAdvanceHistoryRace(
  result: TargetPlanAssuranceAdvanceResultV2WithHistory,
  recheck: AdvanceHistoryBaselineRecheck,
  maxDiagnostics?: number,
): TargetPlanAssuranceAdvanceResultV2WithHistory {
  const raced = withAdvanceHistoryRace(
    result as unknown as Parameters<typeof withAdvanceHistoryRace>[0],
    recheck,
    maxDiagnostics,
  );
  return Object.freeze({
    ...raced,
    schemaVersion: PLAN_ASSURANCE_ADVANCE_RESULT_SCHEMA_VERSION,
    governance: result.governance,
    assuranceGuard: result.assuranceGuard,
    advance: result.advance,
  });
}
