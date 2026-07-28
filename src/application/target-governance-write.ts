import {
  createTargetGrammar4DocumentFile,
  createTargetGrammar4DocumentFileFromSource,
  replaceTargetGrammar4DocumentFile,
} from "../io/target-safe-write.js";
import { digestDocumentBytes } from "../io/document-file.js";
import type { TargetGrammar4Capability } from "../parser/document-parser.js";
import type {
  TargetGovernanceAdvanceResultV2,
  TargetGovernanceMutationResultV2,
} from "./target-governance-mutation.js";
import type { TargetGovernanceWriteProjection } from "./target-governance-projection.js";

export type TargetGovernancePersistenceRequest =
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

type TargetGovernancePersistentResult =
  | TargetGovernanceMutationResultV2
  | TargetGovernanceAdvanceResultV2;

export interface DigestBoundGovernanceResult {
  readonly ok: boolean;
  readonly originalDigest: string;
  readonly updatedDigest: string | null;
  readonly updatedText: string | null;
  readonly governance: TargetGovernancePersistentResult["governance"];
}

function writeProjection(
  request: TargetGovernancePersistenceRequest,
  written: boolean,
): TargetGovernanceWriteProjection {
  return Object.freeze({
    mode: request.mode,
    target: request.target,
    written,
  });
}

export function candidateForAuthorizedWrite(
  result: DigestBoundGovernanceResult,
): string | null {
  const decision = result.governance;
  if (
    decision === null ||
    decision.intent !== "persist" ||
    !decision.writeAuthorized ||
    !result.ok
  ) {
    return null;
  }
  if (
    result.updatedText === null ||
    result.updatedDigest === null ||
    decision.sourceDigest !== result.originalDigest
  ) {
    throw new Error(
      "authorized governance result does not contain a digest-bound candidate",
    );
  }
  const candidateDigest = digestDocumentBytes(
    Buffer.from(result.updatedText, "utf8"),
  );
  if (candidateDigest !== result.updatedDigest) {
    throw new Error(
      "authorized governance result candidate digest does not match its text",
    );
  }
  return result.updatedText;
}

export async function persistTargetGovernanceResult(
  result: TargetGovernancePersistentResult,
  capability: TargetGrammar4Capability,
  request: TargetGovernancePersistenceRequest,
): Promise<TargetGovernanceWriteProjection> {
  const candidateText = candidateForAuthorizedWrite(result);
  if (candidateText === null) return writeProjection(request, false);

  const output =
    request.mode === "in_place"
      ? await replaceTargetGrammar4DocumentFile(
          request.target,
          candidateText,
          capability,
          {
            initialDigest: result.originalDigest,
            ...(request.expectedDigest === undefined
              ? {}
              : { expectedDigest: request.expectedDigest }),
          },
        )
      : request.source === "-"
        ? await createTargetGrammar4DocumentFile(
            request.target,
            candidateText,
            capability,
            request.fileMode === undefined
              ? {}
              : { mode: request.fileMode },
          )
        : await createTargetGrammar4DocumentFileFromSource(
            request.source,
            request.target,
            candidateText,
            capability,
            {
              initialDigest: result.originalDigest,
              ...(request.fileMode === undefined
                ? {}
                : { mode: request.fileMode }),
            },
          );
  if (output.digest !== result.updatedDigest) {
    throw new Error(
      "governance safe-write digest does not match the candidate",
    );
  }
  return writeProjection(request, output.written);
}
