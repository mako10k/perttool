import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("the live open-Issue review has one ordered local backlog mapping", async () => {
  const [backlog, review, agents, copilot, plansReadme] = await Promise.all([
    repositoryText("docs/backlog.md"),
    repositoryText("docs/process/issue-priority-review-2026-08-14.md"),
    repositoryText("AGENTS.md"),
    repositoryText(".github/copilot-instructions.md"),
    repositoryText("plans/README.md"),
  ]);
  const mappings = [
    [19, "ADV-006", "P0"],
    [7, "ACT-004", "P1"],
    [6, "ACT-005", "P1"],
    [13, "EDITOR-MUTATION-001", "P2"],
    [18, "STATIC-001", "P2"],
    [12, "PLAN-POOL-001", "P2"],
    [3, "MULTI-001", "P3"],
  ];
  for (const [issue, localId, priority] of mappings) {
    assert.match(
      backlog,
      new RegExp(
        `\\[#${issue}\\][^\\n]*\\| \\x60${localId}\\x60 \\| ${priority} \\|`,
        "u",
      ),
    );
    assert.match(
      review,
      new RegExp(`\\x60${localId}\\x60 for #${issue}`, "u"),
    );
  }
  assert.match(review, /Issue #19 is the sole P0/u);
  assert.match(review, /Issue #7 changed from `priority:P0` to `priority:P1`/u);
  assert.match(backlog, /This P0 interrupts the normal editor-mutation frontier/u);
  for (const text of [agents, copilot, plansReadme]) {
    assert.match(text, /ADV-006/u);
    assert.match(text, /EDITOR_REPAIR_ACCEPTANCE/u);
  }
});
