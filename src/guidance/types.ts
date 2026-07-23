import type { DiagnosticSeverity } from "../model/diagnostics.js";

export const AGENT_GUIDANCE_PROVIDER_IDS = [
  "codex",
  "github-copilot",
  "claude-code",
  "grok-build",
  "antigravity",
] as const;

export const AGENT_GUIDANCE_SURFACE_IDS = [
  "instruction",
  "workflow",
  "delegated_agent",
  "enforcement",
  "prompt",
  "connector",
] as const;

export const AGENT_GUIDANCE_SUPPORT_STATUSES = [
  "native",
  "compatible",
  "preview",
  "deprecated",
  "unsupported",
  "unknown",
] as const;

export const AGENT_GUIDANCE_SCOPE_IDS = [
  "repository",
  "directory",
  "workspace",
  "user",
  "organization",
  "enterprise",
  "managed",
  "session",
  "conversation",
  "local",
  "admin",
  "system",
  "plugin",
  "compatibility",
] as const;

export const AGENT_GUIDANCE_ORIGINS = [
  "project_control",
  "common_surface",
  "provider",
] as const;

export const AGENT_GUIDANCE_DIRECTIVES = ["must", "should", "may"] as const;

export const AGENT_GUIDANCE_RISK_KINDS = [
  "scope",
  "execution",
  "delegation",
  "external_access",
  "compatibility",
  "staleness",
] as const;

export type AgentGuidanceProviderId =
  (typeof AGENT_GUIDANCE_PROVIDER_IDS)[number];
export type AgentGuidanceSurfaceId =
  (typeof AGENT_GUIDANCE_SURFACE_IDS)[number];
export type AgentGuidanceSupportStatus =
  (typeof AGENT_GUIDANCE_SUPPORT_STATUSES)[number];
export type AgentGuidanceScopeId = (typeof AGENT_GUIDANCE_SCOPE_IDS)[number];
export type AgentGuidanceOrigin = (typeof AGENT_GUIDANCE_ORIGINS)[number];
export type AgentGuidanceDirective =
  (typeof AGENT_GUIDANCE_DIRECTIVES)[number];
export type AgentGuidanceRiskKind =
  (typeof AGENT_GUIDANCE_RISK_KINDS)[number];
export type AgentGuidanceLevel = "index" | "quick" | "detail";
export type AgentGuidanceArtifactResolution =
  | "known"
  | "not_applicable"
  | "unknown";
export type AgentGuidanceEvidenceKind =
  | "official_native_documentation"
  | "official_compatibility_documentation"
  | "official_preview_notice"
  | "official_deprecation_notice"
  | "official_unsupported_notice"
  | "insufficient_official_evidence";
export type AgentGuidanceStalenessStatus =
  | "verified"
  | "review_due"
  | "unknown";

export interface GuidanceDescriptionParameter {
  readonly name: string;
  readonly value: string;
}

export interface GuidanceDescription {
  readonly key: string;
  readonly parameters: readonly GuidanceDescriptionParameter[];
  readonly text: string;
}

export interface AgentGuidanceStatusEvidence {
  readonly evidenceKind: AgentGuidanceEvidenceKind;
  readonly sourceIds: readonly string[];
  readonly facts: readonly string[];
  readonly description: GuidanceDescription;
}

export interface AgentGuidanceArtifactProfile {
  readonly artifactId: string;
  readonly path: string;
  readonly scopeIds: readonly AgentGuidanceScopeId[];
  readonly primary: boolean;
  readonly supportStatus: AgentGuidanceSupportStatus;
  readonly statusEvidence: AgentGuidanceStatusEvidence;
}

export interface AgentGuidanceSurfaceProfile {
  readonly surfaceId: AgentGuidanceSurfaceId;
  readonly supportStatus: AgentGuidanceSupportStatus;
  readonly primaryArtifactId: string | null;
  readonly artifactResolution: AgentGuidanceArtifactResolution;
  readonly providerTerms: readonly string[];
  readonly scopes: readonly AgentGuidanceScopeId[];
  readonly artifacts: readonly AgentGuidanceArtifactProfile[];
  readonly guidanceIds: readonly string[];
  readonly riskIds: readonly string[];
  readonly statusEvidence: AgentGuidanceStatusEvidence;
  readonly verifiedAt: string | null;
  readonly reviewAfter: string | null;
}

export interface AgentGuidanceProviderProfile {
  readonly providerId: AgentGuidanceProviderId;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly surfaces: readonly AgentGuidanceSurfaceProfile[];
}

export interface AgentGuidanceRecordProfile {
  readonly guidanceId: string;
  readonly origin: AgentGuidanceOrigin;
  readonly directive: AgentGuidanceDirective;
  readonly surfaceIds: readonly AgentGuidanceSurfaceId[];
  readonly description: GuidanceDescription;
}

export interface AgentGuidanceRiskProfile {
  readonly riskId: string;
  readonly kind: AgentGuidanceRiskKind;
  readonly surfaceIds: readonly AgentGuidanceSurfaceId[];
  readonly mitigationGuidanceIds: readonly string[];
  readonly description: GuidanceDescription;
}

export interface AgentGuidanceSourceProfile {
  readonly sourceId: string;
  readonly providerId: AgentGuidanceProviderId;
  readonly title: string;
  readonly url: string;
  readonly verifiedAt: string;
}

export interface AgentGuidanceAlias {
  readonly alias: string;
  readonly providerId: AgentGuidanceProviderId;
}

export interface AgentGuidanceProfile {
  readonly schemaVersion: "Perttool.AgentGuidanceProfile.v1";
  readonly profileDataVersion: 1;
  readonly guidanceTaxonomyVersion: 1;
  readonly riskTaxonomyVersion: 1;
  readonly descriptionRegistryVersion: 1;
  readonly descriptionLocale: "en";
  readonly stalenessPolicyVersion: 1;
  readonly snapshotAsOf: string;
  readonly providerOrder: readonly AgentGuidanceProviderId[];
  readonly surfaceOrder: readonly AgentGuidanceSurfaceId[];
  readonly aliases: readonly AgentGuidanceAlias[];
  readonly providers: readonly AgentGuidanceProviderProfile[];
  readonly guidanceRegistry: readonly AgentGuidanceRecordProfile[];
  readonly riskRegistry: readonly AgentGuidanceRiskProfile[];
  readonly sources: readonly AgentGuidanceSourceProfile[];
}

export interface AgentGuidanceProfileSnapshot {
  readonly profile: AgentGuidanceProfile;
  readonly canonicalJson: string;
  readonly profileDigest: string;
}

export interface AgentGuidanceDiagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly providerId: string | null;
  readonly surfaceId: string | null;
}

export interface AgentGuidanceProfileValidationResult {
  readonly ok: boolean;
  readonly profileDigest: string;
  readonly diagnostics: readonly AgentGuidanceDiagnostic[];
}

export interface AgentGuidanceQuery {
  readonly providerId?: string | null;
  readonly surfaceId?: string | null;
  readonly level?: AgentGuidanceLevel;
}

export interface AgentGuidanceQueryProjection {
  readonly inputProviderId: string | null;
  readonly canonicalProviderId: AgentGuidanceProviderId | null;
  readonly surfaceId: string | null;
  readonly level: AgentGuidanceLevel;
  readonly aliasApplied: boolean;
}

export interface AgentGuidanceStaleness {
  readonly status: AgentGuidanceStalenessStatus;
  readonly verifiedAt: string | null;
  readonly reviewAfter: string | null;
  readonly basisDate: string;
}

export interface AgentGuidanceArtifact {
  readonly artifactId: string;
  readonly path: string | null;
  readonly scopeIds: readonly AgentGuidanceScopeId[];
  readonly primary: boolean;
  readonly supportStatus: AgentGuidanceSupportStatus;
  readonly statusEvidence: AgentGuidanceProjectedStatusEvidence;
}

export interface AgentGuidanceProjectedStatusEvidence {
  readonly evidenceKind: AgentGuidanceEvidenceKind;
  readonly sourceIds: readonly string[];
  readonly facts: readonly string[];
  readonly description: GuidanceDescription | null;
}

export interface AgentGuidanceSurface {
  readonly surfaceId: AgentGuidanceSurfaceId;
  readonly supportStatus: AgentGuidanceSupportStatus;
  readonly primaryArtifactId: string | null;
  readonly artifactResolution: AgentGuidanceArtifactResolution;
  readonly providerTerms: readonly string[];
  readonly scopes: readonly AgentGuidanceScopeId[];
  readonly artifacts: readonly AgentGuidanceArtifact[];
  readonly guidanceIds: readonly string[];
  readonly riskIds: readonly string[];
  readonly statusEvidence: AgentGuidanceProjectedStatusEvidence;
  readonly staleness: AgentGuidanceStaleness;
}

export interface AgentGuidanceProvider {
  readonly providerId: AgentGuidanceProviderId;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly availableSurfaceIds: readonly AgentGuidanceSurfaceId[];
  readonly surfaces: readonly AgentGuidanceSurface[];
}

export interface AgentGuidanceRecord {
  readonly guidanceId: string;
  readonly origin: AgentGuidanceOrigin;
  readonly directive: AgentGuidanceDirective;
  readonly surfaceIds: readonly AgentGuidanceSurfaceId[];
  readonly description: GuidanceDescription | null;
}

export interface AgentGuidanceRisk {
  readonly riskId: string;
  readonly kind: AgentGuidanceRiskKind;
  readonly surfaceIds: readonly AgentGuidanceSurfaceId[];
  readonly mitigationGuidanceIds: readonly string[];
  readonly description: GuidanceDescription | null;
}

export interface AgentGuidanceSource {
  readonly sourceId: string;
  readonly providerId: AgentGuidanceProviderId;
  readonly title: string | null;
  readonly url: string | null;
  readonly verifiedAt: string;
}

export interface AgentGuidanceCapabilities {
  readonly readsProjectFiles: false;
  readonly writesFiles: false;
  readonly executesHooks: false;
  readonly executesCommands: false;
  readonly accessesNetwork: false;
  readonly readsProviderState: false;
  readonly writesProviderState: false;
}

export interface AgentGuidanceResult {
  readonly schemaVersion: "Perttool.AgentGuidanceResult.v1";
  readonly guidanceInterfaceVersion: 1;
  readonly profileSchemaVersion: "Perttool.AgentGuidanceProfile.v1";
  readonly profileDataVersion: 1;
  readonly guidanceTaxonomyVersion: 1;
  readonly riskTaxonomyVersion: 1;
  readonly descriptionRegistryVersion: 1;
  readonly descriptionLocale: "en";
  readonly stalenessPolicyVersion: 1;
  readonly toolVersion: string;
  readonly operation: "agent.help";
  readonly ok: boolean;
  readonly profileDigest: string;
  readonly snapshotAsOf: string;
  readonly query: AgentGuidanceQueryProjection;
  readonly providers: readonly AgentGuidanceProvider[];
  readonly guidanceRecords: readonly AgentGuidanceRecord[];
  readonly riskRecords: readonly AgentGuidanceRisk[];
  readonly sources: readonly AgentGuidanceSource[];
  readonly capabilities: AgentGuidanceCapabilities;
  readonly diagnostics: readonly AgentGuidanceDiagnostic[];
}
