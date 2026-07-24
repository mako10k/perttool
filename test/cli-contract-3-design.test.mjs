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

test("Contract 3 design maps every CLI review backlog item exactly once", async () => {
  const [backlog, plan] = await Promise.all([
    repositoryText("docs/backlog.md"),
    repositoryText("plans/cli-surface-reset.pert"),
  ]);

  const actualBacklogIds = [...backlog.matchAll(/^### ([A-Z]+-\d{3}):/gm)]
    .map((match) => match[1]);
  assert.deepEqual(actualBacklogIds, backlogIds);

  for (const backlogId of backlogIds) {
    const taskId = backlogId.replace("-", "_");
    const matches = plan.match(new RegExp(`^task ${taskId}(?:_| )`, "gm")) ?? [];
    assert.equal(matches.length, 1, backlogId);
  }

  assert.match(
    backlog,
    /^### MUT-001: Initialize a project through the CLI\n\nPriority: P0\nStatus: Backlog; contract designed, not implemented$/m,
  );
  assert.match(plan, /^task MUT_001_PROJECT_INIT /m);
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
  assert.match(specification, /`project init` remains backlog item `MUT-001`/);
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
