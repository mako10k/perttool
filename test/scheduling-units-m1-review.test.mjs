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

test("SU-M1 acceptance closes every interface observation", async () => {
  const acceptance = await repositoryFile(
    "docs/process/scheduling-units-m1-acceptance.md",
  );

  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.match(acceptance, /There are no open SU-M1 review findings\./);
  for (const findingId of ["SU1-R1", "SU1-R2", "SU1-R3", "SU1-R4"]) {
    assert.match(
      acceptance,
      new RegExp(`\\| \`${findingId}\` \\|[^\\n]+\\| Resolved \\|`),
    );
  }

  const tracedIds = [
    ...acceptance.matchAll(/^\| `(TUI-\d{3})` \|/gm),
  ].map((match) => match[1]);
  assert.deepEqual(
    tracedIds,
    Array.from(
      { length: 18 },
      (_, index) => `TUI-${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("SU-M1 accepted identities and requirements stay aligned", async () => {
  const [
    acceptance,
    requirements,
    interfaceContract,
    calendarContract,
    deadlineContract,
    migrationContract,
  ] = await Promise.all([
    repositoryFile("docs/process/scheduling-units-m1-acceptance.md"),
    repositoryFile("docs/requirements.md"),
    repositoryFile("docs/specs/temporal-unit-interface.md"),
    repositoryFile("docs/specs/temporal-calendar.md"),
    repositoryFile("docs/specs/temporal-deadline.md"),
    repositoryFile("docs/specs/unit-migration.md"),
  ]);

  const normativeContracts = [
    interfaceContract,
    calendarContract,
    deadlineContract,
    migrationContract,
  ].join("\n");
  for (const identity of [
    "perttool.calendar-projection",
    "perttool.calendar.continuous-fixed-offset",
    "perttool.deadline-evaluation",
    "perttool.temporal-precedence-earliest",
    "perttool.temporal-parallel-sgs",
    "perttool.unit-migration",
    "perttool.temporal-unit-interface",
    "Perttool.CheckResult.v2",
    "Perttool.ProjectResult.v2",
    "Perttool.AnalysisResult.v3",
    "Perttool.NextResult.v4",
    "Perttool.UnitMigrationResult.v1",
  ]) {
    assert.ok(acceptance.includes(identity), identity);
    assert.ok(normativeContracts.includes(identity), identity);
  }

  assert.match(
    requirements,
    /13\. \[x\] Temporal properties, deadlines, and unit migration SU-M1 contract/,
  );
  assert.match(
    requirements,
    /- \[x\] \[Cross-cutting SU-M1 contract review\]\(process\/scheduling-units-m1-acceptance\.md\)/,
  );
});

test("macro rolls accepted history forward while SU-M2 retains its acceptance snapshot", async () => {
  const [plan, detail, backlog, design, acceptance] = await Promise.all([
    repositoryFile("plans/scheduling-units.pert"),
    repositoryFile("plans/scheduling-units-m2.pert"),
    repositoryFile("docs/backlog.md"),
    repositoryFile("docs/basic-design.md"),
    repositoryFile("docs/process/scheduling-units-m2-acceptance.md"),
  ]);

  assert.match(
    plan,
    /SU-M1, SU-M2, SU-M2R, SU-M3, and SU-M4 are accepted, rolled up once, and advanced/,
  );
  assert.doesNotMatch(plan, /task SU_M2_TEMPORAL_SURFACE_WORK_PACKAGE/);
  assert.doesNotMatch(plan, /task SU_M2R_RATIONAL_DURATION_WORK_PACKAGE/);
  assert.doesNotMatch(plan, /milestone RATIONAL_DURATION_ACCEPTED:/);
  assert.doesNotMatch(plan, /task SU_M3_DEADLINE_CAPABILITY_WORK_PACKAGE/);
  assert.doesNotMatch(plan, /task SU_M4_UNIT_MIGRATION_WORK_PACKAGE/);
  assert.match(
    plan,
    /milestone DELIVERY_INPUT_READY:[\s\S]*state reached/,
  );
  assert.match(
    plan,
    /task SU_M5_INTEGRATED_ACCEPTANCE[\s\S]*Atomically cut over CLI Contract 4, public result schemas, registry dispatch, text\/JSON help, Guide, README, installed-package workflows, and Next v4 normal start authority/,
  );

  const taskIds = [...detail.matchAll(/^task ([A-Z0-9_]+) /gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(taskIds, []);
  const points = [...detail.matchAll(/^  duration (\d+)p$/gm)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
  assert.equal(points, 0);
  assert.match(
    detail,
    /milestone M2_FOUNDATIONS_ACCEPTED:[\s\S]*state reached/,
  );
  assert.match(
    detail,
    /The active runtime remains Grammar 1 and CLI Contract 3\./,
  );
  assert.match(
    detail,
    /Public Contract 4 schemas, descriptors, help, Guide, README examples, installed-package temporal workflows, temporal analysis, Next v4 authority, unit migration, and publication are outside this plan\./,
  );

  for (const document of [backlog, design, acceptance]) {
    assert.match(document, /SU-M2/);
    assert.match(document, /SU-M3/);
    assert.match(document, /SU-M4/);
    assert.match(document, /SU-M5/);
    assert.match(document, /atomic/i);
  }
  assert.match(
    design,
    /No earlier\s+milestone is a partial public Contract 4 cutover\./,
  );
  assert.match(
    acceptance,
    /There are no open SU-M2 acceptance findings\./,
  );
});
