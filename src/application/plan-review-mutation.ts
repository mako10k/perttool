import { planBatchMutation } from "./contract10-runtime.js";
import {
  planPlanReviewCreate,
  planPlanReviewResolve as planCoreResolve,
} from "../plan-review/mutation.js";
import type {
  PlanReviewComposedMutationResult,
  PlanReviewMutationCoreResult,
  PlanReviewMutationOptions,
} from "../plan-review/mutation-types.js";

export { planPlanReviewCreate };

export function planPlanReviewResolve(
  text: string,
  input: unknown,
  options: PlanReviewMutationOptions = {},
): PlanReviewMutationCoreResult {
  return planCoreResolve(text, input, options, {
    composeBatch: (base, request, authority) => planBatchMutation(
      base,
      request,
      {
        governance: {
          intent: "persist",
          actor: authority.actor,
          acceptedByOwner: authority.acceptedOwners,
        },
      },
    ) as PlanReviewComposedMutationResult,
  });
}
