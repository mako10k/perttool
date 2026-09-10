import type { SafePersistencePort } from "../ports/node-host.js";
import { SafeWriteConflictError } from "../io/safe-write.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import { parsePlanReviewSource, PLAN_REVIEW_SOURCE_CAPABILITY } from "./source.js";
import type {
  PlanReviewMutationCoreResult,
  PlanReviewPersistenceRequest,
  PlanReviewWriteProjection,
} from "./mutation-types.js";

function candidateForWrite(result: PlanReviewMutationCoreResult): string | null {
  if (!result.ok || !result.changed) return null;
  if (result.updatedText === null || result.updatedDigest === null) {
    throw new Error("successful Plan Review mutation has no digest-bound candidate");
  }
  if (sha256DigestUtf8(result.updatedText) !== result.updatedDigest) {
    throw new Error("Plan Review candidate digest does not match its text");
  }
  if (
    result.operation === "resolve" &&
    (result.planReviewAuthority === null ||
      !result.planReviewAuthority.authorized ||
      result.planReviewAuthority.source_digest !== result.originalDigest ||
      result.planReviewAuthority.candidate_digest !== result.updatedDigest)
  ) {
    throw new Error("Plan Review resolution candidate is not authority-bound");
  }
  return result.updatedText;
}

function validator(text: string) {
  const checked = parsePlanReviewSource(text, PLAN_REVIEW_SOURCE_CAPABILITY);
  return { ok: checked.ok, diagnostics: checked.diagnostics };
}

export async function persistPlanReviewMutation(
  result: PlanReviewMutationCoreResult,
  request: PlanReviewPersistenceRequest,
  persistence: SafePersistencePort,
): Promise<PlanReviewWriteProjection> {
  if (
    request.mode === "in_place" && request.expectedDigest !== undefined &&
    request.expectedDigest !== result.originalDigest
  ) {
    throw new SafeWriteConflictError(
      "expected_digest_mismatch",
      "--expect-digest does not match the initial document digest",
    );
  }
  const candidate = candidateForWrite(result);
  if (candidate === null) {
    return Object.freeze({ mode: request.mode, target: request.target, written: false });
  }
  const output = request.mode === "in_place"
    ? await persistence.replaceValidatedDocument(request.target, candidate, {
        initialDigest: result.originalDigest,
        ...(request.expectedDigest === undefined ? {} : { expectedDigest: request.expectedDigest }),
      }, validator)
    : request.source === "-"
      ? await persistence.createValidatedDocument(
          request.target,
          candidate,
          validator,
          request.fileMode === undefined ? {} : { mode: request.fileMode },
        )
      : await persistence.createValidatedDocumentFromSource(
          request.source,
          request.target,
          candidate,
          validator,
          {
            initialDigest: result.originalDigest,
            ...(request.fileMode === undefined ? {} : { mode: request.fileMode }),
          },
        );
  if (output.digest !== result.updatedDigest) {
    throw new Error("Plan Review safe-write digest does not match the candidate");
  }
  return Object.freeze({ mode: request.mode, target: request.target, written: output.written });
}
