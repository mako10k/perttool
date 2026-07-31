import {
  createTargetGrammar5DocumentFile,
  createTargetGrammar5DocumentFileFromSource,
  replaceTargetGrammar5DocumentFile,
} from "../io/target-safe-write.js";
import { digestDocumentBytes } from "../io/document-file.js";
import type {
  TargetGrammar5Capability,
} from "../parser/document-parser.js";
import {
  candidateForAuthorizedWrite,
  type TargetGovernancePersistenceRequest,
} from "./target-governance-write.js";
import type {
  TargetGovernanceWriteProjection,
} from "./target-governance-projection.js";
import type {
  TargetActualsMutationResultV3,
} from "./target-actuals-mutation.js";
import type {
  TargetActualsAdvanceResultV3,
} from "./target-actuals-advance.js";
import type {
  AdvanceResultV1,
} from "./advance-history.js";

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

export async function persistTargetActualsResult(
  result:
    | TargetActualsMutationResultV3
    | TargetActualsAdvanceResultV3
    | AdvanceResultV1,
  capability: TargetGrammar5Capability,
  request: TargetGovernancePersistenceRequest,
): Promise<TargetGovernanceWriteProjection> {
  const candidateText = candidateForAuthorizedWrite(result);
  if (candidateText === null) return writeProjection(request, false);

  const output =
    request.mode === "in_place"
      ? await replaceTargetGrammar5DocumentFile(
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
        ? await createTargetGrammar5DocumentFile(
            request.target,
            candidateText,
            capability,
            request.fileMode === undefined
              ? {}
              : { mode: request.fileMode },
          )
        : await createTargetGrammar5DocumentFileFromSource(
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
    throw new Error("actuals safe-write digest does not match the candidate");
  }
  return writeProjection(request, output.written);
}
