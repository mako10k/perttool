import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { getGuide } from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

async function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("Issue 33 Guide states the complete Final Goal non-guarantee", () => {
  const guide = getGuide("planning-pool", "detail");
  const sections = Object.fromEntries(
    guide.sections.map(({ id, body }) => [id, body]),
  );

  assert.match(
    sections["final-goal-boundary"],
    /Remaining Work is advisory planning retention and does not block project\.finish/,
  );
  assert.match(
    sections["final-goal-boundary"],
    /Work and Window observations do not prove Final Milestone Goal obligation coverage, goal completion, or objective achievement/,
  );
  assert.match(
    sections["final-goal-boundary"],
    /Projection changes execution scope only through an explicit governed strict-DAG candidate/,
  );
  assert.match(
    sections["final-goal-boundary"],
    /issues\/24[\s\S]*Goal Obligation, Goal Coverage, and Goal Seal/,
  );
  assert.match(
    sections["retained-work-example"],
    /accept the Final Milestone[\s\S]*retaining Work named Add offline export/,
  );
  assert.match(
    sections["retained-work-example"],
    /do not say that export is unnecessary[\s\S]*Final Goal is covered or complete/,
  );
  assert.ok(guide.related.includes("milestone-acceptance"));
});

test("Issue 33 retains the closed Planning Pool declaration surface", () => {
  const guide = getGuide("planning-pool", "detail");
  assert.deepEqual(guide.syntax, [
    "work ID:",
    "  title STRING",
    "  description STRING_OR_BLOCK",
    "event ID:",
    "  title STRING",
    "activity ID FROM -> TO:",
    "  title STRING",
    "window ID:",
    "  title STRING",
    "  objective STRING",
    "work_order:",
    "  ID",
  ]);
  assert.doesNotMatch(guide.syntax.join("\n"), /goal|coverage|seal/iu);
});

test("Issue 33 release notes and nontechnical example preserve the same boundary", async () => {
  const [changelog, readme, example] = await Promise.all([
    repositoryText("CHANGELOG.md"),
    repositoryText("README.md"),
    repositoryText("docs/examples/planning-pool-intents.md"),
  ]);

  for (const text of [changelog, readme, example]) {
    assert.match(
      text,
      /remaining(?: Planning Pool)? Work does not block\s+`project\.finish`/i,
    );
    assert.match(text, /Goal Coverage/);
    assert.match(text, /Goal Seal/);
  }
  assert.match(
    changelog,
    /only an explicit governed strict-DAG candidate changes execution scope/,
  );
  assert.match(
    example,
    /accepts the Final Milestone[\s\S]*`Add offline export` remains/,
  );
  assert.match(
    example,
    /Leaving the Work in the Pool does not project it, cancel it, or satisfy it/,
  );
});
