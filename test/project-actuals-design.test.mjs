import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist/cli.js");

async function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function runJson(...args) {
  const result = spawnSync(process.execPath, [cli, ...args, "--format=json"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

test("project actuals contract fixes source, public, and evidence boundaries", async () => {
  const [requirements, adr, grammar, specification, examples, acceptance] =
    await Promise.all([
    repositoryText("docs/requirements.md"),
    repositoryText("docs/adr/0006-explicit-work-events-in-git-history.md"),
    repositoryText("docs/specs/dsl-grammar.md"),
    repositoryText("docs/specs/project-actuals.md"),
    repositoryText("docs/examples/project-actuals.md"),
    repositoryText("docs/process/project-actuals-contract-review.md"),
  ]);

  assert.match(requirements, /### 7\.8 Project actuals and work lifecycle/);
  assert.match(adr, /- Status: Accepted/);
  assert.match(
    adr,
    /commit\s+timestamp does not prove when work actually started/,
  );
  assert.match(grammar, /### 20\.4 Grammar version 5 project-actuals delta/);
  assert.match(grammar, /WorkEventDeclV5 = "work_event"/);
  assert.match(grammar, /PersonHoursV5 = ExactUnsignedV5, "ph"/);
  assert.match(grammar, /Unit migration version 3 accepts Grammar 5/);
  assert.match(specification, /- Status: Normative target 1\.0/);
  assert.match(specification, /Target CLI contract version: 6/);
  assert.match(specification, /Perttool\.ProjectHistoryResult\.v1/);
  assert.match(specification, /Perttool\.VelocityObservationResult\.v1/);
  assert.match(specification, /Perttool\.NextResult\.v5/);
  assert.match(specification, /`PTACT-108`/);
  assert.match(specification, /`PTHIS-104`/);
  assert.match(specification, /`PTOBS-101`/);
  assert.match(specification, /`declared_actual`/);
  assert.match(specification, /`git_recorded_transition`/);
  assert.match(specification, /It does not mutate `project\.velocity`/);
  assert.match(
    specification,
    /The contract MUST NOT silently\s+equate one day with 24 hours/,
  );
  assert.match(specification, /Grammar 1 through 4 reject/);
  assert.match(
    acceptance,
    /There are no open semantic or public-contract\s+findings/,
  );
  assert.match(acceptance, /Runtime status: not implemented/);
  assert.match(examples, /work_event WE-start:/);
  assert.match(examples, /effort 8ph/);
});

test("all fourteen PACT cases have a dependency-ordered machine fixture", async () => {
  const [examples, fixtureText] = await Promise.all([
    repositoryText("docs/examples/project-actuals.md"),
    repositoryText("test/fixtures/project-actuals-contract-v1.json"),
  ]);
  const fixture = JSON.parse(fixtureText);

  const caseIds = [...examples.matchAll(/^## (PACT-\d{3}):/gm)].map(
    ([, caseId]) => caseId,
  );
  const expectedIds = Array.from({ length: 14 }, (_, index) =>
    `PACT-${String(index + 1).padStart(3, "0")}`);
  assert.deepEqual(caseIds, expectedIds);
  assert.equal(
    fixture.schema_version,
    "Perttool.ProjectActualsContractCases.v1",
  );
  assert.equal(fixture.grammar_version, 5);
  assert.equal(fixture.cli_contract_version, 6);
  assert.deepEqual(
    fixture.cases.map(({ id }) => id),
    expectedIds,
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
});

test("project actuals plan retains the completed lifecycle snapshot", async () => {
  const plan = "plans/project-actuals.pert";
  const [
    source,
    contractAcceptance,
    sourceAcceptance,
    probeAcceptance,
    finishAcceptance,
    historyAcceptance,
    lifecycleAcceptance,
  ] = await Promise.all([
    repositoryText(plan),
    repositoryText("docs/process/project-actuals-contract-review.md"),
    repositoryText(
      "docs/process/project-actuals-source-core-acceptance.md",
    ),
    repositoryText(
      "docs/process/project-actuals-git-history-probe-acceptance.md",
    ),
    repositoryText(
      "docs/process/project-actuals-finish-acceptance.md",
    ),
    repositoryText(
      "docs/process/project-actuals-history-acceptance.md",
    ),
    repositoryText(
      "docs/process/project-actuals-lifecycle-acceptance.md",
    ),
  ]);
  const checked = runJson("document", "check", plan);
  const analyzed = runJson("dag", "analyze", plan);
  const next = runJson("dag", "next", plan);

  assert.deepEqual(checked.summary, {
    resources: 8,
    milestones: 7,
    tasks: 4,
    gates: 2,
    errors: 0,
    warnings: 1,
  });
  assert.deepEqual(
    checked.diagnostics.map(({ code, entity_id }) => [code, entity_id]),
    [["PTDAG-208", "LIFECYCLE_READY"]],
  );
  assert.doesNotMatch(source, /task ACTUALS_CONTRACT_REVIEW/);
  assert.doesNotMatch(
    source,
    /milestone ACTUALS_CONTRACT_READY:/,
  );
  assert.doesNotMatch(source, /milestone ACTUAL_SOURCE_READY:/);
  assert.match(
    source,
    /milestone FINISH_ACTUALS_READY:[\s\S]*?  state reached/,
  );
  assert.match(contractAcceptance, /Plan task: `ACTUALS_CONTRACT_REVIEW`/);
  assert.match(sourceAcceptance, /`ACTUAL_SOURCE_CORE` is accepted/);
  assert.match(
    probeAcceptance,
    /`ACTUAL_GIT_HISTORY_PROBE` is accepted/,
  );
  assert.match(probeAcceptance, /Git commit `2198a0b`/);
  assert.match(finishAcceptance, /`FINISH_ACTUALS` is accepted/);
  assert.match(finishAcceptance, /Git commit `2af13c4`/);
  assert.match(historyAcceptance, /`PROJECT_HISTORY` is accepted/);
  assert.match(historyAcceptance, /Git commit `c0eff39`/);
  assert.match(lifecycleAcceptance, /`WORK_LIFECYCLE` is accepted/);
  assert.match(
    lifecycleAcceptance,
    /exact completed 7p pre-advance snapshot/,
  );
  assert.doesNotMatch(source, /task ACTUAL_SOURCE_CORE/);
  assert.doesNotMatch(source, /task ACTUAL_GIT_HISTORY_PROBE/);
  assert.doesNotMatch(source, /task FINISH_ACTUALS/);
  assert.doesNotMatch(source, /task PROJECT_HISTORY/);
  assert.doesNotMatch(source, /milestone HISTORY_INPUT_READY:/);
  assert.match(
    source,
    /milestone PROJECT_HISTORY_READY:[\s\S]*?  state reached/,
  );
  assert.match(
    source,
    /task WORK_LIFECYCLE[\s\S]*?  status done/,
  );
  assert.doesNotMatch(
    source,
    /milestone LIFECYCLE_READY:\n  title[^\n]*\n  state reached/,
  );
  assert.equal(analyzed.precedence.makespan.numerator, "15");
  assert.equal(analyzed.precedence.makespan.denominator, "1");
  assert.equal(analyzed.resource.makespan.numerator, "15");
  assert.equal(analyzed.resource.resource_delay.numerator, "0");
  assert.equal(
    analyzed.velocity_forecast.precedence_makespan.numerator,
    "30",
  );
  assert.equal(
    analyzed.velocity_forecast.precedence_makespan.denominator,
    "29",
  );
  assert.equal(analyzed.velocity_forecast.resource_makespan.numerator, "30");
  assert.equal(analyzed.velocity_forecast.resource_makespan.denominator, "29");
  assert.deepEqual(next.groups.active, []);
  assert.deepEqual(next.groups.ready, ["VELOCITY_OBSERVATION"]);
  assert.deepEqual(next.recommendation.recommended_task_ids, [
    "VELOCITY_OBSERVATION",
  ]);
  assert.deepEqual(next.temporal.authority.startable_recommended_task_ids, [
    "VELOCITY_OBSERVATION",
  ]);
  assert.deepEqual(
    Object.fromEntries(
      next.recommendation.task_decisions.map(({ subject_task_id, tier }) => [
        subject_task_id,
        tier,
      ]),
    ),
    {
      VELOCITY_OBSERVATION: "recommended",
    },
  );
});

test("active Contract 5 does not expose planned actuals commands", () => {
  const help = runJson("help");
  const actions = Object.fromEntries(
    help.resources.map(({ name, actions: resourceActions }) => [
      name,
      resourceActions,
    ]),
  );

  assert.deepEqual(actions.task, ["add", "set", "remove", "finish"]);
  assert.deepEqual(actions.project, ["init", "show", "set", "migrate-unit"]);
  assert.equal(actions.task.includes("start"), false);
  assert.equal(actions.task.includes("suspend"), false);
  assert.equal(actions.task.includes("resume"), false);
  assert.equal(actions.project.includes("history"), false);
  assert.equal(actions.project.includes("observe-velocity"), false);
});
