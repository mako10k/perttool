import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

async function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("temporal/unit interface selects closed version boundaries", async () => {
  const specification = await repositoryFile(
    "docs/specs/temporal-unit-interface.md",
  );
  const contract3 = await repositoryFile("docs/specs/cli-contract-3.md");

  assert.match(specification, /Document status: Normative 2\.0/);
  assert.match(
    specification,
    /Interface ID: `perttool\.temporal-unit-interface`/,
  );
  assert.match(specification, /Interface version: `2`/);
  assert.match(specification, /Active grammar version: `3`/);
  assert.match(specification, /Active CLI contract version: `4`/);
  for (const row of [
    "| DSL grammar | `1` | `2` | `3` |",
    "| CLI contract | `3` | `4` | `4` |",
    "| Check result | `Perttool.CheckResult.v1` | `Perttool.CheckResult.v2` | `Perttool.CheckResult.v2` |",
    "| Project result | `Perttool.ProjectResult.v1` | `Perttool.ProjectResult.v2` | `Perttool.ProjectResult.v2` |",
    "| Analysis result | `Perttool.AnalysisResult.v2` | `Perttool.AnalysisResult.v3` | `Perttool.AnalysisResult.v3` |",
    "| Next result | `Perttool.NextResult.v3` | `Perttool.NextResult.v4` | `Perttool.NextResult.v4` |",
    "| Unit-migration semantics | absent | `perttool.unit-migration@1` | `perttool.unit-migration@2` |",
    "| Unit-migration result | absent | `Perttool.UnitMigrationResult.v1` | `Perttool.UnitMigrationResult.v2` |",
  ]) {
    assert.ok(specification.includes(row), row);
  }
  assert.match(
    specification,
    /source implementation activated this complete interface atomically/,
  );
  assert.match(
    contract3,
    /grammar version 2\/3 temporal or exact-Fraction fields, temporal result\s+projections, or `project migrate-unit`; these require CLI Contract 4/,
  );
});

test("grammar v2 fixes exact fields, anchor validation, and canonical order", async () => {
  const [specification, grammar] = await Promise.all([
    repositoryFile("docs/specs/temporal-unit-interface.md"),
    repositoryFile("docs/specs/dsl-grammar.md"),
  ]);

  for (const expected of [
    'DeadlineField  = "deadline"',
    'NotBeforeField = "not_before"',
    "| milestone | `deadline` | 0..1 |",
    "| task | `not_before` | 0..1 |",
    "| task | `deadline` | 0..1 |",
    "`PTSEM-112`",
  ]) {
    assert.ok(specification.includes(expected), expected);
    assert.ok(grammar.includes(expected), expected);
  }
  assert.match(
    specification,
    /`deadline` and `not_before` are contextual field keywords/,
  );
  assert.match(
    specification,
    /Mixed temporal kinds remain valid source|Different temporal kinds remain valid source/,
  );
  assert.match(
    specification,
    /title, description, duration\|estimate, not_before, deadline, status/,
  );
  assert.match(
    grammar,
    /Version 1\s+rejects the added fields as `PTDSL-005`/,
  );
});

test("grammar v3 fixes exact fraction Duration without widening v1 or v2", async () => {
  const [specification, grammar] = await Promise.all([
    repositoryFile("docs/specs/temporal-unit-interface.md"),
    repositoryFile("docs/specs/dsl-grammar.md"),
  ]);

  assert.match(
    grammar,
    /Grammar version 3 is selected only by an explicit `version 3`/,
  );
  assert.match(
    grammar,
    /DurationV3\s+= \( Decimal \| DurationFraction \), DurationSuffix/,
  );
  assert.match(
    grammar,
    /The denominator must be greater than zero[\s\S]*`PTDSL-007`/,
  );
  assert.match(
    specification,
    /Grammar version 3 inherits every grammar version 2 field[\s\S]*changes only Duration/,
  );
  assert.match(
    specification,
    /shortest exact Decimal[\s\S]*reduced Fraction otherwise/,
  );
});

test("Contract 4 fixes migration, mutation, batch, help, and diagnostic surfaces", async () => {
  const [specification, mutation] = await Promise.all([
    repositoryFile("docs/specs/temporal-unit-interface.md"),
    repositoryFile("docs/specs/mutation.md"),
  ]);

  assert.match(
    specification,
    /perttool project migrate-unit <file>\s+--to-unit day\|hour\|point/,
  );
  assert.match(
    specification,
    /\[--replacement-velocity <velocity>\]/,
  );
  for (const option of [
    "--initial-milestone-deadline",
    "--not-before",
    "--deadline",
  ]) {
    assert.ok(specification.includes(option), option);
  }
  assert.match(
    specification,
    /Automatic unit migration is deliberately not an atomic `batch\.apply` member/,
  );
  assert.match(
    mutation,
    /Automatic unit migration remains a separate `planUnitMigration` operation/,
  );
  for (const topic of [
    "`syntax.temporal`",
    "`analysis.temporal`",
    "`editing.unit-migration`",
  ]) {
    assert.ok(specification.includes(topic), topic);
  }
  const migrationCodes = [...specification.matchAll(/^\| `(PTMIG-\d{3})` \|/gm)]
    .map((match) => match[1]);
  assert.deepEqual(
    migrationCodes,
    Array.from(
      { length: 9 },
      (_, index) => `PTMIG-${String(index + 401)}`,
    ),
  );
});

test("new schemas preserve base results and separate release-gated authority", async () => {
  const specification = await repositoryFile(
    "docs/specs/temporal-unit-interface.md",
  );

  for (const schema of [
    "Perttool.CheckResult.v2",
    "Perttool.ProjectResult.v2",
    "Perttool.AnalysisResult.v3",
    "Perttool.NextResult.v4",
    "Perttool.UnitMigrationResult.v2",
  ]) {
    assert.ok(specification.includes(`### 8.${[
      "Perttool.CheckResult.v2",
      "Perttool.ProjectResult.v2",
      "Perttool.AnalysisResult.v3",
      "Perttool.NextResult.v4",
      "Perttool.UnitMigrationResult.v2",
    ].indexOf(schema) + 1} \`${schema}\``), schema);
  }
  assert.match(
    specification,
    /Version 3 retains every AnalysisResult v2 base field/,
  );
  assert.match(
    specification,
    /Version 4 retains every NextResult v3 field[\s\S]*complete\s+`recommendation` graph remains the same semantic projection/,
  );
  assert.match(
    specification,
    /deadline_facts_used_for_ranking false/,
  );
  assert.match(
    specification,
    /Automation starts only IDs in\s+`startable_recommended_task_ids`/,
  );
  assert.match(
    specification,
    /This explanation is a temporal-execution explanation, not a new Recommendation\s+Reason Taxonomy fact/,
  );
  assert.match(
    specification,
    /a complete\s+`Perttool\.NextResult\.v3` remains the normal task-selection authority/,
  );
});

test("interface acceptance cases are complete and requirements mark the task done", async () => {
  const [specification, requirements, design, unitMigration] = await Promise.all([
    repositoryFile("docs/specs/temporal-unit-interface.md"),
    repositoryFile("docs/requirements.md"),
    repositoryFile("docs/basic-design.md"),
    repositoryFile("docs/specs/unit-migration.md"),
  ]);

  const actualCaseIds = [...specification.matchAll(/^\| (TUI-\d{3}) \|/gm)]
    .map((match) => match[1]);
  assert.deepEqual(
    actualCaseIds,
    Array.from(
      { length: 20 },
      (_, index) => `TUI-${String(index + 1).padStart(3, "0")}`,
    ),
  );
  assert.match(
    requirements,
    /- \[x\] \[Grammar, Core, CLI, help, diagnostics, and result-projection contract\]\(specs\/temporal-unit-interface\.md\)/,
  );
  assert.match(design, /### 6\.7 Temporal and Unit Public Interface/);
  assert.match(
    unitMigration,
    /operates on the inventoried base-unit fields of grammar versions 1, 2, and\s+3/,
  );
});
