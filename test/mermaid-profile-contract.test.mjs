import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocument } from "../dist/index.js";

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

test("normative Mermaid profile example has valid source, record count, and digests", async () => {
  const text = await readFile(
    path.join(root, "docs/examples/mermaid-profile.md"),
    "utf8",
  );
  const source = fenced(text, "pert");
  assert.equal(checkDocument(source).ok, true);

  const artifact = fenced(text, "mermaid");
  const lines = artifact.split("\n");
  assert.equal(lines[0], "flowchart LR");

  const profileLine = lines.find((line) => line.startsWith("  %% perttool:profile "));
  assert.ok(profileLine);
  const profile = JSON.parse(profileLine.slice("  %% perttool:profile ".length));
  assert.equal(profile.schema_version, "Perttool.MermaidProfile.v1");
  assert.equal(profile.projection.schema_version, "Perttool.MermaidProjection.v1");

  const recordPattern = /^  %% perttool:(project|resource|milestone|task|gate) (.*)$/;
  const records = lines.flatMap((line) => {
    const match = line.match(recordPattern);
    return match === null ? [] : [{ kind: match[1], json: match[2] }];
  });
  assert.deepEqual(records.map(({ kind }) => kind), [
    "project",
    "resource",
    "milestone",
    "milestone",
    "milestone",
    "task",
    "gate",
  ]);
  assert.equal(records.length, profile.record_count);
  for (const { json } of records) {
    assert.equal(JSON.stringify(JSON.parse(json)), json);
  }
  const metadataBody = records
    .map(({ kind, json }) => `${kind} ${json}\n`)
    .join("");
  assert.equal(sha256(metadataBody), profile.metadata_digest);

  const projectionBegin = lines.indexOf("  %% perttool:projection-begin");
  const projectionEnd = lines.indexOf("  %% perttool:projection-end");
  assert.ok(projectionBegin > 0);
  assert.ok(projectionEnd > projectionBegin + 1);
  const projectionBody = lines
    .slice(projectionBegin + 1, projectionEnd)
    .map((line) => `${line}\n`)
    .join("");
  assert.equal(sha256(projectionBody), profile.projection_digest);
  assert.equal(lines.slice(projectionEnd + 1).every((line) => line === ""), true);
});
