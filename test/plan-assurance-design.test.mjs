import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  checkDocument,
  getJsonSchemaCatalog,
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

test("plan assurance design separates dependencies, state, and authority", async () => {
  const [requirements, specification, design, examples, review, backlog] =
    await Promise.all([
      repositoryText("docs/requirements.md"),
      repositoryText("docs/specs/plan-assurance.md"),
      repositoryText("docs/basic-design.md"),
      repositoryText("docs/examples/plan-assurance.md"),
      repositoryText("docs/process/plan-assurance-design-review.md"),
      repositoryText("docs/backlog.md"),
    ]);

  assert.match(requirements, /^### 2\.7 Preserve conditional plan assurance/m);
  assert.match(requirements, /^### 7\.9 Conditional plan assurance/m);
  assert.match(specification, /- Status: Draft 0\.2/);
  assert.match(specification, /- Runtime status: Not implemented/);
  assert.match(specification, /Grammar 1 through 5 and CLI Contract 6 remain\s+unchanged/);

  for (const mode of ["both", "planning_only", "execution_only"]) {
    assert.equal(specification.includes(`\`${mode}\``), true, mode);
    assert.equal(requirements.includes(`\`${mode}\``), true, mode);
    assert.equal(design.includes(`\"${mode}\"`), true, mode);
  }

  assert.match(
    specification,
    /planning-dependency DAG equal to the projected\s+task-dependency DAG by default/,
  );
  assert.match(
    specification,
    /Planning dependencies affect plan assurance but do not by themselves affect\s+milestone reachability, structural readiness/,
  );
  assert.match(specification, /AoA acyclicity does not prove planning-dependency acyclicity/);
  assert.match(
    specification,
    /task_relation REL_A_B A -> B:\n  mode planning_only/,
  );
  assert.match(specification, /TaskRelationDecl = "task_relation"/);
  assert.match(specification, /`=>`, `\.>`, and other arrow\s+aliases are not accepted/);
  assert.match(specification, /plan-dependency add <file> <id>/);
  assert.match(specification, /plan_dependency\.add\|set\|remove/);
  assert.match(
    specification,
    /public grammar\/CLI contract version, remaining assurance-record spelling/,
  );
  assert.match(
    specification,
    /explicit `both` record pins the default meaning.*source-preserving formatting and mutation MUST retain/is,
  );
  assert.match(specification, /task `status`/);
  assert.match(specification, /work events, event IDs/);
  assert.match(
    specification,
    /a lifecycle mutation changes the complete source digest.*does not by itself change the plan contract/is,
  );
  assert.match(specification, /status alone MUST NOT be treated as conformance evidence/);
  assert.match(specification, /Outcome assessment is a separate projection/);
  assert.match(
    specification,
    /against_basis_hash.*equals both the task's accepted basis and current computed\s+basis/is,
  );
  assert.match(specification, /Perttool\.TaskOutcomeCommitment\.v1/);
  assert.match(specification, /receiptHash.*canonical receipt object/is);
  assert.match(
    specification,
    /MUST\s+NOT\s+keep them permanently `review_required`/,
  );
  assert.match(specification, /required_action = replan_and_reseal/);
  assert.match(specification, /Recommendation ranking version 1 remains a raw priority decision/);
  assert.match(specification, /--force-history-loss.*bypasses neither/is);
  assert.match(specification, /not a blockchain,\s*digital signature/);

  assert.match(design, /^### 6\.9 Conditional plan assurance/m);
  assert.match(design, /src\/assurance\//);
  assert.match(design, /current `Perttool\.NextResult\.v5` remains closed and\s+unchanged/);
  assert.match(design, /per-consumer task ID and effective planning mode/);
  assert.match(review, /No reviewed document requires lifecycle status to enter a plan hash/);
  assert.match(review, /internally consistent enough for a\s+future source\/interface contract/);
  assert.match(review, /It is not implementation acceptance/);
  assert.match(review, /^## 5\. Selected relation source interface/m);
  assert.match(backlog, /^### ASSURE-001: Add conditional plan assurance/m);
  assert.match(backlog, /implementation unplanned/);
  assert.match(examples, /`task_relation` snippets below are the selected future source target/);
});

test("all fourteen plan assurance design cases are dependency ordered", async () => {
  const [examples, fixtureText] = await Promise.all([
    repositoryText("docs/examples/plan-assurance.md"),
    repositoryText("test/fixtures/plan-assurance-contract-v1.json"),
  ]);
  const fixture = JSON.parse(fixtureText);
  const ids = expectedIds("PAS", 14);

  assert.deepEqual(
    [...examples.matchAll(/^## (PAS-\d{3}):/gm)].map(([, id]) => id),
    ids,
  );
  assert.equal(
    fixture.schema_version,
    "Perttool.PlanAssuranceContractCases.v1",
  );
  assert.equal(fixture.plan_assurance_model_version, 1);
  assert.equal(fixture.hash_model_version, 1);
  assert.equal(fixture.runtime_status, "not_implemented");
  assert.equal(fixture.relation_source_target.keyword, "task_relation");
  assert.equal(fixture.relation_source_target.arrow, "->");
  assert.deepEqual(
    fixture.relation_source_target.modes,
    ["both", "execution_only", "planning_only"],
  );
  assert.deepEqual(fixture.relation_source_target.punctuation_aliases, []);
  assert.equal(fixture.relation_cli_target.resource, "plan-dependency");
  assert.deepEqual(
    fixture.relation_cli_target.actions,
    ["add", "set", "remove"],
  );
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
    fixture.cases.find(({ id }) => id === "PAS-003").expected
      .default_dependency_mode,
    "both",
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "PAS-003").expected
      .explicit_both_pin_changes_hash,
    false,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "PAS-006").expected
      .execution_dependency,
    false,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "PAS-007").expected
      .planning_dependency,
    false,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "PAS-013").expected
      .consumer_relation_mode_preserved,
    true,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "PAS-013").expected
      .receipt_self_hash_required,
    true,
  );
  assert.equal(
    fixture.cases.find(({ id }) => id === "PAS-011").expected
      .known_changed_outcome_can_be_accepted,
    true,
  );
});

test("the active Contract 6 surface does not claim design-only assurance", () => {
  const commandPaths = COMMAND_REGISTRY.map(({ path }) => path.join(" "));
  assert.equal(
    commandPaths.some((commandPath) =>
      /plan-dependency|assurance|\bseal\b|\breseal\b/.test(commandPath),
    ),
    false,
  );

  const schemaIds = getJsonSchemaCatalog().map(({ schemaId }) => schemaId);
  assert.equal(schemaIds.some((id) => /Assurance/.test(id)), false);

  const source = `project RELATION_TARGET:
  version 5
  title "Relation target remains unavailable"
  as_of 2026-08-03
  duration_unit day
  finish M2

milestone M0:
  title "Start"
  state reached

milestone M1:
  title "First"

milestone M2:
  title "Finish"

task A M0 -> M1:
  title "A"
  duration 1d
  status planned

task B M1 -> M2:
  title "B"
  duration 1d
  status planned

task_relation REL_A_B A -> B:
  mode execution_only
  reason "Target syntax is not active"
`;
  const checked = checkDocument(source);
  assert.equal(checked.ok, false);
  assert.equal(
    checked.diagnostics.some(({ code }) => code === "PTDSL-003"),
    true,
  );
});
