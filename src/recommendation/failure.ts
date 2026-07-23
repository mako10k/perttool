import type { Diagnostic } from "../model/diagnostics.js";

export function recommendationInvariantExitCode(
  diagnostics: readonly Diagnostic[],
): 70 | null {
  return diagnostics.some(({ code }) => code.startsWith("PTREC-")) ? 70 : null;
}
