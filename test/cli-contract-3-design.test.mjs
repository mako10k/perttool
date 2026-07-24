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

test("Contract 3 backlog and current plan preserve completed cutover traceability", async () => {
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
    "CLI-002",
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
    /^### HELP-001: Add hierarchical, machine-readable command discovery\n\nPriority: P0\n\nStatus: Complete \(2026-07-24\)$/m,
  );
  assert.doesNotMatch(plan, /^milestone COMMAND_DISCOVERY_READY:/m);
  assert.match(
    backlog,
    /^### HELP-002: Separate command help from domain guidance\n\nPriority: P1\n\nStatus: Complete \(2026-07-24\)$/m,
  );
  assert.doesNotMatch(plan, /^milestone DOMAIN_GUIDE_READY:/m);
  assert.match(
    backlog,
    /^### HELP-003: Improve usage-error recovery\n\nPriority: P1\n\nStatus: Complete \(2026-07-24\)$/m,
  );
  assert.doesNotMatch(plan, /^task HELP_003_USAGE_RECOVERY /m);
  assert.doesNotMatch(plan, /^milestone USAGE_RECOVERY_READY:/m);
  assert.match(
    backlog,
    /^### MUT-001: Initialize a project through the CLI\n\nPriority: P0\nStatus: Complete \(2026-07-24\)$/m,
  );
  assert.doesNotMatch(plan, /^task MUT_001_PROJECT_INIT /m);
  assert.doesNotMatch(plan, /^milestone PROJECT_INIT_READY:/m);
  assert.match(
    backlog,
    /^### MUT-002: Add complete gate maintenance\n\nPriority: P0\nStatus: Complete \(2026-07-24\)$/m,
  );
  assert.doesNotMatch(plan, /^task MUT_002_GATE_MAINTENANCE /m);
  assert.doesNotMatch(plan, /^milestone GATE_MAINTENANCE_READY:/m);
  assert.match(
    backlog,
    /^### CLI-002: Normalize public names in one breaking version\n\nPriority: P1\n\nStatus: Complete \(2026-07-24\)$/m,
  );
  assert.doesNotMatch(plan, /^task CLI_002_CONTRACT_V3_CUTOVER /m);
  assert.match(
    plan,
    /^milestone CONTRACT_V3_CUTOVER_READY:\n  title "CLI-002 breaking contract 3 cutover ready"\n  state reached$/m,
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
  assert.match(specification, /Contract 3 is the active interface in the current source/);
  assert.match(
    specification,
    /remaining\n`CLI_003_FILE_FIRST_ACCEPTANCE` task verifies the complete workflow/,
  );
});

test("Contract 3 is active in source while published 0.1.0 remains Contract 2", async () => {
  const [currentInterface, targetInterface, migration] = await Promise.all([
    repositoryText("docs/specs/interfaces.md"),
    repositoryText("docs/specs/cli-contract-3.md"),
    repositoryText("docs/process/cli-contract-3-migration.md"),
  ]);

  assert.match(currentInterface, /CLI contract version: 2/);
  assert.match(currentInterface, /superseded CLI Contract 2 command surface/);
  assert.match(targetInterface, /Target CLI contract version: 3/);
  assert.match(migration, /CLI_002_CONTRACT_V3_CUTOVER` is complete in the current source/);
  assert.match(migration, /published `0\.1\.0` artifact\s+remains Contract 2/);
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
