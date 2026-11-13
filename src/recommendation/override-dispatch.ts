// R: Dispatch override validation and serialization by the actual supported result model.
import * as legacy from "./override.js";
import type { HumanOverrideDecision, OverrideRequest, OverrideValidationResult } from "./override-types.js";
import type { OverrideDecisionV2, OverrideRequestAny, OverrideSourceV2, OverrideValidationResultAny, OverrideValidationResultV2 } from "./maximum-count-override-types.js";
import { validateMaximumCountOverride } from "./maximum-count-override.js";
import { dispatchModelToJson } from "./maximum-count-json.js";
import { rfc8785Json } from "../model/rfc8785.js";
import { TOOL_VERSION } from "../version.js";

type Source = legacy.OverrideValidationSource | OverrideSourceV2;
function isModel2(source: Source): source is OverrideSourceV2 {
  return source.schemaVersion === "Perttool.NextResult.v10";
}
export function validateOverride(source: OverrideSourceV2, request: OverrideRequestAny): OverrideValidationResultV2;
export function validateOverride(source: legacy.OverrideValidationSource, request: OverrideRequest): OverrideValidationResult;
export function validateOverride(source: Source, request: OverrideRequestAny): OverrideValidationResultAny;
export function validateOverride(source: Source, request: OverrideRequestAny): OverrideValidationResultAny {
  if (isModel2(source)) {
    if (request.sourceSchemaVersion === "Perttool.NextResult.v10") return validateMaximumCountOverride(source, request);
    return { schemaVersion: "Perttool.OverrideDecision.v2", toolVersion: TOOL_VERSION, operation: "recommendation.override.validate",
      ok: false, diagnostics: [{ code: "PTOVR-101", severity: "error", message: "override request source identity differs" }],
      diagnosticsTruncated: false, override: null,
    };
  }
  if (request.sourceSchemaVersion === "Perttool.NextResult.v10") {
    return { schemaVersion: "Perttool.OverrideDecision.v1", toolVersion: TOOL_VERSION, operation: "recommendation.override.validate",
      ok: false, diagnostics: [{ code: "PTOVR-101", severity: "error", message: "override request source identity differs" }],
      diagnosticsTruncated: false, override: null,
    };
  }
  return legacy.validateOverride(source, request);
}
export function humanOverrideDecisionToJson(decision: HumanOverrideDecision | OverrideDecisionV2): Readonly<Record<string, unknown>> {
  return decision.overrideContractVersion === 1 ? legacy.humanOverrideDecisionToJson(decision)
    : dispatchModelToJson(decision) as Readonly<Record<string, unknown>>;
}
export function overrideValidationResultToJson(result: OverrideValidationResultAny): Readonly<Record<string, unknown>> {
  return result.schemaVersion === "Perttool.OverrideDecision.v1" ? legacy.overrideValidationResultToJson(result)
    : dispatchModelToJson(result) as Readonly<Record<string, unknown>>;
}
export function canonicalOverrideArtifact(result: OverrideValidationResultAny): string {
  return result.schemaVersion === "Perttool.OverrideDecision.v1" ? legacy.canonicalOverrideArtifact(result)
    : rfc8785Json(overrideValidationResultToJson(result));
}
