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

test("unit migration fixes identity, directions, and effective velocity", async () => {
  const specification = await repositoryFile("docs/specs/unit-migration.md");

  assert.match(specification, /Document status: Normative 2\.1/);
  assert.match(
    specification,
    /Unit migration ID: `perttool\.unit-migration`/,
  );
  assert.match(
    specification,
    /unit_migration_version\s+= 2/,
  );
  for (const row of [
    "| `point` | `day` | `U = day` |",
    "| `point` | `hour` | `U = hour` |",
    "| `day` | `point` | `U = day` |",
    "| `hour` | `point` | `U = hour` |",
  ]) {
    assert.ok(specification.includes(row), row);
  }
  assert.match(
    specification,
    /If neither exists, fail with `missing_velocity`/,
  );
  assert.match(
    specification,
    /Direct `day <-> hour` requests fail with `unsupported_direction`/,
  );
  assert.match(
    specification,
    /If a replacement is semantically equal to the declared velocity[\s\S]*treat the velocity as retained and preserve its source\s+bytes/,
  );
});

test("unit migration fixes the complete source inventory and exact formulas", async () => {
  const specification = await repositoryFile("docs/specs/unit-migration.md");

  for (const field of [
    "`project.duration_unit`",
    "`project.velocity`",
    "`project.critical_epsilon`",
    "`project.target_duration`",
    "every task `duration`",
    "every task `estimate.optimistic`",
    "every task `estimate.most_likely`",
    "every task `estimate.pessimistic`",
  ]) {
    assert.ok(specification.includes(field), field);
  }
  assert.match(
    specification,
    /point -> U:\s+converted\(x\) = x \* T \/ P/,
  );
  assert.match(
    specification,
    /U -> point:\s+converted\(x\) = x \* P \/ T/,
  );
  assert.match(
    specification,
    /The initial temporal scope contains only absolute dates and date-times/,
  );
  assert.match(
    specification,
    /fails with\s+`unsupported_duration_field`/,
  );
});

test("unit migration serializes every exact value and selects the grammar atomically", async () => {
  const specification = await repositoryFile("docs/specs/unit-migration.md");

  assert.match(specification, /d = 2\^a \* 5\^b/);
  assert.match(
    specification,
    /when the test succeeds[\s\S]*emit the shortest ordinary Decimal/,
  );
  assert.match(
    specification,
    /otherwise emit the reduced `numerator\/denominator` form/,
  );
  assert.match(
    specification,
    /\| `1\/3` day \| `1\/3d` \|/,
  );
  assert.match(
    specification,
    /Migration version 2 has no\s+`nonrepresentable_decimal` failure/,
  );
  assert.match(
    specification,
    /upgrade source grammar version 1 or 2 to explicit version 3 when any\s+generated token is a Fraction/,
  );
  assert.match(
    specification,
    /retain source grammar version 3 or 4 regardless of generated token spelling/,
  );
  assert.match(
    specification,
    /Grammar 4 source is never changed to Grammar 3/,
  );
  assert.match(
    specification,
    /parse and semantically validate only the final candidate/,
  );
});

test("unit migration fixes no-op, inverse, and existing-version boundaries", async () => {
  const specification = await repositoryFile("docs/specs/unit-migration.md");
  const requirements = await repositoryFile("docs/requirements.md");
  const design = await repositoryFile("docs/basic-design.md");
  const grammar = await repositoryFile("docs/specs/dsl-grammar.md");
  const analysis = await repositoryFile("docs/specs/analysis.md");
  const mutation = await repositoryFile("docs/specs/mutation.md");
  const calendar = await repositoryFile("docs/specs/temporal-calendar.md");

  assert.match(
    specification,
    /When `target_unit == source_unit` and no replacement velocity is supplied/,
  );
  assert.match(
    specification,
    /repeating the same target without\s+a replacement is the same-unit no-op/,
  );
  assert.match(
    specification,
    /An inverse migration with the same effective velocity MUST restore/,
  );
  assert.match(
    specification,
    /Lexical byte identity is not guaranteed/,
  );
  assert.match(
    specification,
    /`values_exact_metadata_changed`/,
  );
  assert.match(
    requirements,
    /- \[x\] \[Exact point and time-unit source-migration semantics\]\(specs\/unit-migration\.md\)/,
  );
  assert.match(design, /### 6\.6 Point and Time-Unit Source Migration/);
  assert.match(
    grammar,
    /Unit migration version 2 accepts grammar versions 1, 2, and 3/,
  );
  assert.match(
    specification,
    /inventory remains complete for\s+grammar versions 1, 2, 3, and 4/,
  );
  assert.match(
    specification,
    /preserve `goal_owner`, `goal_delegates`, `dag_owner`, and\s+`dag_delegates`/,
  );
  assert.match(
    analysis,
    /an\s+Analysis `velocity_forecast` remains read-only/,
  );
  assert.match(
    mutation,
    /does not claim automatic field inventory, exact\s+conversion, canonical Decimal-or-fraction serialization/,
  );
  assert.match(
    calendar,
    /MUST NOT use calendar-projection\s+scalars, a date difference, an offset, or `as_of`/,
  );
});
