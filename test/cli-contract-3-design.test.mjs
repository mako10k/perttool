import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

async function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const backlogIds = [
  "CLI-001",
  "HELP-001",
  "HELP-002",
  "HELP-003",
  "MUT-001",
  "MUT-002",
  "CLI-002",
  "CLI-003",
];

test("Contract 3 backlog and current plan preserve open and advanced item traceability", async () => {
  const [backlog, plan] = await Promise.all([
    repositoryText("docs/backlog.md"),
    repositoryText("plans/cli-surface-reset.pert"),
  ]);

  const actualBacklogIds = [...backlog.matchAll(/^### ([A-Z]+-\d{3}):/gm)]
    .map((match) => match[1]);
  assert.deepEqual(actualBacklogIds, backlogIds);

  const advancedBacklogIds = new Set([
    "CLI-001",
    "HELP-001",
    "HELP-002",
    "HELP-003",
    "MUT-001",
    "MUT-002",
  ]);
  for (const backlogId of backlogIds) {
    const taskId = backlogId.replace("-", "_");
    const matches = plan.match(new RegExp(`^task ${taskId}(?:_| )`, "gm")) ?? [];
    assert.equal(
      matches.length,
      advancedBacklogIds.has(backlogId) ? 0 : 1,
      backlogId,
    );
  }

  assert.match(
    backlog,
    /^### CLI-001: Adopt one command descriptor registry\n\nPriority: P0\n\nStatus: Complete \(2026-07-24\)$/m,
  );
  assert.doesNotMatch(plan, /^milestone COMMAND_REGISTRY_READY:/m);
  assert.match(
    backlog,
    /^### HELP-001: Add hierarchical, machine-readable command discovery\n\nPriority: P0\n\nStatus: Core complete \(2026-07-24\); public activation deferred to CLI-002$/m,
  );
  assert.doesNotMatch(plan, /^milestone COMMAND_DISCOVERY_READY:/m);
  assert.match(
    backlog,
    /^### HELP-002: Separate command help from domain guidance\n\nPriority: P1\n\nStatus: Core complete \(2026-07-24\); public activation deferred to CLI-002$/m,
  );
  assert.doesNotMatch(plan, /^milestone DOMAIN_GUIDE_READY:/m);
  assert.match(
    backlog,
    /^### HELP-003: Improve usage-error recovery\n\nPriority: P1\n\nStatus: Core complete \(2026-07-24\); public activation deferred to CLI-002$/m,
  );
  assert.doesNotMatch(plan, /^task HELP_003_USAGE_RECOVERY /m);
  assert.doesNotMatch(plan, /^milestone USAGE_RECOVERY_READY:/m);
  assert.match(
    backlog,
    /^### MUT-001: Initialize a project through the CLI\n\nPriority: P0\nStatus: Core complete \(2026-07-24\); direct command activation deferred to CLI-002$/m,
  );
  assert.doesNotMatch(plan, /^task MUT_001_PROJECT_INIT /m);
  assert.doesNotMatch(plan, /^milestone PROJECT_INIT_READY:/m);
  assert.match(
    backlog,
    /^### MUT-002: Add complete gate maintenance\n\nPriority: P0\nStatus: Core complete \(2026-07-24\); direct command activation deferred to CLI-002$/m,
  );
  assert.doesNotMatch(plan, /^task MUT_002_GATE_MAINTENANCE /m);
  assert.doesNotMatch(plan, /^milestone GATE_MAINTENANCE_READY:/m);
  assert.match(
    plan,
    /^milestone CONTRACT_V3_IMPLEMENTATION_READY:\n  title "CLI contract 3 implementation prerequisites complete"\n  state reached$/m,
  );
});

test("Contract 3 has one complete normative acceptance-case sequence", async () => {
  const specification = await repositoryText("docs/specs/cli-contract-3.md");
  const actualCaseIds = [...specification.matchAll(/^\| (CLI3-\d{3}) \|/gm)]
    .map((match) => match[1]);
  const expectedCaseIds = Array.from(
    { length: 14 },
    (_, index) => `CLI3-${String(index + 1).padStart(3, "0")}`,
  );

  assert.deepEqual(actualCaseIds, expectedCaseIds);
  assert.match(specification, /Contract 3 is an accepted design target, not the currently implemented/);
  assert.match(
    specification,
    /project initialization Core, deterministic result projections, exclusive/,
  );
});

test("Contract 2 remains active until the atomic Contract 3 cutover", async () => {
  const [currentInterface, targetInterface, migration] = await Promise.all([
    repositoryText("docs/specs/interfaces.md"),
    repositoryText("docs/specs/cli-contract-3.md"),
    repositoryText("docs/process/cli-contract-3-migration.md"),
  ]);

  assert.match(currentInterface, /CLI contract version: 2/);
  assert.match(currentInterface, /implemented CLI contract version 2/);
  assert.match(targetInterface, /Target CLI contract version: 3/);
  assert.match(migration, /Contract 2 remains the active public interface until/);
  assert.match(migration, /There is no `--cli-contract 2`, alias period/);

  for (const operation of [
    "document.check",
    "document.format",
    "guide",
    "batch.apply",
  ]) {
    assert.match(targetInterface, new RegExp(`\\| \`${operation.replace(".", "\\.")}\` \\|`));
  }
});
