import { sha256DigestUtf8 } from "../model/sha256.js";
import { compareStableStrings } from "../model/diagnostics.js";
import {
  AGENT_GUIDANCE_DIRECTIVES,
  AGENT_GUIDANCE_ORIGINS,
  AGENT_GUIDANCE_PROVIDER_IDS,
  AGENT_GUIDANCE_RISK_KINDS,
  AGENT_GUIDANCE_SCOPE_IDS,
  AGENT_GUIDANCE_SUPPORT_STATUSES,
  AGENT_GUIDANCE_SURFACE_IDS,
  type AgentGuidanceArtifactProfile,
  type AgentGuidanceDiagnostic,
  type AgentGuidanceEvidenceKind,
  type AgentGuidanceProfile,
  type AgentGuidanceProfileSnapshot,
  type AgentGuidanceProfileValidationResult,
  type AgentGuidanceProviderId,
  type AgentGuidanceScopeId,
  type AgentGuidanceStatusEvidence,
  type AgentGuidanceSupportStatus,
  type GuidanceDescription,
} from "./types.js";

const evidenceKinds: Readonly<
  Record<AgentGuidanceSupportStatus, AgentGuidanceEvidenceKind>
> = {
  native: "official_native_documentation",
  compatible: "official_compatibility_documentation",
  preview: "official_preview_notice",
  deprecated: "official_deprecation_notice",
  unsupported: "official_unsupported_notice",
  unknown: "insufficient_official_evidence",
};

export function compareAgentGuidanceUtf8(
  left: string,
  right: string,
): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function descriptionJson(description: GuidanceDescription) {
  return {
    key: description.key,
    parameters: description.parameters.map(({ name, value }) => ({
      name,
      value,
    })),
    text: description.text,
  };
}

function evidenceJson(evidence: AgentGuidanceStatusEvidence) {
  return {
    evidence_kind: evidence.evidenceKind,
    source_ids: evidence.sourceIds,
    facts: evidence.facts,
    description: descriptionJson(evidence.description),
  };
}

function artifactJson(artifact: AgentGuidanceArtifactProfile) {
  return {
    artifact_id: artifact.artifactId,
    path: artifact.path,
    scope_ids: artifact.scopeIds,
    primary: artifact.primary,
    support_status: artifact.supportStatus,
    status_evidence: evidenceJson(artifact.statusEvidence),
  };
}

export function agentGuidanceProfileToJson(
  profile: AgentGuidanceProfile,
): Readonly<Record<string, unknown>> {
  return {
    schema_version: profile.schemaVersion,
    profile_data_version: profile.profileDataVersion,
    guidance_taxonomy_version: profile.guidanceTaxonomyVersion,
    risk_taxonomy_version: profile.riskTaxonomyVersion,
    description_registry_version: profile.descriptionRegistryVersion,
    description_locale: profile.descriptionLocale,
    staleness_policy_version: profile.stalenessPolicyVersion,
    snapshot_as_of: profile.snapshotAsOf,
    provider_order: profile.providerOrder,
    surface_order: profile.surfaceOrder,
    aliases: profile.aliases.map(({ alias, providerId }) => ({
      alias,
      provider_id: providerId,
    })),
    providers: profile.providers.map((provider) => ({
      provider_id: provider.providerId,
      display_name: provider.displayName,
      aliases: provider.aliases,
      surfaces: provider.surfaces.map((surface) => ({
        surface_id: surface.surfaceId,
        support_status: surface.supportStatus,
        primary_artifact_id: surface.primaryArtifactId,
        artifact_resolution: surface.artifactResolution,
        provider_terms: surface.providerTerms,
        scopes: surface.scopes,
        artifacts: surface.artifacts.map(artifactJson),
        guidance_ids: surface.guidanceIds,
        risk_ids: surface.riskIds,
        status_evidence: evidenceJson(surface.statusEvidence),
        verified_at: surface.verifiedAt,
        review_after: surface.reviewAfter,
      })),
    })),
    guidance_registry: profile.guidanceRegistry.map((record) => ({
      guidance_id: record.guidanceId,
      origin: record.origin,
      directive: record.directive,
      surface_ids: record.surfaceIds,
      description: descriptionJson(record.description),
    })),
    risk_registry: profile.riskRegistry.map((record) => ({
      risk_id: record.riskId,
      kind: record.kind,
      surface_ids: record.surfaceIds,
      mitigation_guidance_ids: record.mitigationGuidanceIds,
      description: descriptionJson(record.description),
    })),
    sources: profile.sources.map((source) => ({
      source_id: source.sourceId,
      provider_id: source.providerId,
      title: source.title,
      url: source.url,
      verified_at: source.verifiedAt,
    })),
  };
}

export function serializeAgentGuidanceProfile(
  profile: AgentGuidanceProfile,
): string {
  return `${JSON.stringify(agentGuidanceProfileToJson(profile), null, 2)}\n`;
}

export function digestAgentGuidanceProfile(canonicalJson: string): string {
  return sha256DigestUtf8(canonicalJson);
}

export function createAgentGuidanceProfileSnapshot(
  profile: AgentGuidanceProfile,
): AgentGuidanceProfileSnapshot {
  const canonicalJson = serializeAgentGuidanceProfile(profile);
  return {
    profile,
    canonicalJson,
    profileDigest: digestAgentGuidanceProfile(canonicalJson),
  };
}

function diagnostic(
  code: string,
  message: string,
  providerId: string | null = null,
  surfaceId: string | null = null,
): AgentGuidanceDiagnostic {
  return {
    code,
    severity: "error",
    message,
    providerId,
    surfaceId,
  };
}

function sameStrings(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function isCanonicalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isCanonicalOptionalDate(value: string | null): boolean {
  return value === null || isCanonicalDate(value);
}

function isCanonicalSubset<T extends string>(
  actual: readonly T[],
  canonical: readonly T[],
  allowEmpty: boolean,
): boolean {
  if ((!allowEmpty && actual.length === 0) || new Set(actual).size !== actual.length) {
    return false;
  }
  let previous = -1;
  for (const value of actual) {
    const index = canonical.indexOf(value);
    if (index <= previous) return false;
    previous = index;
  }
  return true;
}

const scopeRank = new Map(
  AGENT_GUIDANCE_SCOPE_IDS.map((scopeId, index) => [scopeId, index]),
);

function compareArtifacts(
  left: AgentGuidanceArtifactProfile,
  right: AgentGuidanceArtifactProfile,
): number {
  return (
    Number(right.primary) - Number(left.primary) ||
    (scopeRank.get(left.scopeIds[0]!) ?? Number.MAX_SAFE_INTEGER) -
      (scopeRank.get(right.scopeIds[0]!) ?? Number.MAX_SAFE_INTEGER) ||
    compareAgentGuidanceUtf8(left.path, right.path) ||
    compareAgentGuidanceUtf8(left.artifactId, right.artifactId)
  );
}

function checkDescription(
  value: GuidanceDescription,
  expectedKey: string,
  registry: Map<string, string>,
  diagnostics: AgentGuidanceDiagnostic[],
  providerId: string | null,
  surfaceId: string | null,
): void {
  if (
    value.key !== expectedKey ||
    value.parameters.some(
      ({ name, value: parameterValue }) =>
        name.length === 0 || parameterValue.length === 0,
    ) ||
    value.text.length === 0
  ) {
    diagnostics.push(
      diagnostic(
        "PTAGT-303",
        `Description ${expectedKey} does not match the canonical registry shape.`,
        providerId,
        surfaceId,
      ),
    );
    return;
  }
  const signature = `${value.key}\u0000${JSON.stringify(value.parameters)}`;
  const registered = registry.get(signature);
  if (registered !== undefined && registered !== value.text) {
    diagnostics.push(
      diagnostic(
        "PTAGT-303",
        `Description ${expectedKey} has conflicting canonical text.`,
        providerId,
        surfaceId,
      ),
    );
    return;
  }
  registry.set(signature, value.text);
}

function checkEvidence(
  value: AgentGuidanceStatusEvidence,
  status: AgentGuidanceSupportStatus,
  sourceProvider: ReadonlyMap<string, AgentGuidanceProviderId>,
  providerId: AgentGuidanceProviderId,
  surfaceId: string,
  descriptionRegistry: Map<string, string>,
  diagnostics: AgentGuidanceDiagnostic[],
): void {
  if (
    value.evidenceKind !== evidenceKinds[status] ||
    value.sourceIds.length === 0 ||
    new Set(value.sourceIds).size !== value.sourceIds.length ||
    value.facts.length === 0 ||
    value.facts.some((fact) => fact.length === 0)
  ) {
    diagnostics.push(
      diagnostic(
        "PTAGT-302",
        `Support evidence does not match status ${status}.`,
        providerId,
        surfaceId,
      ),
    );
  }
  for (const sourceId of value.sourceIds) {
    if (sourceProvider.get(sourceId) !== providerId) {
      diagnostics.push(
        diagnostic(
          "PTAGT-302",
          `Source ${sourceId} is missing or belongs to another provider.`,
          providerId,
          surfaceId,
        ),
      );
    }
  }
  checkDescription(
    value.description,
    `status.${status}`,
    descriptionRegistry,
    diagnostics,
    providerId,
    surfaceId,
  );
}

function sortValidationDiagnostics(
  diagnostics: readonly AgentGuidanceDiagnostic[],
): readonly AgentGuidanceDiagnostic[] {
  return [...diagnostics].sort(
    (left, right) =>
      compareStableStrings(left.code, right.code) ||
      compareStableStrings(left.providerId ?? "", right.providerId ?? "") ||
      compareStableStrings(left.surfaceId ?? "", right.surfaceId ?? "") ||
      compareStableStrings(left.message, right.message),
  );
}

function isAbsoluteHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

export function validateAgentGuidanceProfile(
  profileOrSnapshot: AgentGuidanceProfile | AgentGuidanceProfileSnapshot,
): AgentGuidanceProfileValidationResult {
  const snapshot =
    "profile" in profileOrSnapshot
      ? profileOrSnapshot
      : createAgentGuidanceProfileSnapshot(profileOrSnapshot);
  const { profile } = snapshot;
  const diagnostics: AgentGuidanceDiagnostic[] = [];
  const canonicalJson = serializeAgentGuidanceProfile(profile);
  const profileDigest = digestAgentGuidanceProfile(canonicalJson);

  if (
    snapshot.canonicalJson !== canonicalJson ||
    snapshot.profileDigest !== profileDigest
  ) {
    diagnostics.push(
      diagnostic(
        "PTAGT-303",
        "Profile canonical bytes or digest do not match the supplied snapshot.",
      ),
    );
  }

  if (
    profile.schemaVersion !== "Perttool.AgentGuidanceProfile.v1" ||
    profile.profileDataVersion !== 1 ||
    profile.guidanceTaxonomyVersion !== 1 ||
    profile.riskTaxonomyVersion !== 1 ||
    profile.descriptionRegistryVersion !== 1 ||
    profile.descriptionLocale !== "en" ||
    profile.stalenessPolicyVersion !== 1
  ) {
    diagnostics.push(
      diagnostic(
        "PTAGT-301",
        "The profile uses an unsupported version identity combination.",
      ),
    );
  }

  if (
    !isCanonicalDate(profile.snapshotAsOf) ||
    !sameStrings(profile.providerOrder, AGENT_GUIDANCE_PROVIDER_IDS) ||
    !sameStrings(profile.surfaceOrder, AGENT_GUIDANCE_SURFACE_IDS)
  ) {
    diagnostics.push(
      diagnostic(
        "PTAGT-302",
        "Profile date, provider order, or surface order is invalid.",
      ),
    );
  }

  const providerIds = new Set(profile.providers.map(({ providerId }) => providerId));
  if (
    profile.providers.length !== AGENT_GUIDANCE_PROVIDER_IDS.length ||
    providerIds.size !== profile.providers.length ||
    !sameStrings(
      profile.providers.map(({ providerId }) => providerId),
      AGENT_GUIDANCE_PROVIDER_IDS,
    )
  ) {
    diagnostics.push(
      diagnostic(
        "PTAGT-302",
        "Providers must be complete, unique, and canonically ordered.",
      ),
    );
  }

  const aliases = new Set<string>();
  const canonicalProviderIds = new Set<string>(AGENT_GUIDANCE_PROVIDER_IDS);
  for (const { alias, providerId } of profile.aliases) {
    if (
      alias.length === 0 ||
      aliases.has(alias) ||
      canonicalProviderIds.has(alias) ||
      !providerIds.has(providerId)
    ) {
      diagnostics.push(
        diagnostic(
          "PTAGT-302",
          `Alias ${alias} is duplicated, colliding, or has an unknown target.`,
          providerId,
        ),
      );
    }
    aliases.add(alias);
  }
  if (
    !sameStrings(
      profile.aliases.map(({ alias }) => alias),
      ["grok"],
    ) ||
    profile.aliases[0]?.providerId !== "grok-build"
  ) {
    diagnostics.push(
      diagnostic("PTAGT-302", "Version 1 aliases do not match the contract."),
    );
  }

  const sourceProvider = new Map<string, AgentGuidanceProviderId>();
  const expectedSources = [...profile.sources].sort(
    (left, right) =>
      AGENT_GUIDANCE_PROVIDER_IDS.indexOf(left.providerId) -
        AGENT_GUIDANCE_PROVIDER_IDS.indexOf(right.providerId) ||
      compareAgentGuidanceUtf8(left.sourceId, right.sourceId),
  );
  if (
    !sameStrings(
      profile.sources.map(({ sourceId }) => sourceId),
      expectedSources.map(({ sourceId }) => sourceId),
    )
  ) {
    diagnostics.push(
      diagnostic("PTAGT-302", "Sources are not canonically ordered."),
    );
  }
  for (const source of profile.sources) {
    if (
      sourceProvider.has(source.sourceId) ||
      !providerIds.has(source.providerId) ||
      source.title.length === 0 ||
      !isAbsoluteHttpsUrl(source.url) ||
      !isCanonicalDate(source.verifiedAt) ||
      source.verifiedAt > profile.snapshotAsOf
    ) {
      diagnostics.push(
        diagnostic(
          "PTAGT-302",
          `Source ${source.sourceId} is invalid.`,
          source.providerId,
        ),
      );
    }
    sourceProvider.set(source.sourceId, source.providerId);
  }

  const descriptionRegistry = new Map<string, string>();
  const guidanceIds = new Set<string>();
  let previousOrigin = -1;
  for (const guidance of profile.guidanceRegistry) {
    const originIndex = AGENT_GUIDANCE_ORIGINS.indexOf(guidance.origin);
    if (
      guidanceIds.has(guidance.guidanceId) ||
      originIndex < previousOrigin ||
      !AGENT_GUIDANCE_DIRECTIVES.includes(guidance.directive) ||
      !isCanonicalSubset(guidance.surfaceIds, AGENT_GUIDANCE_SURFACE_IDS, true) ||
      (guidance.origin === "project_control" &&
        (guidance.directive !== "must" || guidance.surfaceIds.length !== 0))
    ) {
      diagnostics.push(
        diagnostic(
          "PTAGT-302",
          `Guidance ${guidance.guidanceId} violates taxonomy or composition order.`,
        ),
      );
    }
    previousOrigin = originIndex;
    guidanceIds.add(guidance.guidanceId);
    checkDescription(
      guidance.description,
      `guidance.${guidance.guidanceId}`,
      descriptionRegistry,
      diagnostics,
      null,
      null,
    );
  }

  const riskIds = new Set<string>();
  for (const risk of profile.riskRegistry) {
    if (
      riskIds.has(risk.riskId) ||
      !AGENT_GUIDANCE_RISK_KINDS.includes(risk.kind) ||
      !isCanonicalSubset(risk.surfaceIds, AGENT_GUIDANCE_SURFACE_IDS, false) ||
      risk.mitigationGuidanceIds.length === 0 ||
      new Set(risk.mitigationGuidanceIds).size !==
        risk.mitigationGuidanceIds.length ||
      risk.mitigationGuidanceIds.some(
        (guidanceId) => !guidanceIds.has(guidanceId),
      )
    ) {
      diagnostics.push(
        diagnostic(
          "PTAGT-302",
          `Risk ${risk.riskId} violates taxonomy or reference closure.`,
        ),
      );
    }
    riskIds.add(risk.riskId);
    checkDescription(
      risk.description,
      `risk.${risk.riskId}`,
      descriptionRegistry,
      diagnostics,
      null,
      null,
    );
  }

  for (const provider of profile.providers) {
    const expectedAliases = profile.aliases
      .filter(({ providerId }) => providerId === provider.providerId)
      .map(({ alias }) => alias);
    if (
      provider.displayName.length === 0 ||
      !sameStrings(provider.aliases, expectedAliases) ||
      !sameStrings(
        provider.surfaces.map(({ surfaceId }) => surfaceId),
        AGENT_GUIDANCE_SURFACE_IDS,
      )
    ) {
      diagnostics.push(
        diagnostic(
          "PTAGT-302",
          "Provider metadata or surface order is invalid.",
          provider.providerId,
        ),
      );
    }

    for (const surface of provider.surfaces) {
      if (
        !AGENT_GUIDANCE_SUPPORT_STATUSES.includes(surface.supportStatus) ||
        !isCanonicalSubset(surface.scopes, AGENT_GUIDANCE_SCOPE_IDS, false) ||
        surface.providerTerms.length === 0 ||
        new Set(surface.providerTerms).size !== surface.providerTerms.length
      ) {
        diagnostics.push(
          diagnostic(
            "PTAGT-302",
            "Surface status, terms, or scopes are invalid.",
            provider.providerId,
            surface.surfaceId,
          ),
        );
      }

      const primaryArtifacts = surface.artifacts.filter(({ primary }) => primary);
      const sortedArtifacts = [...surface.artifacts].sort(compareArtifacts);
      if (
        !sameStrings(
          surface.artifacts.map(({ artifactId }) => artifactId),
          sortedArtifacts.map(({ artifactId }) => artifactId),
        ) ||
        (surface.artifactResolution === "known" &&
          (surface.artifacts.length === 0 ||
            primaryArtifacts.length !== 1 ||
            surface.primaryArtifactId !== primaryArtifacts[0]?.artifactId)) ||
        (surface.artifactResolution !== "known" &&
          (surface.artifacts.length !== 0 ||
            primaryArtifacts.length !== 0 ||
            surface.primaryArtifactId !== null))
      ) {
        diagnostics.push(
          diagnostic(
            "PTAGT-302",
            "Artifact resolution, primary artifact, or ordering is invalid.",
            provider.providerId,
            surface.surfaceId,
          ),
        );
      }
      if (
        primaryArtifacts[0] !== undefined &&
        primaryArtifacts[0].supportStatus !== surface.supportStatus
      ) {
        diagnostics.push(
          diagnostic(
            "PTAGT-302",
            "Surface status does not match the primary artifact.",
            provider.providerId,
            surface.surfaceId,
          ),
        );
      }

      const artifactIds = new Set<string>();
      for (const artifact of surface.artifacts) {
        if (
          artifactIds.has(artifact.artifactId) ||
          artifact.path.length === 0 ||
          !AGENT_GUIDANCE_SUPPORT_STATUSES.includes(artifact.supportStatus) ||
          !isCanonicalSubset(artifact.scopeIds, AGENT_GUIDANCE_SCOPE_IDS, false)
        ) {
          diagnostics.push(
            diagnostic(
              "PTAGT-302",
              `Artifact ${artifact.artifactId} is invalid.`,
              provider.providerId,
              surface.surfaceId,
            ),
          );
        }
        artifactIds.add(artifact.artifactId);
        checkEvidence(
          artifact.statusEvidence,
          artifact.supportStatus,
          sourceProvider,
          provider.providerId,
          surface.surfaceId,
          descriptionRegistry,
          diagnostics,
        );
      }

      if (
        surface.guidanceIds.some((guidanceId) => !guidanceIds.has(guidanceId)) ||
        surface.riskIds.some((riskId) => !riskIds.has(riskId)) ||
        !sameStrings(
          surface.guidanceIds,
          profile.guidanceRegistry
            .filter(
              ({ surfaceIds }) =>
                surfaceIds.length === 0 ||
                surfaceIds.includes(surface.surfaceId),
            )
            .map(({ guidanceId }) => guidanceId),
        ) ||
        !sameStrings(
          surface.riskIds,
          profile.riskRegistry
            .filter(
              ({ riskId, surfaceIds }) =>
                surfaceIds.includes(surface.surfaceId) &&
                (riskId !== "artifact_path_unknown" ||
                  surface.artifactResolution === "unknown") &&
                (riskId !== "compatibility_not_native" ||
                  surface.artifacts.some(
                    ({ supportStatus }) => supportStatus === "compatible",
                  )),
            )
            .map(({ riskId }) => riskId),
        )
      ) {
        diagnostics.push(
          diagnostic(
            "PTAGT-302",
            "Surface guidance or risk references are not closed and ordered.",
            provider.providerId,
            surface.surfaceId,
          ),
        );
      }

      if (
        !isCanonicalOptionalDate(surface.verifiedAt) ||
        !isCanonicalOptionalDate(surface.reviewAfter) ||
        (surface.verifiedAt !== null &&
          surface.reviewAfter !== null &&
          surface.verifiedAt > surface.reviewAfter) ||
        (surface.verifiedAt !== null &&
          surface.verifiedAt > profile.snapshotAsOf)
      ) {
        diagnostics.push(
          diagnostic(
            "PTAGT-302",
            "Surface staleness dates are invalid.",
            provider.providerId,
            surface.surfaceId,
          ),
        );
      }

      checkEvidence(
        surface.statusEvidence,
        surface.supportStatus,
        sourceProvider,
        provider.providerId,
        surface.surfaceId,
        descriptionRegistry,
        diagnostics,
      );
    }
  }

  const sorted = sortValidationDiagnostics(diagnostics);
  return {
    ok: sorted.length === 0,
    profileDigest,
    diagnostics: sorted,
  };
}
