import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  analyzeDocument,
  checkDocument,
  getProjectMetadata,
  selectNextTasks,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

test("ADV-002 fixes a narrow single-candidate terminal-trivia contract", async () => {
  const [requirements, mutation, history, design, backlog, acceptance] =
    await Promise.all([
      repositoryText("docs/requirements.md"),
      repositoryText("docs/specs/mutation.md"),
      repositoryText("docs/specs/advance-history-safety.md"),
      repositoryText("docs/basic-design.md"),
      repositoryText("docs/backlog.md"),
      repositoryText(
        "docs/process/advance-clean-candidate-contract-acceptance.md",
      ),
    ]);

  assert.match(
    requirements,
    /19\. \[x\] Enforce repository-aware history safety/,
  );
  assert.match(
    requirements,
    /20\. \[ \] Ensure one destructive `dag advance` preview is the exact/,
  );
  assert.match(requirements, /repository-clean candidate later written/);
  assert.match(mutation, /^### 12\.2 ADV-002 terminal-separator target$/m);
  assert.match(mutation, /terminal removed-declaration suffix/);
  assert.match(mutation, /advance-owned terminal separator trivia/);
  assert.match(mutation, /This rule is not a global trim/);
  assert.match(mutation, /No formatter or second cleanup edit/);
  assert.match(history, /destructive record cover identical current-source bytes/);
  assert.match(history, /changed or staged byte inside an advance-owned/);
  assert.match(design, /preview, separate output, and in-place write share the/);
  assert.match(
    backlog,
    /Status: Core accepted \(2026-07-31; end-to-end pending; release blocker\)/,
  );
  assert.match(acceptance, /- Document status: Accepted target 1\.0/);
  assert.match(acceptance, /Runtime status: not implemented/);
  assert.match(acceptance, /There are no open contract findings/);
});

test("all eight repository-clean candidate cases are dependency ordered", async () => {
  const fixture = JSON.parse(await repositoryText(
    "test/fixtures/advance-clean-candidate-contract-v1.json",
  ));

  assert.equal(
    fixture.schema_version,
    "Perttool.AdvanceCleanCandidateContractCases.v1",
  );
  assert.equal(fixture.mutation_semantics_version, 2);
  assert.equal(fixture.history_safety_model_version, 1);
  assert.equal(fixture.target_cli_contract_version, 6);
  assert.equal(fixture.target_result_schema, "Perttool.AdvanceResult.v1");
  assert.deepEqual(
    fixture.cases.map(({ id }) => id),
    expectedIds("ACC", 8),
  );

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
    fixture.cases.find(({ id }) => id === "ACC-002").expected.global_trim,
    false,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "ACC-006").expected
      .manual_cleanup_edit,
    false,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "ACC-008").expected
      .public_identity_change,
    false,
  );
});

test("completed Core plan exposes only final acceptance as next authority", async () => {
  const source = await repositoryText("plans/advance-clean-candidate.pert");
  const checked = checkDocument(source);
  const metadata = getProjectMetadata(source);
  const analyzed = analyzeDocument(source);
  const next = selectNextTasks(source);

  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(analyzed.ok, true);
  assert.equal(next.ok, true);
  assert.equal(metadata.project.id, "ADVANCE_CLEAN_CANDIDATE");
  assert.equal(metadata.grammarVersion, 5);
  assert.equal(metadata.project.finish, "ADV_CLEAN_ACCEPTED");
  assert.equal(metadata.project.governance.effective.goalOwner, "user");
  assert.equal(metadata.project.governance.effective.dagOwner, "user");
  assert.deepEqual(next.groups.active, []);
  assert.deepEqual(next.groups.ready, ["ADV_CLEAN_CANDIDATE_ACCEPTANCE"]);
  assert.deepEqual(next.groups.runnableNow, ["ADV_CLEAN_CANDIDATE_ACCEPTANCE"]);
  assert.deepEqual(next.groups.upcoming, []);
  assert.deepEqual(
    next.recommendation.recommendedTaskIds,
    ["ADV_CLEAN_CANDIDATE_ACCEPTANCE"],
  );
  assert.deepEqual(
    next.temporal.authority.startableRecommendedTaskIds,
    ["ADV_CLEAN_CANDIDATE_ACCEPTANCE"],
  );
});
