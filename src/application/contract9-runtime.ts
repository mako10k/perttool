import * as contract8 from "./contract8-milestone-acceptance.js";
import type { DocumentWriteResult } from "../io/safe-write.js";
import { liftContract9Candidate } from "./contract9-candidate.js";
export { analyzeDocument, checkDocument, selectNextTasks } from "./contract9-temporal.js";
export { getProjectMetadata } from "./contract9-project.js";
import { inspectContract9PlanAssurance } from "./contract9-assurance.js";
import { planContract9Format, planContract9GrammarMigration } from "./contract9-format-migration.js";
export { planContract9GrammarMigration as planGrammarMigration };
export function planFormat(text: string, _options: Readonly<Record<string, unknown>> = {}) {
  return planContract9Format(text);
}
export function inspectPlanAssurance(
  text: string,
  request: Parameters<typeof inspectContract9PlanAssurance>[1],
  ..._compatibility: readonly unknown[]
) {
  return inspectContract9PlanAssurance(text, request);
}

import type { Contract9CandidateShape } from "./contract9-candidate.js";

function lifted<Args extends readonly unknown[], Result extends Contract9CandidateShape>(
  planner: (text: string, ...args: Args) => Result,
) {
  return (text: string, ...args: Args) =>
    liftContract9Candidate(text, (base) => planner(base, ...args));
}

export const planMutation = lifted(contract8.planMutation);
export const planBatchMutation = lifted(contract8.planBatchMutation);
export const planLifecycle = lifted(contract8.planLifecycle);
export const planFinishActuals = lifted(contract8.planFinishActuals);
export const planAssuranceMutation = lifted(contract8.planAssuranceMutation);
export const planUnitMigration = lifted(contract8.planUnitMigration);

export function withUnitMigrationWrite(
  result: ReturnType<typeof planUnitMigration>,
  output: DocumentWriteResult,
): ReturnType<typeof planUnitMigration> {
  if (!result.ok || result.updatedDigest === null || result.updatedText === null) {
    throw new Error("cannot attach write state to a failed unit-migration result");
  }
  if (result.write.mode !== "preview" || result.write.target !== null || result.write.written ||
      output.target.length === 0 || output.digest !== result.updatedDigest ||
      (output.mode === "out" && !output.written)) {
    throw new Error("unit-migration write state does not match the candidate");
  }
  return Object.freeze({ ...result, write: Object.freeze({
    mode: output.mode, target: output.target, written: output.written,
  }) });
}
