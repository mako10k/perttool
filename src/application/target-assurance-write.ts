import type {
  TargetPlanAssuranceMutationResultV4,
} from "../assurance/mutation.js";
import type {
  TargetPlanAssuranceAdvanceResultV2WithHistory,
} from "./target-assurance-advance-history.js";
import { digestDocumentBytes } from "../io/document-file.js";
import {
  createTargetGrammar6DocumentFile,
  createTargetGrammar6DocumentFileFromSource,
  replaceTargetGrammar6DocumentFile,
} from "../io/target-safe-write.js";
import { SafeWriteConflictError } from "../io/safe-write.js";
import type { SafePersistencePort } from "../ports/node-host.js";
import type { TargetGrammar6Capability } from "../parser/document-parser.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";

export type TargetPlanAssurancePersistenceRequest =
  | {
      readonly mode: "in_place";
      readonly target: string;
      readonly expectedDigest?: string;
    }
  | {
      readonly mode: "out";
      readonly source: string;
      readonly target: string;
      readonly fileMode?: number;
    };

export interface TargetPlanAssuranceWriteProjection {
  readonly mode: "in_place" | "out";
  readonly target: string;
  readonly written: boolean;
}

export type TargetPlanAssuranceWritableResult =
  | TargetPlanAssuranceMutationResultV4
  | TargetPlanAssuranceAdvanceResultV2WithHistory;

export function candidateForPlanAssuranceWrite(
  result: TargetPlanAssuranceWritableResult,
): string | null {
  const decision = result.governance;
  if (
    !result.ok ||
    !result.changed ||
    decision === null ||
    decision.intent !== "persist" ||
    !decision.writeAuthorized
  ) return null;
  if (
    result.updatedText === null ||
    result.updatedDigest === null ||
    decision.sourceDigest !== result.originalDigest
  ) {
    throw new Error(
      "authorized assurance result does not contain a digest-bound candidate",
    );
  }
  const actualDigest = digestDocumentBytes(
    Buffer.from(result.updatedText, "utf8"),
  );
  if (actualDigest !== result.updatedDigest) {
    throw new Error("authorized assurance candidate digest does not match its text");
  }
  return result.updatedText;
}

export async function persistTargetPlanAssuranceResult(
  result: TargetPlanAssuranceWritableResult,
  capability: TargetGrammar6Capability,
  request: TargetPlanAssurancePersistenceRequest,
  persistence?: SafePersistencePort,
): Promise<TargetPlanAssuranceWriteProjection> {
  if (
    request.mode === "in_place" &&
    request.expectedDigest !== undefined &&
    request.expectedDigest !== result.originalDigest
  ) {
    throw new SafeWriteConflictError(
      "expected_digest_mismatch",
      "--expect-digest does not match the initial document digest",
    );
  }
  if ("assuranceGuard" in result) {
    const expectedHistory = request.mode === "in_place"
      ? result.historyGuard?.status === "passed" ||
        result.historyGuard?.status === "forced"
      : result.historyGuard?.status === "not_applicable" &&
        result.historyGuard.cause === "separate_output";
    if (result.assuranceGuard?.status === "blocked" || !expectedHistory) {
      return Object.freeze({
        mode: request.mode,
        target: request.target,
        written: false,
      });
    }
  }
  const candidate = candidateForPlanAssuranceWrite(result);
  if (candidate === null) {
    return Object.freeze({
      mode: request.mode,
      target: request.target,
      written: false,
    });
  }
  const output = request.mode === "in_place"
    ? await (persistence === undefined
        ? replaceTargetGrammar6DocumentFile(
            request.target,
            candidate,
            capability,
            {
              initialDigest: result.originalDigest,
              ...(request.expectedDigest === undefined
                ? {}
                : { expectedDigest: request.expectedDigest }),
            },
          )
        : persistence.replaceValidatedDocument(
            request.target,
            candidate,
            {
              initialDigest: result.originalDigest,
              ...(request.expectedDigest === undefined
                ? {}
                : { expectedDigest: request.expectedDigest }),
            },
            (text) => {
              const checked = validateTargetGrammar6Document(text, capability);
              return { ok: checked.ok, diagnostics: checked.diagnostics };
            },
          ))
    : request.source === "-"
      ? await (persistence === undefined
          ? createTargetGrammar6DocumentFile(
              request.target,
              candidate,
              capability,
              request.fileMode === undefined ? {} : { mode: request.fileMode },
            )
          : persistence.createValidatedDocument(
              request.target,
              candidate,
              (text) => {
                const checked = validateTargetGrammar6Document(text, capability);
                return { ok: checked.ok, diagnostics: checked.diagnostics };
              },
              request.fileMode === undefined ? {} : { mode: request.fileMode },
            ))
      : await (persistence === undefined
          ? createTargetGrammar6DocumentFileFromSource(
              request.source,
              request.target,
              candidate,
              capability,
              {
                initialDigest: result.originalDigest,
                ...(request.fileMode === undefined ? {} : { mode: request.fileMode }),
              },
            )
          : persistence.createValidatedDocumentFromSource(
              request.source,
              request.target,
              candidate,
              (text) => {
                const checked = validateTargetGrammar6Document(text, capability);
                return { ok: checked.ok, diagnostics: checked.diagnostics };
              },
              {
                initialDigest: result.originalDigest,
                ...(request.fileMode === undefined ? {} : { mode: request.fileMode }),
              },
            ));
  if (output.digest !== result.updatedDigest) {
    throw new Error("assurance safe-write digest does not match the candidate");
  }
  return Object.freeze({
    mode: request.mode,
    target: request.target,
    written: output.written,
  });
}
