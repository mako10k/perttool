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
  assert.match(specification, /- Status: Normative 1\.0/);
  assert.match(specification, /Active CLI contract version: 6/);
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

test("all fourteen PACT cases retain executable acceptance evidence", async () => {
  const [contractText, traceText] = await Promise.all([
    repositoryText("test/fixtures/project-actuals-contract-v1.json"),
    repositoryText("test/fixtures/project-actuals-acceptance-v1.json"),
  ]);
  const contract = JSON.parse(contractText);
  const trace = JSON.parse(traceText);

  assert.equal(
    trace.schema_version,
    "Perttool.ProjectActualsAcceptanceTrace.v1",
  );
  assert.equal(
    trace.contract_cases,
    "test/fixtures/project-actuals-contract-v1.json",
  );
  assert.deepEqual(
    trace.cases.map(({ id }) => id),
    contract.cases.map(({ id }) => id),
  );

  const sourceCache = new Map();
  async function evidenceSource(file) {
    if (!sourceCache.has(file)) {
      sourceCache.set(file, await repositoryText(file));
    }
    return sourceCache.get(file);
  }
  async function assertEvidence(evidence, label) {
    const source = await evidenceSource(evidence.file);
    if (evidence.test !== undefined) {
      assert.equal(
        source.includes(`test(${JSON.stringify(evidence.test)}`),
        true,
        `${label}: missing test ${evidence.test}`,
      );
    }
    for (const token of evidence.contains ?? []) {
      assert.equal(
        source.includes(token),
        true,
        `${label}: missing token ${token}`,
      );
    }
  }

  for (const contractCase of trace.cases) {
    assert.equal(
      contractCase.evidence.length > 0,
      true,
      `${contractCase.id}: missing executable evidence`,
    );
    for (const evidence of contractCase.evidence) {
      await assertEvidence(evidence, contractCase.id);
    }
  }

  assert.deepEqual(
    trace.surfaces.map(({ id }) => id),
    [
      "requirements_and_cases",
      "source_core",
      "lifecycle",
      "advance",
      "real_git_history",
      "core_observation",
      "cli",
      "schemas",
      "help",
      "package_root",
      "linked_cli",
      "installed_workflow",
      "published_contract_5_record",
    ],
  );
  for (const surface of trace.surfaces) {
    await assertEvidence(surface, surface.id);
  }
});

test("project actuals plan retains every accepted slice and public cutover", async () => {
  const plan = "plans/project-actuals.pert";
  const [
    source,
    contractAcceptance,
    sourceAcceptance,
    probeAcceptance,
    finishAcceptance,
    historyAcceptance,
    lifecycleAcceptance,
    observationAcceptance,
    publicAcceptance,
    finalAcceptance,
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
    repositoryText(
      "docs/process/project-actuals-velocity-observation-acceptance.md",
    ),
    repositoryText(
      "docs/process/project-actuals-public-contract-acceptance.md",
    ),
    repositoryText("docs/process/project-actuals-acceptance.md"),
  ]);
  const checked = runJson("document", "check", plan);
  const analyzed = runJson("dag", "analyze", plan);
  const next = runJson("dag", "next", plan);

  assert.deepEqual(checked.summary, {
    resources: 8,
    milestones: 1,
    tasks: 0,
    gates: 0,
    errors: 0,
    warnings: 0,
  });
  assert.deepEqual(checked.diagnostics, []);
  assert.doesNotMatch(source, /task ACTUALS_CONTRACT_REVIEW/);
  assert.doesNotMatch(
    source,
    /milestone ACTUALS_CONTRACT_READY:/,
  );
  assert.doesNotMatch(source, /milestone ACTUAL_SOURCE_READY:/);
  assert.doesNotMatch(source, /milestone FINISH_ACTUALS_READY:/);
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
  assert.match(lifecycleAcceptance, /Git commit `518a59e`/);
  assert.match(
    observationAcceptance,
    /`VELOCITY_OBSERVATION` is accepted/,
  );
  assert.match(
    observationAcceptance,
    /exact completed 5p pre-advance snapshot/,
  );
  assert.match(observationAcceptance, /Git commit `19b060a`/);
  assert.match(
    publicAcceptance,
    /`ACTUALS_PUBLIC_CONTRACT` is accepted/,
  );
  assert.match(publicAcceptance, /exact completed 6p pre-advance snapshot/);
  assert.match(publicAcceptance, /Git commit `753efea`/);
  assert.match(finalAcceptance, /`ACTUALS_ACCEPTANCE` is accepted/);
  assert.match(finalAcceptance, /exact completed 4p pre-advance snapshot/);
  assert.match(finalAcceptance, /Git commit `f994fa2`/);
  assert.doesNotMatch(source, /task ACTUAL_SOURCE_CORE/);
  assert.doesNotMatch(source, /task ACTUAL_GIT_HISTORY_PROBE/);
  assert.doesNotMatch(source, /task FINISH_ACTUALS/);
  assert.doesNotMatch(source, /task PROJECT_HISTORY/);
  assert.doesNotMatch(source, /milestone HISTORY_INPUT_READY:/);
  assert.doesNotMatch(source, /milestone PROJECT_HISTORY_READY:/);
  assert.doesNotMatch(source, /task WORK_LIFECYCLE/);
  assert.doesNotMatch(source, /milestone LIFECYCLE_READY:/);
  assert.doesNotMatch(source, /task VELOCITY_OBSERVATION/);
  assert.doesNotMatch(source, /milestone VELOCITY_OBSERVATION_READY:/);
  assert.doesNotMatch(source, /milestone ACTUALS_INTEGRATED_INPUT:/);
  assert.doesNotMatch(source, /task ACTUALS_PUBLIC_CONTRACT/);
  assert.doesNotMatch(source, /milestone ACTUALS_PUBLIC_READY:/);
  assert.doesNotMatch(source, /task ACTUALS_ACCEPTANCE /);
  assert.match(
    source,
    /milestone ACTUALS_ACCEPTED:[\s\S]*?  state reached/,
  );
  assert.equal(analyzed.precedence.makespan.numerator, "0");
  assert.equal(analyzed.precedence.makespan.denominator, "1");
  assert.equal(analyzed.resource.makespan.numerator, "0");
  assert.equal(analyzed.resource.resource_delay.numerator, "0");
  assert.equal(analyzed.velocity_forecast.precedence_makespan.numerator, "0");
  assert.equal(analyzed.velocity_forecast.resource_makespan.numerator, "0");
  assert.deepEqual(next.groups.active, []);
  assert.deepEqual(next.groups.ready, []);
  assert.deepEqual(next.recommendation.recommended_task_ids, []);
  assert.deepEqual(
    next.temporal.authority.startable_recommended_task_ids,
    [],
  );
  assert.deepEqual(
    Object.fromEntries(
      next.recommendation.task_decisions.map(({ subject_task_id, tier }) => [
        subject_task_id,
        tier,
      ]),
    ),
    {},
  );
});

test("active Contract 6 exposes the complete project actuals command set", () => {
  const help = runJson("help");
  const actions = Object.fromEntries(
    help.resources.map(({ name, actions: resourceActions }) => [
      name,
      resourceActions,
    ]),
  );

  assert.equal(help.cli_contract_version, 6);
  assert.deepEqual(
    actions.task,
    ["add", "finish", "remove", "resume", "set", "start", "suspend"],
  );
  assert.deepEqual(
    actions.project,
    ["history", "init", "migrate-unit", "observe-velocity", "set", "show"],
  );
});
