import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  analyzeDocument,
  checkDocument,
  getJsonSchemaCatalog,
  getProjectMetadata,
  selectNextTasks,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function tableIds(document, prefix) {
  return [
    ...document.matchAll(
      new RegExp("^\\| `(" + prefix + "-\\d{3})` \\|", "gm"),
    ),
  ].map((match) => match[1]);
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

test("advance history contract fixes the exact proof and public boundary", async () => {
  const [requirements, specification, projectActuals, mutation, design, acceptance] =
    await Promise.all([
      repositoryText("docs/requirements.md"),
      repositoryText("docs/specs/advance-history-safety.md"),
      repositoryText("docs/specs/project-actuals.md"),
      repositoryText("docs/specs/mutation.md"),
      repositoryText("docs/basic-design.md"),
      repositoryText("docs/process/advance-history-contract-acceptance.md"),
    ]);

  assert.match(specification, /- Status: Normative 1\.0/);
  assert.match(specification, /History-safety model version: 1/);
  assert.match(specification, /stage-0 index/);
  assert.match(
    specification,
    /stage-0 index is not required to be a globally valid `\.pert` document/,
  );
  assert.match(specification, /Myers shortest-edit\s+script over unsigned byte values/);
  assert.match(
    specification,
    /repository\/path\/`HEAD`\/stage-0-index binding/,
  );
  assert.match(specification, /\| `warning_denied` \|/);
  assert.match(
    specification,
    /When no trustworthy candidate exists, `history_guard=null`/,
  );
  assert.match(specification, /dirty source ranges that remain in/);
  assert.match(specification, /AdvanceDestructiveRecordV1/);
  assert.match(specification, /field: "declaration" \| "state"/);
  assert.match(specification, /--force-history-loss/);
  assert.match(specification, /Perttool\.AdvanceResult\.v1/);
  assert.match(specification, /PTADV-101, PTADV-102, PTADV-103/);
  assert.match(specification, /source_modified_at/);
  assert.match(specification, /source_bytes/);
  assert.match(specification, /diff_added_lines/);
  assert.match(
    specification,
    /Digests may follow this explanation but MUST NOT replace it\./,
  );

  assert.match(
    requirements,
    /\[Advance History Safety Contract\]\(specs\/advance-history-safety\.md\)/,
  );
  assert.match(
    requirements,
    /dirty target file is not sufficient reason to reject an\s+advance/,
  );
  assert.match(
    projectActuals,
    /\[Advance History Safety Contract\]\(advance-history-safety\.md\)/,
  );
  assert.match(
    mutation,
    /repository and index inspection remain outside this\s+Core/,
  );
  assert.match(design, /^#### 6\.8\.4 Advance history-safety boundary$/m);
  assert.match(
    acceptance,
    /There are no open semantic or public-contract findings/,
  );
  assert.match(acceptance, /Runtime status: not implemented/);
  assert.deepEqual(tableIds(acceptance, "AHSR"), expectedIds("AHSR", 12));
  assert.deepEqual(tableIds(specification, "AHS"), expectedIds("AHS", 18));
});

test("all eighteen history-safety cases are dependency ordered", async () => {
  const fixture = JSON.parse(await repositoryText(
    "test/fixtures/advance-history-contract-v1.json",
  ));

  assert.equal(
    fixture.schema_version,
    "Perttool.AdvanceHistoryContractCases.v1",
  );
  assert.equal(fixture.history_safety_model_version, 1);
  assert.equal(fixture.target_cli_contract_version, 6);
  assert.equal(fixture.target_result_schema, "Perttool.AdvanceResult.v1");
  assert.deepEqual(
    fixture.cases.map(({ id }) => id),
    expectedIds("AHS", 18),
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

  assert.deepEqual(
    fixture.cases.find(({ id }) => id === "AHS-017").expected
      .changed_binding_any_of,
    ["head", "stage0_index"],
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "AHS-007").expected
      .index_global_validation_required,
    false,
  );
});

test("active runtime remains unchanged until the later CLI task", () => {
  const advance = COMMAND_REGISTRY.find(
    ({ path }) => path[0] === "dag" && path[1] === "advance",
  );
  assert.ok(advance);
  assert.deepEqual(
    advance.resultSchemas,
    ["Perttool.MutationResult.v3", "Perttool.CliError.v1"],
  );
  assert.equal(
    advance.options.some(({ name }) => name === "force-history-loss"),
    false,
  );
  assert.equal(
    getJsonSchemaCatalog().some(
      ({ schemaId }) => schemaId === "Perttool.AdvanceResult.v1",
    ),
    false,
  );
});

test("accepted contract plan recommends only the probe handoff", async () => {
  const source = await repositoryText("plans/advance-history-safety.pert");
  const checked = checkDocument(source);
  const metadata = getProjectMetadata(source);
  const analyzed = analyzeDocument(source);
  const next = selectNextTasks(source);

  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(analyzed.ok, true);
  assert.equal(next.ok, true);
  assert.equal(metadata.project.id, "ADVANCE_HISTORY_SAFETY");
  assert.equal(metadata.grammarVersion, 5);
  assert.equal(metadata.project.finish, "ADV_HISTORY_ACCEPTED");
  assert.equal(metadata.project.governance.effective.goalOwner, "user");
  assert.equal(metadata.project.governance.effective.dagOwner, "user");
  assert.deepEqual(
    checked.document.declarations
      .filter(({ kind }) => kind === "task")
      .map(({ id }) => id),
    [
      "ADV_HISTORY_PROBE",
      "ADV_HISTORY_CLI",
      "ADV_HISTORY_ACCEPTANCE",
    ],
  );
  assert.equal(
    checked.document.declarations.find(
      ({ kind, id }) =>
        kind === "milestone" && id === "ADV_HISTORY_CONTRACT_ACCEPTED",
    ).fields.find(({ name }) => name === "state").value,
    "reached",
  );
  assert.equal(
    checked.document.declarations.filter(
      ({ kind }) => kind === "work_event",
    ).length,
    0,
  );
  assert.equal(analyzed.precedence.makespan.numerator.toString(), "11");
  assert.equal(analyzed.precedence.makespan.denominator.toString(), "1");
  assert.deepEqual(next.groups.active, []);
  assert.deepEqual(next.groups.ready, ["ADV_HISTORY_PROBE"]);
  assert.deepEqual(next.groups.runnableNow, ["ADV_HISTORY_PROBE"]);
  assert.deepEqual(next.recommendation.recommendedTaskIds, [
    "ADV_HISTORY_PROBE",
  ]);
  assert.deepEqual(next.temporal.authority.startableRecommendedTaskIds, [
    "ADV_HISTORY_PROBE",
  ]);
  assert.equal(next.recommendation.explanationStatus.complete, true);
  assert.equal(next.recommendation.explanationStatus.truncated, false);
  assert.equal(
    next.diagnostics.some(({ code }) => code.startsWith("PTREC-")),
    false,
  );
});
