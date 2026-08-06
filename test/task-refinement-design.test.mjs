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

function expectedIds(count) {
  return Array.from(
    { length: count },
    (_, index) => `TRF-${String(index + 1).padStart(3, "0")}`,
  );
}

test("task-refinement design keeps macro assurance separate from detail structure", async () => {
  const [requirements, specification, design, examples, backlog] =
    await Promise.all([
      repositoryText("docs/requirements.md"),
      repositoryText("docs/specs/task-refinement.md"),
      repositoryText("docs/basic-design.md"),
      repositoryText("docs/examples/task-refinement.md"),
      repositoryText("docs/backlog.md"),
    ]);

  assert.match(requirements, /^### 2\.8 Keep macro assurance above task refinement/m);
  assert.match(requirements, /^### 7\.10 Task refinement partitions/m);
  assert.match(specification, /- Status: Draft 0\.1/);
  assert.match(specification, /one n-ary partition relation/);
  assert.match(specification, /`declared_partition`, not `verified_mece`/);
  assert.match(specification, /no `skip_review`, `no_recheck`, waiver/);
  assert.match(specification, /^## 6\. Assurance-boundary expansion/m);
  assert.match(specification, /^## 7\. Assurance-boundary contraction/m);
  assert.match(specification, /does not select:\n\n- active `\.pert` syntax/);
  assert.match(design, /^### 6\.10 Task refinement and assurance boundaries/m);
  assert.match(backlog, /^### MULTI-001:/m);
  assert.match(backlog, /semantic draft does not authorize implementation/);
  assert.match(examples, /not accepted\s+Grammar 6 source examples/);
});

test("all ten task-refinement design cases are dependency ordered", async () => {
  const [examples, fixtureText] = await Promise.all([
    repositoryText("docs/examples/task-refinement.md"),
    repositoryText("test/fixtures/task-refinement-contract-v1.json"),
  ]);
  const fixture = JSON.parse(fixtureText);
  const ids = expectedIds(10);

  assert.deepEqual(
    [...examples.matchAll(/^## (TRF-\d{3}):/gm)].map(([, id]) => id),
    ids,
  );
  assert.equal(
    fixture.schema_version,
    "Perttool.TaskRefinementContractCases.v1",
  );
  assert.equal(fixture.refinement_model_version, 1);
  assert.equal(fixture.runtime_status, "design_only");
  assert.equal(fixture.relation.kind, "partition");
  assert.equal(fixture.relation.machine_proves_mece, false);
  assert.equal(fixture.relation.assurance_effect, "none_by_default");
  assert.deepEqual(fixture.cases.map(({ id }) => id), ids);

  const accepted = new Set();
  for (const contractCase of fixture.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      `${contractCase.id}: dependencies must precede the case`,
    );
    assert.equal(typeof contractCase.operation, "string");
    assert.equal(Object.keys(contractCase.expected).length > 0, true);
    accepted.add(contractCase.id);
  }

  assert.equal(
    fixture.cases.find(({ id }) => id === "TRF-005").expected
      .macro_descendant_reseal_required,
    false,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "TRF-006").expected
      .affected_descendant_reseal_required,
    true,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "TRF-009").expected
      .silent_generalization,
    false,
  );
});
