import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(
  testDirectory,
  "fixtures/agent-guidance/provider-baseline.v1.json",
);

const providerOrder = [
  "codex",
  "github-copilot",
  "claude-code",
  "grok-build",
  "antigravity",
];

const surfaceOrder = [
  "instruction",
  "workflow",
  "delegated_agent",
  "enforcement",
  "prompt",
  "connector",
];

const evidenceStatuses = new Set([
  "documented",
  "public_preview",
  "deprecated",
  "surface_specific",
  "not_stated",
]);

const officialHosts = new Set([
  "learn.chatgpt.com",
  "docs.github.com",
  "code.claude.com",
  "docs.x.ai",
  "www.antigravity.google",
]);

async function readBaseline() {
  const text = await readFile(fixturePath, "utf8");
  return { text, baseline: JSON.parse(text) };
}

test("provider baseline is a canonical offline design input, not the public contract", async () => {
  const { text, baseline } = await readBaseline();

  assert.equal(baseline.dataset_id, "perttool.agent-guidance.provider-baseline");
  assert.equal(baseline.dataset_version, 1);
  assert.equal(baseline.purpose, "design_input");
  assert.equal(baseline.verified_at, "2026-07-23");
  assert.equal(baseline.runtime_network, false);
  assert.deepEqual(baseline.surface_order, surfaceOrder);
  assert.deepEqual(baseline.providers.map(({ provider_id }) => provider_id), providerOrder);
  assert.equal(text, `${JSON.stringify(baseline, null, 2)}\n`);

  assert.equal(text.includes('"schema_version"'), false);
  assert.equal(text.includes('"support_status"'), false);
  assert.equal(text.includes('"guidance_id"'), false);
});

test("every provider has the same evidence-complete surface baseline", async () => {
  const { baseline } = await readBaseline();
  const sources = new Map(baseline.sources.map((source) => [source.source_id, source]));
  assert.equal(sources.size, baseline.sources.length);

  const usedSourceIds = new Set();
  for (const provider of baseline.providers) {
    assert.deepEqual(provider.surfaces.map(({ surface_id }) => surface_id), surfaceOrder);
    assert.equal(new Set(provider.source_ids).size, provider.source_ids.length);

    for (const sourceId of provider.source_ids) {
      const source = sources.get(sourceId);
      assert.ok(source, `${provider.provider_id}:${sourceId}`);
      assert.equal(source.provider_id, provider.provider_id);
    }

    for (const surface of provider.surfaces) {
      const label = `${provider.provider_id}:${surface.surface_id}`;
      assert.ok(surface.provider_terms.length > 0, `${label}:provider_terms`);
      assert.ok(Array.isArray(surface.artifacts), `${label}:artifacts`);
      assert.ok(surface.scopes.length > 0, `${label}:scopes`);
      assert.ok(
        evidenceStatuses.has(surface.maturity_evidence.status),
        `${label}:maturity_evidence`,
      );
      assert.ok(surface.maturity_evidence.detail.length > 0, `${label}:maturity_detail`);
      assert.ok(surface.risk_observations.length > 0, `${label}:risk_observations`);
      assert.ok(surface.evidence.length > 0, `${label}:evidence`);
      assert.equal(surface.verified_at, baseline.verified_at, `${label}:verified_at`);

      for (const artifact of surface.artifacts) {
        assert.ok(artifact.path.length > 0, `${label}:artifact.path`);
        assert.ok(artifact.scope.length > 0, `${label}:artifact.scope`);
      }
      for (const evidence of surface.evidence) {
        assert.ok(evidence.fact.length > 0, `${label}:evidence.fact`);
        assert.ok(provider.source_ids.includes(evidence.source_id), `${label}:source scope`);
        assert.ok(sources.has(evidence.source_id), `${label}:source closure`);
        usedSourceIds.add(evidence.source_id);
      }
    }
  }

  for (const source of baseline.sources) {
    assert.equal(source.verified_at, baseline.verified_at, source.source_id);
    assert.ok(officialHosts.has(new URL(source.url).hostname), source.source_id);
    assert.ok(usedSourceIds.has(source.source_id), `${source.source_id}:unused`);
  }
});

test("unknown provider artifact paths remain explicit instead of guessed", async () => {
  const { baseline } = await readBaseline();

  function surface(providerId, surfaceId) {
    const provider = baseline.providers.find(({ provider_id }) => provider_id === providerId);
    assert.ok(provider, providerId);
    const entry = provider.surfaces.find(({ surface_id }) => surface_id === surfaceId);
    assert.ok(entry, `${providerId}:${surfaceId}`);
    return entry;
  }

  assert.deepEqual(surface("grok-build", "delegated_agent").artifacts, []);
  assert.deepEqual(surface("antigravity", "delegated_agent").artifacts, []);
  assert.deepEqual(surface("antigravity", "prompt").artifacts, []);
  assert.equal(
    surface("codex", "prompt").maturity_evidence.status,
    "deprecated",
  );
  assert.equal(
    surface("github-copilot", "prompt").maturity_evidence.status,
    "public_preview",
  );
  assert.equal(
    surface("grok-build", "instruction").maturity_evidence.status,
    "not_stated",
  );
});
