import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as publicApi from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function expectedIds(prefix) {
  return Array.from(
    { length: 20 },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

test("SU-M5 acceptance traces every public TUI and TUE observation", async () => {
  const acceptance = await readFile(
    path.join(root, "docs/process/scheduling-units-m5-acceptance.md"),
    "utf8",
  );
  assert.match(acceptance, /Document status: Accepted 1\.0/);
  assert.deepEqual(
    [...acceptance.matchAll(/^\| `(TUI-\d{3})` \|/gm)].map((match) => match[1]),
    expectedIds("TUI"),
  );
  assert.deepEqual(
    [...acceptance.matchAll(/^\| `(TUE-\d{3})` \|/gm)].map((match) => match[1]),
    expectedIds("TUE"),
  );
  assert.match(acceptance, /Recommendation set `R` differed from scheduler set `L`/);
  assert.match(acceptance, /`RELEASE_030_PREPARATION`/);
  assert.match(acceptance, /does not itself push Git/);
});

test("the active public root retains SU-M5 services without target capabilities", () => {
  for (const name of [
    "checkDocument",
    "getProjectMetadata",
    "analyzeDocument",
    "selectNextTasks",
    "planUnitMigration",
    "withUnitMigrationWrite",
    "COMMAND_REGISTRY",
  ]) {
    assert.ok(name in publicApi, name);
  }
  for (const name of [
    "TARGET_GRAMMAR_2_CAPABILITY",
    "TARGET_GRAMMAR_3_CAPABILITY",
    "parseTargetDocument",
    "selectTargetTemporalTasks",
    "prepareTargetUnitMigrationRequest",
    "planTargetUnitMigrationResult",
  ]) {
    assert.equal(name in publicApi, false, name);
  }
  assert.equal(publicApi.COMMAND_REGISTRY.length, 44);
});
