import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Issue 6 contract fixes the bounded new-root correction and deferred Git boundary", async () => {
  const [contract, backlog, acceptance, plan] = await Promise.all([
    read("docs/specs/history-provenance-choice.md"),
    read("docs/backlog.md"),
    read("docs/process/issue-6-history-provenance-contract-acceptance.md"),
    read("plans/issue-6-history-provenance.pert"),
  ]);
  assert.match(contract, /--history-provenance automatic\|new-root/);
  assert.match(contract, /`automatic` is the default/);
  assert.match(contract, /does\s+not accept or follow a predecessor path/);
  assert.match(contract, /repository, path, resolved revision, HEAD/);
  assert.match(contract, /`PTHIS-105`/);
  assert.match(backlog, /^### SCM-002:/m);
  assert.match(backlog, /reviewed predecessor path or project/);
  assert.match(acceptance, /Twelve dependency-ordered cases/);
  assert.match(plan, /task ISSUE6_PROVENANCE_CONTRACT/);
});

test("all twelve history provenance cases are closed and dependency ordered", async () => {
  const fixture = JSON.parse(
    await read("test/fixtures/history-provenance-choice-contract-v1.json"),
  );
  assert.equal(fixture.model_version, 1);
  assert.equal(fixture.cases.length, 12);
  assert.deepEqual(
    fixture.cases.map(({ id }) => id),
    Array.from({ length: 12 }, (_, index) =>
      `HPC-${String(index + 1).padStart(3, "0")}`),
  );
  const seen = new Set();
  for (const entry of fixture.cases) {
    for (const dependency of entry.depends_on) {
      assert.equal(seen.has(dependency), true, `${entry.id} -> ${dependency}`);
    }
    seen.add(entry.id);
  }
});
