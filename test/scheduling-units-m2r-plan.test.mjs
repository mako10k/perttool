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

test("SU-M2R replans exact rational Duration before SU-M3 and SU-M4", async () => {
  const [detail, macro] = await Promise.all([
    repositoryFile("plans/scheduling-units-m2r.pert"),
    repositoryFile("plans/scheduling-units.pert"),
  ]);

  const taskIds = [...detail.matchAll(/^task ([A-Z0-9_]+) /gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(taskIds, []);
  const points = [...detail.matchAll(/^  duration (\d+)p$/gm)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
  assert.equal(points, 0);

  assert.doesNotMatch(detail, /^task RATIONAL_DURATION_CONTRACT /m);
  assert.doesNotMatch(detail, /^task RATIONAL_DURATION_SOURCE_MODEL /m);
  assert.doesNotMatch(detail, /^task EXACT_DURATION_SERIALIZER /m);
  assert.doesNotMatch(detail, /^task RATIONAL_DURATION_FORMATTER /m);
  assert.doesNotMatch(detail, /^task RATIONAL_DURATION_MUTATION /m);
  assert.doesNotMatch(detail, /^task RATIONAL_DURATION_VERSION_BOUNDARY /m);
  assert.doesNotMatch(detail, /^task RATIONAL_DURATION_ACCEPTANCE /m);
  assert.match(detail, /milestone RATIONAL_DURATION_ACCEPTED:[\s\S]*state reached/);
  assert.doesNotMatch(macro, /^task SU_M2R_RATIONAL_DURATION_WORK_PACKAGE /m);
  assert.match(
    macro,
    /milestone RATIONAL_DURATION_ACCEPTED:[\s\S]*state reached/,
  );
  assert.match(
    macro,
    /task SU_M3_DEADLINE_CAPABILITY_WORK_PACKAGE RATIONAL_DURATION_ACCEPTED ->/,
  );
  assert.match(
    macro,
    /task SU_M4_UNIT_MIGRATION_WORK_PACKAGE RATIONAL_DURATION_ACCEPTED ->/,
  );
});

test("SU-M2R accepts a separately versioned exact Rational Duration contract", async () => {
  const [acceptance, requirements, grammar, migration, interfaceSpec] =
    await Promise.all([
      repositoryFile(
        "docs/process/scheduling-units-m2r-contract-acceptance.md",
      ),
      repositoryFile("docs/requirements.md"),
      repositoryFile("docs/specs/dsl-grammar.md"),
      repositoryFile("docs/specs/unit-migration.md"),
      repositoryFile("docs/specs/temporal-unit-interface.md"),
    ]);

  assert.match(
    acceptance,
    /Status: Accepted[\s\S]*Plan task: `RATIONAL_DURATION_CONTRACT`/,
  );
  assert.match(
    requirements,
    /version 2 selects grammar version 3, unit-migration version 2,\s+`Perttool.UnitMigrationResult.v2`/,
  );
  assert.match(
    grammar,
    /DurationV3\s+=\s+\(\s*Decimal\s+\|\s+DurationFraction\s*\),\s+DurationSuffix/,
  );
  assert.match(
    migration,
    /otherwise emit the reduced `numerator\/denominator` form/,
  );
  assert.match(
    migration,
    /upgrade source grammar version 1 or 2 to explicit version 3 when any\s+generated token is a Fraction/,
  );
  assert.match(
    interfaceSpec,
    /Perttool\.UnitMigrationResult\.v2/,
  );
});
