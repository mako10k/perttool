import type { HistoricalGitEvidenceOutcome } from "../history/git-probe.js";
import {
  reconstructPlanningPoolHistory,
  PLANNING_HISTORY_CORE_CAPABILITY,
} from "../planning-pool/history.js";
import type {
  PlanningHistoricalExecutionContexts,
  PlanningPoolHistoricalObservationResult,
} from "../planning-pool/history-types.js";
import { strictPlanningExecutionContext } from "./contract10-planning.js";

function historicalContexts(
  currentText: string,
  evidence: HistoricalGitEvidenceOutcome,
): PlanningHistoricalExecutionContexts {
  const historical = evidence.ok
    ? evidence.snapshots.flatMap((snapshot) => {
        if (snapshot.source === null) return [];
        try {
          const text = new TextDecoder("utf-8", { fatal: true }).decode(snapshot.source);
          return [Object.freeze({
            commit_id: snapshot.commitId,
            execution: strictPlanningExecutionContext(text),
          })];
        } catch {
          return [];
        }
      })
    : [];
  return Object.freeze({
    current: strictPlanningExecutionContext(currentText),
    historical: Object.freeze(historical),
  });
}

export function observeHistoricalPlanningPool(
  currentText: string,
  input: unknown,
  evidence: HistoricalGitEvidenceOutcome,
): PlanningPoolHistoricalObservationResult {
  return reconstructPlanningPoolHistory(
    currentText,
    input,
    historicalContexts(currentText, evidence),
    evidence,
    PLANNING_HISTORY_CORE_CAPABILITY,
  );
}
