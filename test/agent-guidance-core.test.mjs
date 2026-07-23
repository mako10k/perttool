import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  AGENT_GUIDANCE_PROFILE_V1,
  AGENT_GUIDANCE_PROVIDER_IDS,
  AGENT_GUIDANCE_SNAPSHOT_V1,
  AGENT_GUIDANCE_SUPPORT_STATUSES,
  AGENT_GUIDANCE_SURFACE_IDS,
  agentGuidanceResultToJson,
  createAgentGuidanceProfileSnapshot,
  getAgentGuidance,
  getBundledAgentGuidance,
  serializeAgentGuidanceResult,
  validateAgentGuidanceProfile,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const baselinePath = path.join(
  testDirectory,
  "fixtures/agent-guidance/provider-baseline.v1.json",
);
const indexGoldenPath = path.join(
  testDirectory,
  "golden/agent-guidance/index.expected.json",
);

function mutableProfile() {
  return structuredClone(AGENT_GUIDANCE_PROFILE_V1);
}

function findSurface(profile, providerId, surfaceId) {
  const provider = profile.providers.find(
    ({ providerId: candidate }) => candidate === providerId,
  );
  assert.ok(provider, providerId);
  const surface = provider.surfaces.find(
    ({ surfaceId: candidate }) => candidate === surfaceId,
  );
  assert.ok(surface, `${providerId}:${surfaceId}`);
  return surface;
}

function statusEvidence(status, sourceIds) {
  const evidenceKinds = {
    native: "official_native_documentation",
    compatible: "official_compatibility_documentation",
    preview: "official_preview_notice",
    deprecated: "official_deprecation_notice",
    unsupported: "official_unsupported_notice",
    unknown: "insufficient_official_evidence",
  };
  const descriptions = {
    native: "Official documentation identifies a provider-native surface.",
    compatible:
      "Official documentation identifies compatibility with another provider format.",
    preview: "Official documentation identifies this surface as preview.",
    deprecated:
      "Official documentation identifies this surface as deprecated.",
    unsupported:
      "Official documentation explicitly identifies this surface as unavailable.",
    unknown:
      "The inspected official documentation is insufficient to classify support.",
  };
  return {
    evidenceKind: evidenceKinds[status],
    sourceIds,
    facts: [`Synthetic ${status} contract sentinel.`],
    description: {
      key: `status.${status}`,
      parameters: [],
      text: descriptions[status],
    },
  };
}

function replaceSurfaceStatus(profile, status) {
  const surface = findSurface(profile, "codex", "instruction");
  surface.supportStatus = status;
  surface.statusEvidence = statusEvidence(
    status,
    surface.statusEvidence.sourceIds,
  );
  const primary = surface.artifacts.find(({ primary }) => primary);
  assert.ok(primary);
  primary.supportStatus = status;
  primary.statusEvidence = statusEvidence(
    status,
    primary.statusEvidence.sourceIds,
  );
}

function assertReferenceClosure(result) {
  const guidanceIds = new Set(
    result.guidanceRecords.map(({ guidanceId }) => guidanceId),
  );
  const riskIds = new Set(result.riskRecords.map(({ riskId }) => riskId));
  const sourceIds = new Set(result.sources.map(({ sourceId }) => sourceId));
  for (const provider of result.providers) {
    for (const surface of provider.surfaces) {
      for (const guidanceId of surface.guidanceIds) {
        assert.ok(guidanceIds.has(guidanceId), guidanceId);
      }
      for (const riskId of surface.riskIds) {
        assert.ok(riskIds.has(riskId), riskId);
      }
      for (const sourceId of surface.statusEvidence.sourceIds) {
        assert.ok(sourceIds.has(sourceId), sourceId);
      }
      for (const artifact of surface.artifacts) {
        for (const sourceId of artifact.statusEvidence.sourceIds) {
          assert.ok(sourceIds.has(sourceId), sourceId);
        }
      }
    }
  }
  for (const risk of result.riskRecords) {
    for (const guidanceId of risk.mitigationGuidanceIds) {
      assert.ok(guidanceIds.has(guidanceId), `${risk.riskId}:${guidanceId}`);
    }
  }
}

test("bundled guidance profile validates and preserves the provider baseline", async () => {
  const validation = validateAgentGuidanceProfile(AGENT_GUIDANCE_SNAPSHOT_V1);
  assert.deepEqual(validation, {
    ok: true,
    profileDigest:
      "sha256:6af09aec1cd44bc5f4de46fdd68d2035d31a7260bfb7d2e3c994fdd7fc302921",
    diagnostics: [],
  });

  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  assert.deepEqual(
    AGENT_GUIDANCE_PROFILE_V1.providers.map(({ providerId }) => providerId),
    AGENT_GUIDANCE_PROVIDER_IDS,
  );
  assert.equal(
    AGENT_GUIDANCE_PROFILE_V1.sources.length,
    baseline.sources.length,
  );
  for (const source of AGENT_GUIDANCE_PROFILE_V1.sources) {
    const inputSource = baseline.sources.find(
      ({ source_id: sourceId }) => sourceId === source.sourceId,
    );
    assert.ok(inputSource, source.sourceId);
    assert.deepEqual(source, {
      sourceId: inputSource.source_id,
      providerId: inputSource.provider_id,
      title: inputSource.title,
      url: inputSource.url,
      verifiedAt: inputSource.verified_at,
    });
  }
  for (const provider of AGENT_GUIDANCE_PROFILE_V1.providers) {
    const input = baseline.providers.find(
      ({ provider_id: providerId }) => providerId === provider.providerId,
    );
    assert.ok(input, provider.providerId);
    assert.deepEqual(
      provider.surfaces.map(({ surfaceId }) => surfaceId),
      AGENT_GUIDANCE_SURFACE_IDS,
    );
    for (const surface of provider.surfaces) {
      const inputSurface = input.surfaces.find(
        ({ surface_id: surfaceId }) => surfaceId === surface.surfaceId,
      );
      assert.ok(inputSurface, `${provider.providerId}:${surface.surfaceId}`);
      assert.deepEqual(surface.providerTerms, inputSurface.provider_terms);
      assert.deepEqual(
        new Set(surface.artifacts.map(({ path: artifactPath }) => artifactPath)),
        new Set(inputSurface.artifacts.map(({ path: artifactPath }) => artifactPath)),
      );
    }
  }
});

test("index result has stable bytes and the complete canonical axes", async () => {
  const first = getBundledAgentGuidance();
  const second = getBundledAgentGuidance({
    providerId: null,
    surfaceId: null,
    level: "index",
  });
  const serialized = serializeAgentGuidanceResult(first);

  assert.equal(serialized, serializeAgentGuidanceResult(second));
  assert.equal(serialized, await readFile(indexGoldenPath, "utf8"));
  assert.deepEqual(
    first.providers.map(({ providerId }) => providerId),
    AGENT_GUIDANCE_PROVIDER_IDS,
  );
  assert.ok(
    first.providers.every(
      ({ availableSurfaceIds, surfaces }) =>
        assert.deepEqual(availableSurfaceIds, AGENT_GUIDANCE_SURFACE_IDS) ===
          undefined && surfaces.length === 0,
    ),
  );
  assert.deepEqual(first.guidanceRecords, []);
  assert.deepEqual(first.riskRecords, []);
  assert.deepEqual(first.sources, []);
  assert.ok(Object.values(first.capabilities).every((value) => value === false));
});

test("alias quick projection is canonical, ordered, and reference closed", () => {
  const result = getBundledAgentGuidance({
    providerId: "grok",
    surfaceId: "workflow",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.query, {
    inputProviderId: "grok",
    canonicalProviderId: "grok-build",
    surfaceId: "workflow",
    level: "quick",
    aliasApplied: true,
  });
  assert.equal(result.providers.length, 1);
  assert.equal(result.providers[0].providerId, "grok-build");
  assert.deepEqual(result.providers[0].availableSurfaceIds, ["workflow"]);
  assert.equal(result.providers[0].surfaces[0].supportStatus, "native");
  assert.ok(
    result.providers[0].surfaces[0].artifacts.some(
      ({ supportStatus }) => supportStatus === "compatible",
    ),
  );
  assert.ok(
    result.providers[0].surfaces[0].riskIds.includes(
      "compatibility_not_native",
    ),
  );
  assert.ok(
    result.guidanceRecords.every(({ description }) => description === null),
  );
  assert.ok(result.riskRecords.every(({ description }) => description === null));
  assert.ok(
    result.sources.every(({ title, url }) => title === null && url === null),
  );
  assertReferenceClosure(result);

  const directProfileResult = getAgentGuidance(AGENT_GUIDANCE_PROFILE_V1, {
    providerId: "grok",
    surfaceId: "workflow",
  });
  assert.equal(
    serializeAgentGuidanceResult(directProfileResult),
    serializeAgentGuidanceResult(result),
  );
});

test("detail projection adds descriptions, provider facts, and official sources", () => {
  const result = getBundledAgentGuidance({
    providerId: "codex",
    surfaceId: "enforcement",
    level: "detail",
  });
  const surface = result.providers[0].surfaces[0];

  assert.equal(result.ok, true);
  assert.deepEqual(surface.guidanceIds.slice(0, 8), [
    "project_plan_is_authority",
    "consult_dag_next_before_start",
    "recompute_after_state_change",
    "require_explicit_human_override",
    "keep_provider_priority_identical",
    "use_narrowest_durable_surface",
    "preserve_scope_and_precedence",
    "review_executable_customization",
  ]);
  assert.ok(surface.riskIds.includes("hook_executes_code"));
  assert.ok(surface.riskIds.includes("hook_can_block_or_mutate_flow"));
  assert.ok(surface.providerTerms.length > 0);
  assert.ok(surface.statusEvidence.facts.length > 0);
  assert.ok(surface.statusEvidence.description);
  assert.ok(result.guidanceRecords.every(({ description }) => description));
  assert.ok(result.riskRecords.every(({ description }) => description));
  assert.ok(
    result.sources.every(
      ({ title, url }) =>
        typeof title === "string" && url?.startsWith("https://"),
    ),
  );
  assertReferenceClosure(result);
});

test("unknown provider and surface return complete failed envelopes", () => {
  for (const providerId of ["Grok", "grok_build", "copilot", "claude"]) {
    const result = getBundledAgentGuidance({ providerId });
    assert.equal(result.ok, false);
    assert.equal(result.query.canonicalProviderId, null);
    assert.equal(result.diagnostics[0].code, "PTAGT-101");
    assert.deepEqual(result.providers, []);
    assert.deepEqual(result.guidanceRecords, []);
    assert.deepEqual(result.riskRecords, []);
    assert.deepEqual(result.sources, []);
  }

  const surface = getBundledAgentGuidance({
    providerId: "codex",
    surfaceId: "policy",
  });
  assert.equal(surface.ok, false);
  assert.equal(surface.query.canonicalProviderId, "codex");
  assert.equal(surface.diagnostics[0].code, "PTAGT-102");
  assert.deepEqual(surface.providers, []);
});

test("index surface filter preserves identity without leaking details", () => {
  const result = getBundledAgentGuidance({
    providerId: "github-copilot",
    surfaceId: "prompt",
    level: "index",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.providers[0].availableSurfaceIds, ["prompt"]);
  assert.deepEqual(result.providers[0].surfaces, []);
  assert.deepEqual(result.guidanceRecords, []);
  assert.deepEqual(result.riskRecords, []);
  assert.deepEqual(result.sources, []);
});

test("all support states are accepted while unknown alone emits a warning", () => {
  assert.deepEqual(AGENT_GUIDANCE_SUPPORT_STATUSES, [
    "native",
    "compatible",
    "preview",
    "deprecated",
    "unsupported",
    "unknown",
  ]);
  assert.equal(
    getBundledAgentGuidance({
      providerId: "codex",
      surfaceId: "prompt",
    }).providers[0].surfaces[0].supportStatus,
    "deprecated",
  );
  assert.equal(
    getBundledAgentGuidance({
      providerId: "github-copilot",
      surfaceId: "prompt",
    }).providers[0].surfaces[0].supportStatus,
    "preview",
  );
  const capability = getBundledAgentGuidance({
    providerId: "antigravity",
    surfaceId: "delegated_agent",
  }).providers[0].surfaces[0];
  assert.equal(capability.supportStatus, "native");
  assert.equal(capability.artifactResolution, "unknown");
  assert.equal(capability.primaryArtifactId, null);
  assert.deepEqual(capability.artifacts, []);

  for (const status of ["unsupported", "unknown"]) {
    const profile = mutableProfile();
    replaceSurfaceStatus(profile, status);
    const snapshot = createAgentGuidanceProfileSnapshot(profile);
    assert.equal(validateAgentGuidanceProfile(snapshot).ok, true);

    const result = getAgentGuidance(snapshot, {
      providerId: "codex",
      surfaceId: "instruction",
    });
    assert.equal(result.ok, true);
    assert.equal(result.providers[0].surfaces[0].supportStatus, status);
    assert.deepEqual(
      result.diagnostics.map(({ code }) => code),
      status === "unknown" ? ["PTAGT-201"] : [],
    );
  }
});

test("staleness is derived only from fixed profile dates", () => {
  const reviewDueProfile = mutableProfile();
  const reviewDue = findSurface(reviewDueProfile, "codex", "instruction");
  reviewDue.verifiedAt = "2026-04-01";
  reviewDue.reviewAfter = "2026-07-01";
  const reviewDueResult = getAgentGuidance(
    createAgentGuidanceProfileSnapshot(reviewDueProfile),
    { providerId: "codex", surfaceId: "instruction" },
  );
  assert.equal(
    reviewDueResult.providers[0].surfaces[0].staleness.status,
    "review_due",
  );
  assert.deepEqual(
    reviewDueResult.diagnostics.map(({ code }) => code),
    ["PTAGT-202"],
  );

  const unknownProfile = mutableProfile();
  const unknown = findSurface(unknownProfile, "codex", "instruction");
  unknown.verifiedAt = null;
  unknown.reviewAfter = null;
  const unknownResult = getAgentGuidance(
    createAgentGuidanceProfileSnapshot(unknownProfile),
    { providerId: "codex", surfaceId: "instruction" },
  );
  assert.equal(
    unknownResult.providers[0].surfaces[0].staleness.status,
    "unknown",
  );
  assert.deepEqual(
    unknownResult.diagnostics.map(({ code }) => code),
    ["PTAGT-203"],
  );
});

test("validator fails closed for versions, references, descriptions, and digest", () => {
  const unsupportedVersion = mutableProfile();
  unsupportedVersion.profileDataVersion = 2;
  assert.ok(
    validateAgentGuidanceProfile(
      createAgentGuidanceProfileSnapshot(unsupportedVersion),
    ).diagnostics.some(({ code }) => code === "PTAGT-301"),
  );

  const dangling = mutableProfile();
  dangling.riskRegistry[0].mitigationGuidanceIds = ["missing_guidance"];
  assert.ok(
    validateAgentGuidanceProfile(
      createAgentGuidanceProfileSnapshot(dangling),
    ).diagnostics.some(({ code }) => code === "PTAGT-302"),
  );

  const invalidUrl = mutableProfile();
  invalidUrl.sources[0].url = "https://";
  assert.ok(
    validateAgentGuidanceProfile(
      createAgentGuidanceProfileSnapshot(invalidUrl),
    ).diagnostics.some(({ code }) => code === "PTAGT-302"),
  );

  const conflictingDescription = mutableProfile();
  findSurface(
    conflictingDescription,
    "codex",
    "instruction",
  ).statusEvidence.description.text = "Conflicting canonical text.";
  assert.ok(
    validateAgentGuidanceProfile(
      createAgentGuidanceProfileSnapshot(conflictingDescription),
    ).diagnostics.some(({ code }) => code === "PTAGT-303"),
  );

  const digestProfile = mutableProfile();
  const staleSnapshot = createAgentGuidanceProfileSnapshot(digestProfile);
  digestProfile.providers[0].displayName = "Changed after digest";
  const digestValidation = validateAgentGuidanceProfile(staleSnapshot);
  assert.equal(digestValidation.ok, false);
  assert.ok(
    digestValidation.diagnostics.some(({ code }) => code === "PTAGT-303"),
  );
  const failedResult = getAgentGuidance(staleSnapshot);
  assert.equal(failedResult.ok, false);
  assert.deepEqual(failedResult.providers, []);
});

test("query usage errors remain outside domain lookup diagnostics", () => {
  assert.throws(
    () => getBundledAgentGuidance({ surfaceId: "instruction" }),
    /surfaceId requires providerId/,
  );
  assert.throws(
    () => getBundledAgentGuidance({ level: "exhaustive" }),
    /level must be index, quick, or detail/,
  );
});

test("public JSON projection keeps schema order and snake-case fields", () => {
  const json = agentGuidanceResultToJson(
    getBundledAgentGuidance({
      providerId: "github-copilot",
      surfaceId: "prompt",
    }),
  );
  assert.deepEqual(Object.keys(json), [
    "schema_version",
    "guidance_interface_version",
    "profile_schema_version",
    "profile_data_version",
    "guidance_taxonomy_version",
    "risk_taxonomy_version",
    "description_registry_version",
    "description_locale",
    "staleness_policy_version",
    "tool_version",
    "operation",
    "ok",
    "profile_digest",
    "snapshot_as_of",
    "query",
    "providers",
    "guidance_records",
    "risk_records",
    "sources",
    "capabilities",
    "diagnostics",
  ]);
  assert.equal(json.providers[0].surfaces[0].support_status, "preview");
  assert.equal(json.providers[0].surfaces[0].artifact_resolution, "known");
});
