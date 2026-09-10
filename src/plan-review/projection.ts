import type {
  PlanReviewProjectionV1,
  PlanReviewSourceModel,
} from "./source-types.js";

export const PLAN_REVIEW_PROJECTION_MODEL_VERSION = 1 as const;

export function projectPlanReviewState(
  model: PlanReviewSourceModel,
): PlanReviewProjectionV1 {
  const openRequestIds = Object.freeze(model.requests
    .filter(({ outcome }) => outcome === null)
    .map(({ id }) => id));
  const requiredActions = openRequestIds.length === 0
    ? Object.freeze([])
    : Object.freeze([Object.freeze({
        kind: "review_before_new_downstream_work" as const,
        request_ids: openRequestIds,
      })]);
  return Object.freeze({
    model_version: PLAN_REVIEW_PROJECTION_MODEL_VERSION,
    state: openRequestIds.length === 0 ? "clear" : "review_required",
    open_request_ids: openRequestIds,
    required_actions: requiredActions,
  });
}
