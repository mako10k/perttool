import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { exportMermaid } from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function fenced(text, language) {
  const match = text.match(new RegExp(`\x60\x60\x60${language}\\n([\\s\\S]*?)\x60\x60\x60`));
  assert.ok(match, `${language} fence`);
  return match[1];
}

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("exportMermaid reproduces the normative profile byte for byte", async () => {
  const example = await source("docs/examples/mermaid-profile.md");
  const dsl = fenced(example, "pert");
  const expected = fenced(example, "mermaid");
  const first = exportMermaid(dsl);
  const second = exportMermaid(dsl);

  assert.equal(first.ok, true);
  assert.equal(first.profile, "perttool");
  assert.equal(first.analysis, "none");
  assert.equal(first.artifact, expected);
  assert.equal(second.artifact, expected);
  assert.equal(first.artifactDigest, second.artifactDigest);
  assert.deepEqual(first.lossReport, { lossless: true, records: [] });
});

test("profile metadata preserves PERT tokens, velocity, and complete defaults", async () => {
  const result = exportMermaid(await source("docs/examples/point-velocity.pert"));
  assert.equal(result.ok, true);
  assert.match(result.artifact, /"velocity":"20p\/10d"/);
  assert.match(
    result.artifact,
    /"estimate":\{"kind":"pert","optimistic":"3p","most_likely":"5p","pessimistic":"7p"\}/,
  );
  assert.match(result.artifact, /"critical_epsilon":"0p","target_duration":null/);
  assert.match(result.artifact, /"status":"planned","priority":10/);
});

test("analysis annotations come from common precedence and resource results", async () => {
  const text = await source("docs/examples/parallel.pert");
  const result = exportMermaid(text, {
    analysis: "both",
    capacityOverrides: new Map([
      ["TEST_ENV", 2],
      ["DEVELOPERS", 3],
    ]),
  });

  assert.equal(result.ok, true);
  assert.match(
    result.artifact,
    /"capacity_overrides":\[\{"resource_id":"DEVELOPERS","capacity":3\},\{"resource_id":"TEST_ENV","capacity":2\}\]/,
  );
  assert.match(result.artifact, /CORE: .*E=4d \/ TF=0d \/ CP \/ S=0-4d \/ SCP/);
  assert.match(result.artifact, /DOCS: .*E=2d \/ TF=2d \/ S=0-2d/);
  assert.match(result.artifact, /linkStyle 1 stroke:#c0392b,stroke-width:4px;/);

  assert.throws(
    () => exportMermaid(text, { capacityOverrides: new Map([["TEST_ENV", 2]]) }),
    /capacityOverrides require resource or both analysis/,
  );
});

test("plain profile reports deliberate semantic metadata loss", async () => {
  const result = exportMermaid(await source("docs/examples/minimal.pert"), {
    profile: "plain",
  });
  assert.equal(result.ok, true);
  assert.equal(result.artifact.startsWith("flowchart LR\n"), true);
  assert.equal(result.artifact.includes("%% perttool:"), false);
  assert.equal(result.lossReport.lossless, false);
  assert.deepEqual(result.lossReport.records.map(({ code, lossy }) => ({ code, lossy })), [
    { code: "PTCNV-206", lossy: true },
  ]);
});

test("invalid DSL never produces an artifact or a lossless result", async () => {
  const result = exportMermaid(
    await source("test/fixtures/invalid/undefined-endpoint.pert"),
  );
  assert.equal(result.ok, false);
  assert.equal(result.artifact, null);
  assert.equal(result.artifactDigest, null);
  assert.equal(result.lossReport.lossless, false);
  assert.ok(result.diagnostics.some(({ code }) => code === "PTSEM-204"));
});
