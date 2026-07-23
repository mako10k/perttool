import {
  type AgentGuidanceArtifact,
  type AgentGuidanceCapabilities,
  type AgentGuidanceDiagnostic,
  type AgentGuidanceLevel,
  type AgentGuidanceProfile,
  type AgentGuidanceProvider,
  type AgentGuidanceProviderProfile,
  type AgentGuidanceQueryProjection,
  type AgentGuidanceRecord,
  type AgentGuidanceResult,
  type AgentGuidanceRisk,
  type AgentGuidanceSource,
  type AgentGuidanceStaleness,
  type AgentGuidanceSurface,
  type AgentGuidanceSurfaceProfile,
  type GuidanceDescription,
} from "./types.js";
import { TOOL_VERSION } from "../version.js";

export const AGENT_GUIDANCE_READ_ONLY_CAPABILITIES: AgentGuidanceCapabilities =
  Object.freeze({
    readsProjectFiles: false,
    writesFiles: false,
    executesHooks: false,
    executesCommands: false,
    accessesNetwork: false,
    readsProviderState: false,
    writesProviderState: false,
  });

function projectDescription(
  value: GuidanceDescription,
  level: AgentGuidanceLevel,
): GuidanceDescription | null {
  return level === "detail" ? value : null;
}

function projectEvidence(
  value: AgentGuidanceSurfaceProfile["statusEvidence"],
  level: AgentGuidanceLevel,
) {
  return {
    evidenceKind: value.evidenceKind,
    sourceIds: value.sourceIds,
    facts: level === "detail" ? value.facts : [],
    description: projectDescription(value.description, level),
  };
}

export function deriveAgentGuidanceStaleness(
  surface: AgentGuidanceSurfaceProfile,
  snapshotAsOf: string,
): AgentGuidanceStaleness {
  const status =
    surface.verifiedAt === null || surface.reviewAfter === null
      ? "unknown"
      : snapshotAsOf > surface.reviewAfter
        ? "review_due"
        : "verified";
  return {
    status,
    verifiedAt: surface.verifiedAt,
    reviewAfter: surface.reviewAfter,
    basisDate: snapshotAsOf,
  };
}

function projectArtifact(
  surface: AgentGuidanceSurfaceProfile,
  artifact: AgentGuidanceSurfaceProfile["artifacts"][number],
  level: AgentGuidanceLevel,
): AgentGuidanceArtifact {
  return {
    artifactId: artifact.artifactId,
    path: surface.artifactResolution === "known" ? artifact.path : null,
    scopeIds: artifact.scopeIds,
    primary: artifact.primary,
    supportStatus: artifact.supportStatus,
    statusEvidence: projectEvidence(artifact.statusEvidence, level),
  };
}

function projectSurface(
  surface: AgentGuidanceSurfaceProfile,
  snapshotAsOf: string,
  level: AgentGuidanceLevel,
): AgentGuidanceSurface {
  return {
    surfaceId: surface.surfaceId,
    supportStatus: surface.supportStatus,
    primaryArtifactId: surface.primaryArtifactId,
    artifactResolution: surface.artifactResolution,
    providerTerms: level === "detail" ? surface.providerTerms : [],
    scopes: surface.scopes,
    artifacts: surface.artifacts.map((artifact) =>
      projectArtifact(surface, artifact, level),
    ),
    guidanceIds: surface.guidanceIds,
    riskIds: surface.riskIds,
    statusEvidence: projectEvidence(surface.statusEvidence, level),
    staleness: deriveAgentGuidanceStaleness(surface, snapshotAsOf),
  };
}

function projectProvider(
  provider: AgentGuidanceProviderProfile,
  selectedSurfaces: readonly AgentGuidanceSurfaceProfile[],
  snapshotAsOf: string,
  level: AgentGuidanceLevel,
): AgentGuidanceProvider {
  return {
    providerId: provider.providerId,
    displayName: provider.displayName,
    aliases: provider.aliases,
    availableSurfaceIds: selectedSurfaces.map(({ surfaceId }) => surfaceId),
    surfaces:
      level === "index"
        ? []
        : selectedSurfaces.map((surface) =>
            projectSurface(surface, snapshotAsOf, level),
          ),
  };
}

function collectClosure(
  profile: AgentGuidanceProfile,
  surfaces: readonly AgentGuidanceSurfaceProfile[],
) {
  const riskIds = new Set(surfaces.flatMap(({ riskIds: ids }) => ids));
  const risks = profile.riskRegistry.filter(({ riskId }) => riskIds.has(riskId));
  const guidanceIds = new Set(
    surfaces.flatMap(({ guidanceIds: ids }) => ids),
  );
  for (const risk of risks) {
    for (const guidanceId of risk.mitigationGuidanceIds) {
      guidanceIds.add(guidanceId);
    }
  }
  const sourceIds = new Set<string>();
  for (const surface of surfaces) {
    for (const sourceId of surface.statusEvidence.sourceIds) {
      sourceIds.add(sourceId);
    }
    for (const artifact of surface.artifacts) {
      for (const sourceId of artifact.statusEvidence.sourceIds) {
        sourceIds.add(sourceId);
      }
    }
  }
  return {
    guidance: profile.guidanceRegistry.filter(({ guidanceId }) =>
      guidanceIds.has(guidanceId),
    ),
    risks,
    sources: profile.sources.filter(({ sourceId }) => sourceIds.has(sourceId)),
  };
}

function projectGuidance(
  profile: AgentGuidanceProfile,
  surfaces: readonly AgentGuidanceSurfaceProfile[],
  level: AgentGuidanceLevel,
): {
  readonly guidanceRecords: readonly AgentGuidanceRecord[];
  readonly riskRecords: readonly AgentGuidanceRisk[];
  readonly sources: readonly AgentGuidanceSource[];
} {
  if (level === "index") {
    return {
      guidanceRecords: [],
      riskRecords: [],
      sources: [],
    };
  }
  const closure = collectClosure(profile, surfaces);
  return {
    guidanceRecords: closure.guidance.map((record) => ({
      guidanceId: record.guidanceId,
      origin: record.origin,
      directive: record.directive,
      surfaceIds: record.surfaceIds,
      description: projectDescription(record.description, level),
    })),
    riskRecords: closure.risks.map((record) => ({
      riskId: record.riskId,
      kind: record.kind,
      surfaceIds: record.surfaceIds,
      mitigationGuidanceIds: record.mitigationGuidanceIds,
      description: projectDescription(record.description, level),
    })),
    sources: closure.sources.map((source) => ({
      sourceId: source.sourceId,
      providerId: source.providerId,
      title: level === "detail" ? source.title : null,
      url: level === "detail" ? source.url : null,
      verifiedAt: source.verifiedAt,
    })),
  };
}

export interface AgentGuidanceProjectionInput {
  readonly profile: AgentGuidanceProfile;
  readonly profileDigest: string;
  readonly query: AgentGuidanceQueryProjection;
  readonly providers: readonly AgentGuidanceProviderProfile[];
  readonly selectedSurfaces: readonly AgentGuidanceSurfaceProfile[];
  readonly diagnostics: readonly AgentGuidanceDiagnostic[];
  readonly ok: boolean;
}

export function projectAgentGuidance(
  input: AgentGuidanceProjectionInput,
): AgentGuidanceResult {
  const closure = projectGuidance(
    input.profile,
    input.selectedSurfaces,
    input.query.level,
  );
  return {
    schemaVersion: "Perttool.AgentGuidanceResult.v1",
    guidanceInterfaceVersion: 1,
    profileSchemaVersion: input.profile.schemaVersion,
    profileDataVersion: input.profile.profileDataVersion,
    guidanceTaxonomyVersion: input.profile.guidanceTaxonomyVersion,
    riskTaxonomyVersion: input.profile.riskTaxonomyVersion,
    descriptionRegistryVersion: input.profile.descriptionRegistryVersion,
    descriptionLocale: input.profile.descriptionLocale,
    stalenessPolicyVersion: input.profile.stalenessPolicyVersion,
    toolVersion: TOOL_VERSION,
    operation: "agent.help",
    ok: input.ok,
    profileDigest: input.profileDigest,
    snapshotAsOf: input.profile.snapshotAsOf,
    query: input.query,
    providers: input.providers.map((provider) => {
      const selectedSurfaces = input.selectedSurfaces.filter((surface) =>
        provider.surfaces.includes(surface),
      );
      return projectProvider(
        provider,
        selectedSurfaces,
        input.profile.snapshotAsOf,
        input.query.level,
      );
    }),
    guidanceRecords: closure.guidanceRecords,
    riskRecords: closure.riskRecords,
    sources: closure.sources,
    capabilities: AGENT_GUIDANCE_READ_ONLY_CAPABILITIES,
    diagnostics: input.diagnostics,
  };
}

function descriptionJson(value: GuidanceDescription | null) {
  if (value === null) return null;
  return {
    key: value.key,
    parameters: value.parameters.map(({ name, value: parameterValue }) => ({
      name,
      value: parameterValue,
    })),
    text: value.text,
  };
}

function evidenceJson(
  value: AgentGuidanceSurface["statusEvidence"],
): Readonly<Record<string, unknown>> {
  return {
    evidence_kind: value.evidenceKind,
    source_ids: value.sourceIds,
    facts: value.facts,
    description: descriptionJson(value.description),
  };
}

export function agentGuidanceResultToJson(
  result: AgentGuidanceResult,
): Readonly<Record<string, unknown>> {
  return {
    schema_version: result.schemaVersion,
    guidance_interface_version: result.guidanceInterfaceVersion,
    profile_schema_version: result.profileSchemaVersion,
    profile_data_version: result.profileDataVersion,
    guidance_taxonomy_version: result.guidanceTaxonomyVersion,
    risk_taxonomy_version: result.riskTaxonomyVersion,
    description_registry_version: result.descriptionRegistryVersion,
    description_locale: result.descriptionLocale,
    staleness_policy_version: result.stalenessPolicyVersion,
    tool_version: result.toolVersion,
    operation: result.operation,
    ok: result.ok,
    profile_digest: result.profileDigest,
    snapshot_as_of: result.snapshotAsOf,
    query: {
      input_provider_id: result.query.inputProviderId,
      canonical_provider_id: result.query.canonicalProviderId,
      surface_id: result.query.surfaceId,
      level: result.query.level,
      alias_applied: result.query.aliasApplied,
    },
    providers: result.providers.map((provider) => ({
      provider_id: provider.providerId,
      display_name: provider.displayName,
      aliases: provider.aliases,
      available_surface_ids: provider.availableSurfaceIds,
      surfaces: provider.surfaces.map((surface) => ({
        surface_id: surface.surfaceId,
        support_status: surface.supportStatus,
        primary_artifact_id: surface.primaryArtifactId,
        artifact_resolution: surface.artifactResolution,
        provider_terms: surface.providerTerms,
        scopes: surface.scopes,
        artifacts: surface.artifacts.map((artifact) => ({
          artifact_id: artifact.artifactId,
          path: artifact.path,
          scope_ids: artifact.scopeIds,
          primary: artifact.primary,
          support_status: artifact.supportStatus,
          status_evidence: evidenceJson(artifact.statusEvidence),
        })),
        guidance_ids: surface.guidanceIds,
        risk_ids: surface.riskIds,
        status_evidence: evidenceJson(surface.statusEvidence),
        staleness: {
          status: surface.staleness.status,
          verified_at: surface.staleness.verifiedAt,
          review_after: surface.staleness.reviewAfter,
          basis_date: surface.staleness.basisDate,
        },
      })),
    })),
    guidance_records: result.guidanceRecords.map((record) => ({
      guidance_id: record.guidanceId,
      origin: record.origin,
      directive: record.directive,
      surface_ids: record.surfaceIds,
      description: descriptionJson(record.description),
    })),
    risk_records: result.riskRecords.map((record) => ({
      risk_id: record.riskId,
      kind: record.kind,
      surface_ids: record.surfaceIds,
      mitigation_guidance_ids: record.mitigationGuidanceIds,
      description: descriptionJson(record.description),
    })),
    sources: result.sources.map((source) => ({
      source_id: source.sourceId,
      provider_id: source.providerId,
      title: source.title,
      url: source.url,
      verified_at: source.verifiedAt,
    })),
    capabilities: {
      reads_project_files: result.capabilities.readsProjectFiles,
      writes_files: result.capabilities.writesFiles,
      executes_hooks: result.capabilities.executesHooks,
      executes_commands: result.capabilities.executesCommands,
      accesses_network: result.capabilities.accessesNetwork,
      reads_provider_state: result.capabilities.readsProviderState,
      writes_provider_state: result.capabilities.writesProviderState,
    },
    diagnostics: result.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      provider_id: diagnostic.providerId,
      surface_id: diagnostic.surfaceId,
    })),
  };
}

export function serializeAgentGuidanceResult(
  result: AgentGuidanceResult,
): string {
  return `${JSON.stringify(agentGuidanceResultToJson(result), null, 2)}\n`;
}
