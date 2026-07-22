import type { Diagnostic } from "../model/diagnostics.js";
import type { DeclarationNode } from "../model/syntax.js";
import type { TextEdit } from "./text-edits.js";

export interface MutationEditPlan {
  readonly edits: readonly TextEdit[];
  readonly diagnostic?: Diagnostic;
}

export type MutationDiagnosticCode =
  | "PTMUT-301"
  | "PTMUT-302"
  | "PTMUT-303"
  | "PTMUT-304";

export function mutationDiagnostic(
  code: MutationDiagnosticCode,
  message: string,
  entity?: DeclarationNode,
): Diagnostic {
  return {
    code,
    severity: "error",
    message,
    helpTopic: "editing",
    ...(entity === undefined ? {} : { entityId: entity.id, span: entity.idSpan }),
  };
}
