import type {
  TargetPlanAssuranceMutationResultV4,
} from "../assurance/mutation.js";
import { digestDocumentBytes } from "../io/document-file.js";
import {
  createTargetGrammar6DocumentFile,
  createTargetGrammar6DocumentFileFromSource,
  replaceTargetGrammar6DocumentFile,
} from "../io/target-safe-write.js";
import type { TargetGrammar6Capability } from "../parser/document-parser.js";

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

export function candidateForPlanAssuranceWrite(
  result: TargetPlanAssuranceMutationResultV4,
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
  result: TargetPlanAssuranceMutationResultV4,
  capability: TargetGrammar6Capability,
  request: TargetPlanAssurancePersistenceRequest,
): Promise<TargetPlanAssuranceWriteProjection> {
  const candidate = candidateForPlanAssuranceWrite(result);
  if (candidate === null) {
    return Object.freeze({
      mode: request.mode,
      target: request.target,
      written: false,
    });
  }
  const output = request.mode === "in_place"
    ? await replaceTargetGrammar6DocumentFile(
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
    : request.source === "-"
      ? await createTargetGrammar6DocumentFile(
          request.target,
          candidate,
          capability,
          request.fileMode === undefined ? {} : { mode: request.fileMode },
        )
      : await createTargetGrammar6DocumentFileFromSource(
          request.source,
          request.target,
          candidate,
          capability,
          {
            initialDigest: result.originalDigest,
            ...(request.fileMode === undefined ? {} : { mode: request.fileMode }),
          },
        );
  if (output.digest !== result.updatedDigest) {
    throw new Error("assurance safe-write digest does not match the candidate");
  }
  return Object.freeze({
    mode: request.mode,
    target: request.target,
    written: output.written,
  });
}
