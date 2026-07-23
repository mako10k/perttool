import { compareStableStrings } from "../model/diagnostics.js";
import { AGENT_GUIDANCE_SNAPSHOT_V1 } from "./profile.js";
import {
  deriveAgentGuidanceStaleness,
  projectAgentGuidance,
} from "./projection.js";
import {
  type AgentGuidanceDiagnostic,
  type AgentGuidanceLevel,
  type AgentGuidanceProfile,
  type AgentGuidanceProfileSnapshot,
  type AgentGuidanceProviderId,
  type AgentGuidanceQuery,
  type AgentGuidanceQueryProjection,
  type AgentGuidanceResult,
  type AgentGuidanceSurfaceProfile,
} from "./types.js";
import {
  createAgentGuidanceProfileSnapshot,
  validateAgentGuidanceProfile,
} from "./validator.js";

const levels: readonly AgentGuidanceLevel[] = ["index", "quick", "detail"];

function normalizeUsage(query: AgentGuidanceQuery): {
  readonly providerId: string | null;
  readonly surfaceId: string | null;
  readonly level: AgentGuidanceLevel;
} {
  const providerId = query.providerId ?? null;
  const surfaceId = query.surfaceId ?? null;
  if (surfaceId !== null && providerId === null) {
    throw new RangeError("surfaceId requires providerId");
  }
  const defaultLevel = providerId === null ? "index" : "quick";
  const candidateLevel: unknown = query.level ?? defaultLevel;
  if (
    typeof candidateLevel !== "string" ||
    !levels.includes(candidateLevel as AgentGuidanceLevel)
  ) {
    throw new RangeError("level must be index, quick, or detail");
  }
  return {
    providerId,
    surfaceId,
    level: candidateLevel as AgentGuidanceLevel,
  };
}

function emptyQueryProjection(
  providerId: string | null,
  surfaceId: string | null,
  level: AgentGuidanceLevel,
): AgentGuidanceQueryProjection {
  return {
    inputProviderId: providerId,
    canonicalProviderId: null,
    surfaceId,
    level,
    aliasApplied: false,
  };
}

function lookupQuery(
  profile: AgentGuidanceProfile,
  providerId: string | null,
  surfaceId: string | null,
  level: AgentGuidanceLevel,
): {
  readonly query: AgentGuidanceQueryProjection;
  readonly providers: AgentGuidanceProfile["providers"];
  readonly surfaces: readonly AgentGuidanceSurfaceProfile[];
  readonly diagnostics: readonly AgentGuidanceDiagnostic[];
} {
  if (providerId === null) {
    return {
      query: emptyQueryProjection(null, null, level),
      providers: profile.providers,
      surfaces: profile.providers.flatMap(({ surfaces }) => surfaces),
      diagnostics: [],
    };
  }

  const direct = profile.providers.find(
    ({ providerId: candidate }) => candidate === providerId,
  );
  const alias = profile.aliases.find(({ alias }) => alias === providerId);
  const canonicalProviderId: AgentGuidanceProviderId | null =
    direct?.providerId ?? alias?.providerId ?? null;
  if (canonicalProviderId === null) {
    return {
      query: emptyQueryProjection(providerId, surfaceId, level),
      providers: [],
      surfaces: [],
      diagnostics: [
        {
          code: "PTAGT-101",
          severity: "error",
          message: `Unknown agent guidance provider: ${providerId}`,
          providerId,
          surfaceId: null,
        },
      ],
    };
  }

  const provider = profile.providers.find(
    ({ providerId: candidate }) => candidate === canonicalProviderId,
  )!;
  const surfaces =
    surfaceId === null
      ? provider.surfaces
      : provider.surfaces.filter(
          ({ surfaceId: candidate }) => candidate === surfaceId,
        );
  const queryProjection: AgentGuidanceQueryProjection = {
    inputProviderId: providerId,
    canonicalProviderId,
    surfaceId,
    level,
    aliasApplied: alias !== undefined,
  };
  if (surfaceId !== null && surfaces.length === 0) {
    return {
      query: queryProjection,
      providers: [],
      surfaces: [],
      diagnostics: [
        {
          code: "PTAGT-102",
          severity: "error",
          message: `Unknown ${canonicalProviderId} agent guidance surface: ${surfaceId}`,
          providerId: canonicalProviderId,
          surfaceId,
        },
      ],
    };
  }
  return {
    query: queryProjection,
    providers: [provider],
    surfaces,
    diagnostics: [],
  };
}

function surfaceDiagnostics(
  profile: AgentGuidanceProfile,
  providerId: AgentGuidanceProviderId,
  surface: AgentGuidanceSurfaceProfile,
): readonly AgentGuidanceDiagnostic[] {
  const diagnostics: AgentGuidanceDiagnostic[] = [];
  if (surface.supportStatus === "unknown") {
    diagnostics.push({
      code: "PTAGT-201",
      severity: "warning",
      message: `Support status is unknown for ${providerId} ${surface.surfaceId}.`,
      providerId,
      surfaceId: surface.surfaceId,
    });
  }
  const staleness = deriveAgentGuidanceStaleness(
    surface,
    profile.snapshotAsOf,
  );
  if (staleness.status === "review_due") {
    diagnostics.push({
      code: "PTAGT-202",
      severity: "warning",
      message: `Profile review is due for ${providerId} ${surface.surfaceId}.`,
      providerId,
      surfaceId: surface.surfaceId,
    });
  } else if (staleness.status === "unknown") {
    diagnostics.push({
      code: "PTAGT-203",
      severity: "warning",
      message: `Profile staleness is unknown for ${providerId} ${surface.surfaceId}.`,
      providerId,
      surfaceId: surface.surfaceId,
    });
  }
  return diagnostics;
}

function sortDiagnostics(
  diagnostics: readonly AgentGuidanceDiagnostic[],
): readonly AgentGuidanceDiagnostic[] {
  return [...diagnostics].sort(
    (left, right) =>
      compareStableStrings(left.code, right.code) ||
      compareStableStrings(left.providerId ?? "", right.providerId ?? "") ||
      compareStableStrings(left.surfaceId ?? "", right.surfaceId ?? ""),
  );
}

export function getAgentGuidance(
  profileOrSnapshot: AgentGuidanceProfile | AgentGuidanceProfileSnapshot,
  query: AgentGuidanceQuery = {},
): AgentGuidanceResult {
  const snapshot =
    "profile" in profileOrSnapshot
      ? profileOrSnapshot
      : createAgentGuidanceProfileSnapshot(profileOrSnapshot);
  const normalized = normalizeUsage(query);
  const validation = validateAgentGuidanceProfile(snapshot);
  if (!validation.ok) {
    return projectAgentGuidance({
      profile: snapshot.profile,
      profileDigest: validation.profileDigest,
      query: emptyQueryProjection(
        normalized.providerId,
        normalized.surfaceId,
        normalized.level,
      ),
      providers: [],
      selectedSurfaces: [],
      diagnostics: validation.diagnostics,
      ok: false,
    });
  }

  const lookup = lookupQuery(
    snapshot.profile,
    normalized.providerId,
    normalized.surfaceId,
    normalized.level,
  );
  if (lookup.diagnostics.length > 0) {
    return projectAgentGuidance({
      profile: snapshot.profile,
      profileDigest: validation.profileDigest,
      query: lookup.query,
      providers: [],
      selectedSurfaces: [],
      diagnostics: lookup.diagnostics,
      ok: false,
    });
  }

  const diagnostics = lookup.providers.flatMap((provider) =>
    lookup.surfaces
      .filter((surface) => provider.surfaces.includes(surface))
      .flatMap((surface) =>
        surfaceDiagnostics(snapshot.profile, provider.providerId, surface),
      ),
  );
  return projectAgentGuidance({
    profile: snapshot.profile,
    profileDigest: validation.profileDigest,
    query: lookup.query,
    providers: lookup.providers,
    selectedSurfaces: lookup.surfaces,
    diagnostics: sortDiagnostics(diagnostics),
    ok: true,
  });
}

export function getBundledAgentGuidance(
  query: AgentGuidanceQuery = {},
): AgentGuidanceResult {
  return getAgentGuidance(AGENT_GUIDANCE_SNAPSHOT_V1, query);
}
