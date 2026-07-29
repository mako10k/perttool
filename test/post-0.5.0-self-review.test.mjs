import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("post-0.5.0 review records a closed-world Issue and finding inventory", async () => {
  const review = await repositoryText(
    "docs/process/post-0.5.0-self-review.md",
  );

  assert.match(review, /- Document status: Complete 1\.0/);
  assert.match(review, /with 33 descriptors/);
  assert.match(review, /16 unique result identities/);
  assert.deepEqual(
    [...review.matchAll(/^\| \[#(\d)\]/gm)].map((match) => match[1]),
    ["1", "2", "3", "4", "5"],
  );
  for (const finding of [
    "SR-001",
    "SR-002",
    "SR-003",
    "SR-004",
    "SR-005",
  ]) {
    assert.match(review, new RegExp("\\| `" + finding + "`"), finding);
  }
  assert.match(review, /No Issue is closed by this review\./);
  assert.match(review, /Issue closure remains a separate explicit decision/);
});

test("all review findings have durable backlog or Issue owners", async () => {
  const [backlog, requirements] = await Promise.all([
    repositoryText("docs/backlog.md"),
    repositoryText("docs/requirements.md"),
  ]);

  for (const backlogId of [
    "MIG-08",
    "SCHEMA-001",
    "MULTI-001",
    "LSP-001",
    "VSIX-001",
    "MCP-001",
    "META-001",
  ]) {
    assert.match(
      backlog,
      new RegExp(`^### ${backlogId}:`, "m"),
      backlogId,
    );
  }
  assert.match(
    requirements,
    /^18\. \[ \] Publish machine-readable JSON Schema artifacts/m,
  );
  assert.match(
    requirements,
    /github\.com\/mako10k\/perttool\/issues\/5/,
  );
  assert.match(
    backlog,
    /^Status: Released in `0\.5\.0` beta \(2026-07-29\)$/m,
  );
  assert.doesNotMatch(
    backlog,
    /^Status: Accepted in source; release not authorized$/m,
  );
  assert.doesNotMatch(
    backlog,
    /^Status: Contract accepted \(`SU-M1`\); rational-Duration refinement planned$/m,
  );
});

test("current guidance agrees that 0.5.0 is complete and schemas remain open", async () => {
  const [agents, copilot, requirements] = await Promise.all([
    repositoryText("AGENTS.md"),
    repositoryText(".github/copilot-instructions.md"),
    repositoryText("docs/requirements.md"),
  ]);

  for (const guidance of [agents, copilot]) {
    assert.match(guidance, /The accepted release is suffix-free beta `0\.5\.0`/);
    assert.match(
      guidance,
      /machine-readable JSON Schema artifacts remain absent/,
    );
    assert.match(guidance, /Issue #5/);
    assert.match(guidance, /`SCHEMA-001`/);
  }
  assert.match(
    agents,
    /`release-0\.5\.0\.pert` as completed independent post-beta workstreams/,
  );
  assert.doesNotMatch(
    agents,
    /`release-0\.5\.0\.pert` as the active Contract 6 release workstream/,
  );
  assert.match(
    requirements,
    /npm `beta=0\.5\.0` provides Contract 6 while `latest=0\.4\.0` remains/,
  );
});
