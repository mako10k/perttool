import {
  planValidatedMutationRequest,
  type MutationDocumentValidation,
  type MutationPlanningProfile,
} from "./mutate.js";
import {
  TARGET_MILESTONE_MUTATION_PROFILE,
} from "../mutation/milestone.js";
import {
  TARGET_TASK_MUTATION_PROFILE,
} from "../mutation/task.js";
import type {
  TargetBatchMutation,
  TargetMutation,
} from "../mutation/target-types.js";
import type {
  MutationOptions,
  MutationResult,
} from "../mutation/types.js";
import type {
  TargetGrammar2Capability,
} from "../parser/document-parser.js";
import {
  validateTargetDocument,
} from "../semantic/target-validator.js";

const targetMutationPlanningProfile: MutationPlanningProfile = Object.freeze({
  task: TARGET_TASK_MUTATION_PROFILE,
  milestone: TARGET_MILESTONE_MUTATION_PROFILE,
});

function targetValidator(
  capability: TargetGrammar2Capability,
): (text: string, maxDiagnostics: number) => MutationDocumentValidation {
  return (text, maxDiagnostics) => {
    const checked = validateTargetDocument(text, capability, { maxDiagnostics });
    const document = checked.validatedDocument?.document;
    const project = document?.declarations.find(
      (declaration) => declaration.kind === "project",
    );
    return {
      ok: checked.ok,
      document: document ?? null,
      documentId: project?.id ?? null,
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  };
}

export function planTargetMutation(
  text: string,
  mutation: TargetMutation,
  capability: TargetGrammar2Capability,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    targetValidator(capability),
    targetMutationPlanningProfile,
    options,
  );
}

export function planTargetBatchMutation(
  text: string,
  mutation: TargetBatchMutation,
  capability: TargetGrammar2Capability,
  options: MutationOptions = {},
): MutationResult {
  return planValidatedMutationRequest(
    text,
    mutation,
    targetValidator(capability),
    targetMutationPlanningProfile,
    options,
    true,
  );
}
