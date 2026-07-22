import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocument, exportMermaid, importMermaid } from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function fenced(text, language) {
  const match = text.match(new RegExp(`\x60\x60\x60${language}\\n([\\s\\S]*?)\x60\x60\x60`));
  assert.ok(match, `${language} fence`);
  return match[1];
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function repairMetadataDigest(artifact) {
  const lines = artifact.split("\n");
  const records = lines.flatMap((line) => {
    const match = /^  %% perttool:(project|resource|milestone|task|gate) (.*)$/.exec(line);
    return match === null ? [] : [`${match[1]} ${match[2]}\n`];
  });
  const digest = sha256(records.join(""));
  return artifact.replace(/"metadata_digest":"sha256:[0-9a-f]{64}"/, `"metadata_digest":"${digest}"`);
}

async function normative() {
  const text = await readFile(path.join(root, "docs/examples/mermaid-profile.md"), "utf8");
  return { source: fenced(text, "pert"), artifact: fenced(text, "mermaid") };
}

test("importMermaid restores the normative semantic model losslessly", async () => {
  const expected = await normative();
  const first = importMermaid(expected.artifact);
  const second = importMermaid(expected.artifact);

  assert.equal(first.ok, true);
  assert.equal(first.profile, "perttool");
  assert.equal(first.documentId, "PROFILE_SAMPLE");
  assert.equal(checkDocument(first.artifact).ok, true);
  assert.equal(exportMermaid(first.artifact).artifact, expected.artifact);
  assert.equal(second.artifact, first.artifact);
  assert.equal(second.artifactDigest, first.artifactDigest);
  assert.deepEqual(first.lossReport, { lossless: true, records: [] });
  assert.deepEqual(first.generatedIds, []);
});

test("profile import preserves PERT estimates and exact velocity tokens", async () => {
  const source = await readFile(path.join(root, "docs/examples/point-velocity.pert"), "utf8");
  const profile = exportMermaid(source).artifact;
  const imported = importMermaid(profile);
  assert.equal(imported.ok, true);
  assert.match(imported.artifact, /velocity 20p\/10d/);
  assert.match(imported.artifact, /optimistic 3p/);
  assert.match(imported.artifact, /most_likely 5p/);
  assert.match(imported.artifact, /pessimistic 7p/);
  assert.equal(exportMermaid(imported.artifact).artifact, profile);
});

test("profile corruption fails closed with stable phase codes", async () => {
  const { artifact } = await normative();
  const built = artifact.split("\n").find((line) => line.startsWith("  %% perttool:milestone {\"id\":\"BUILT\""));
  const now = artifact.split("\n").find((line) => line.startsWith("  %% perttool:milestone {\"id\":\"NOW\""));
  assert.ok(built);
  assert.ok(now);
  const cases = [
    {
      expected: "PTCNV-103",
      artifact: artifact.replace(/^  %% perttool:task .*\n/m, ""),
    },
    {
      expected: "PTCNV-104",
      artifact: artifact.replace('"duration":"2d"', '"duration":"3d"'),
    },
    {
      expected: "PTCNV-105",
      artifact: artifact.replace("ptm_NOW -->", "ptm_RELEASE -->"),
    },
    {
      expected: "PTCNV-102",
      artifact: artifact.replace('"source":"Issue #10"}', '"source":"Issue #10","unexpected":true}'),
    },
    {
      expected: "PTCNV-101",
      artifact: artifact.replace("Perttool.MermaidProfile.v1", "Perttool.MermaidProfile.v2"),
    },
    {
      expected: "PTCNV-105",
      artifact: artifact.replace("  %% perttool:projection-end", "  click ptm_NOW callback\n  %% perttool:projection-end"),
    },
    {
      expected: "PTCNV-103",
      artifact: artifact.replace(`${built}\n${now}`, `${now}\n${built}`),
    },
    {
      expected: "PTCNV-102",
      artifact: artifact.replace("  %% perttool:profile ", " %% perttool:profile "),
    },
    {
      expected: "PTCNV-102",
      artifact: `\uFEFF${artifact}`,
    },
    {
      expected: "PTCNV-102",
      artifact: artifact.replaceAll("\n", "\r\n"),
    },
  ];

  for (const candidate of cases) {
    const result = importMermaid(candidate.artifact);
    assert.equal(result.ok, false, candidate.expected);
    assert.equal(result.profile, "perttool", candidate.expected);
    assert.equal(result.artifact, null, candidate.expected);
    assert.equal(result.diagnostics[0].code, candidate.expected);
  }
});

test("decoded metadata is revalidated as an AoA document", async () => {
  const { artifact } = await normative();
  const cyclic = repairMetadataDigest(
    artifact.replace(
      '"id":"BUILD","from":"NOW","to":"BUILT"',
      '"id":"BUILD","from":"BUILT","to":"NOW"',
    ),
  );
  const result = importMermaid(cyclic);
  assert.equal(result.ok, false);
  assert.equal(result.profile, "perttool");
  assert.equal(result.artifact, null);
  assert.equal(result.diagnostics[0].code, "PTCNV-106");
});

test("plain Mermaid import is deterministic and explicitly lossy", async () => {
  const source = await readFile(path.join(root, "docs/examples/minimal.pert"), "utf8");
  const plain = exportMermaid(source, { profile: "plain" }).artifact;
  const first = importMermaid(plain);
  const second = importMermaid(plain);

  assert.equal(first.ok, true);
  assert.equal(first.profile, "plain");
  assert.equal(first.documentId, "IMPORTED_MERMAID");
  assert.equal(checkDocument(first.artifact).ok, true);
  assert.equal(first.lossReport.lossless, false);
  assert.ok(first.lossReport.records.some(({ code }) => code === "PTCNV-202"));
  assert.ok(first.lossReport.records.some(({ code }) => code === "PTCNV-203"));
  assert.ok(first.lossReport.records.some(({ code }) => code === "PTCNV-204"));
  assert.deepEqual(first.generatedIds, [
    { sourceElement: "node:ptm_DONE", generatedId: "MILESTONE_001" },
    { sourceElement: "node:ptm_NOW", generatedId: "MILESTONE_002" },
    { sourceElement: "edge:1", generatedId: "TASK_001" },
  ]);
  assert.equal(second.artifact, first.artifact);
  assert.deepEqual(second.lossReport, first.lossReport);
});

test("plain Mermaid rejects executable directives and invalid AoA graphs", () => {
  const unsafe = importMermaid([
    "flowchart LR",
    "  A((\"A\"))",
    "  click A callback",
    "",
  ].join("\n"));
  assert.equal(unsafe.ok, false);
  assert.equal(unsafe.diagnostics[0].code, "PTCNV-102");

  const rawHtml = importMermaid([
    "flowchart LR",
    "  A((\"<b>A</b>\"))",
    "",
  ].join("\n"));
  assert.equal(rawHtml.ok, false);
  assert.equal(rawHtml.diagnostics[0].code, "PTCNV-102");

  const cyclic = importMermaid([
    "flowchart LR",
    "  A((\"A\"))",
    "  B((\"B\"))",
    "  A -->|\"AB\"| B",
    "  B -->|\"BA\"| A",
    "",
  ].join("\n"));
  assert.equal(cyclic.ok, false);
  assert.equal(cyclic.diagnostics[0].code, "PTCNV-106");
  assert.equal(cyclic.artifact, null);
});
