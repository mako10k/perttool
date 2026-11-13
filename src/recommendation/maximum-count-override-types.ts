// R: Define override model 2 while retaining the supported model-1 request and result branches.
import type { Diagnostic } from "../model/diagnostics.js";
import type { DocumentNode, RequirementValue, TargetDeclarationKind } from "../model/syntax.js";
import type { MaximumCountStartAuthority, RecommendationAnalysisV2 } from "./maximum-count-contract.js";
import type { HumanOverrideDecision, OverrideRequest, OverrideTaskDecision, OverrideValidationResult } from "./override-types.js";

export type OverrideRequestV2 = Omit<OverrideRequest, "sourceSchemaVersion"> & { readonly sourceSchemaVersion: "Perttool.NextResult.v10" };
export type OverrideRequestAny = OverrideRequest | OverrideRequestV2;
export interface OverrideSourceV2 {
  readonly schemaVersion: "Perttool.NextResult.v10";
  readonly ok: boolean;
  readonly grammarVersion: number | null;
  readonly diagnosticsTruncated: boolean;
  readonly document: DocumentNode<TargetDeclarationKind>;
  readonly capacityOverrides: ReadonlyMap<string, number>;
  readonly groups: { readonly ready: readonly string[]; readonly runnableNow: readonly string[] };
  readonly tasks: readonly { readonly id: string; readonly classification: string; readonly requirements: readonly RequirementValue[] }[];
  readonly recommendation: RecommendationAnalysisV2 | null;
  readonly temporal: {
    readonly authority: MaximumCountStartAuthority;
    readonly tasks: readonly { readonly taskId: string; readonly timeEligibility: { readonly state: "eligible" | "not_applicable" | "not_yet_eligible" | "unavailable" } }[];
  } | null;
}
export interface OverrideDecisionV2 extends Omit<HumanOverrideDecision, "overrideContractVersion" | "source" | "taskDecisions" | "selection"> {
  readonly overrideContractVersion: 2;
  readonly selection: Omit<HumanOverrideDecision["selection"], "triggerCodes"> & { readonly triggerCodes: readonly "deferred_selected"[] };
  readonly source: {
    readonly schemaVersion: "Perttool.NextResult.v10";
    readonly toolVersion: string;
    readonly sourceDigest: string;
    readonly recommendationInterfaceVersion: 2;
    readonly selectionAlgorithm: { readonly id: "perttool.dispatch.maximum-count"; readonly version: 1 };
    readonly reasonTaxonomyVersion: "2.0";
    readonly explanationModelVersion: 2;
    readonly expressionVersion: 1;
    readonly descriptionRegistryVersion: 2;
    readonly resultDecisionId: string;
    readonly selectionInputDigest: string;
    readonly recommendedTaskIds: readonly string[];
    readonly capacityOverrides: readonly { readonly resourceId: string; readonly capacity: number }[];
  };
  readonly taskDecisions: readonly (Omit<OverrideTaskDecision, "normalTier" | "triggerCodes"> & {
    readonly normalTier: "recommended" | "deferred";
    readonly triggerCodes: readonly "deferred_selected"[];
  })[];
}
interface OverrideValidationEnvelopeV2 {
  readonly schemaVersion: "Perttool.OverrideDecision.v2";
  readonly toolVersion: string;
  readonly operation: "recommendation.override.validate";
  readonly diagnosticsTruncated: false;
}
export type OverrideValidationResultV2 = OverrideValidationEnvelopeV2 & (
  | { readonly ok: true; readonly diagnostics: readonly []; readonly override: OverrideDecisionV2 }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[]; readonly override: null }
);
export type OverrideValidationResultAny = OverrideValidationResult | OverrideValidationResultV2;
