#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [installedCli, workspace] = process.argv.slice(2);
if (installedCli === undefined || workspace === undefined) {
  process.stderr.write(
    "Usage: node scripts/check-package-file-first.mjs <installed-cli> <workspace>\n",
  );
  process.exit(2);
}
if (!path.isAbsolute(installedCli) || !path.isAbsolute(workspace)) {
  process.stderr.write("installed CLI and workspace must use absolute paths\n");
  process.exit(2);
}

mkdirSync(workspace);
const planPath = path.join(workspace, "file-first.pert");

function invoke(args, options = {}) {
  const result = spawnSync(installedCli, args, {
    cwd: workspace,
    encoding: "utf8",
    input: options.input,
  });
  assert.equal(
    result.error,
    undefined,
    `${args.join(" ")} failed to start: ${result.error?.message}`,
  );
  assert.equal(
    result.status,
    options.expectedStatus ?? 0,
    [
      `unexpected exit for: perttool ${args.join(" ")}`,
      `stdout: ${result.stdout}`,
      `stderr: ${result.stderr}`,
    ].join("\n"),
  );
  return result;
}

function invokeJson(args, options = {}) {
  const result = invoke([...args, "--format=json"], options);
  assert.equal(result.stderr, "", `unexpected stderr for: ${args.join(" ")}`);
  const value = JSON.parse(result.stdout);
  assert.equal(value.cli_contract_version, 8);
  if ((options.expectedStatus ?? 0) === 0) assert.equal(value.ok, true);
  return value;
}

function git(...args) {
  const result = spawnSync("git", ["-C", workspace, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      LC_ALL: "C",
    },
  });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")}\n${result.stderr}`,
  );
  return result.stdout.trim();
}

function checkedDigest() {
  const result = invokeJson(["document", "check", planPath]);
  assert.equal(result.schema_version, "Perttool.CheckResult.v5");
  assert.ok(
    ["FILE_FIRST", "FILE_FIRST_ACCEPTED"].includes(result.document_id),
  );
  return result.source_digest;
}

function writeMutation(args, options = {}) {
  const digest = options.digest ?? checkedDigest();
  const governedCommands = new Set([
    "project set",
    "dag advance",
    "task add",
    "task set",
    "task remove",
    "gate add",
    "gate set",
    "gate remove",
    "milestone add",
    "milestone remove",
    "batch apply",
  ]);
  const assertions = governedCommands.has(args.slice(0, 2).join(" "))
    ? ["--actor", "user"]
    : [];
  const result = invokeJson(
    [...args, ...assertions, "--write", "--expect-digest", digest],
    { input: options.input },
  );
  assert.equal(
    result.schema_version,
    args[0] === "dag" && args[1] === "advance"
      ? "Perttool.AdvanceResult.v3"
      : "Perttool.MutationResult.v5",
  );
  assert.deepEqual(result.write, {
    mode: "in_place",
    target: planPath,
    written: true,
  });
  assert.equal(result.source_digest, digest);
  assert.equal(readFileSync(planPath, "utf8"), result.updated_text);
  return result;
}

const initialized = invokeJson([
  "project",
  "init",
  "FILE_FIRST",
  "--title",
  "File-first package acceptance",
  "--duration-unit",
  "point",
  "--initial-milestone",
  "START",
  "--initial-milestone-title",
  "Acceptance started",
  "--finish",
  "START",
  "--version",
  "2",
  "--as-of",
  "2026-07-24",
  "--initial-milestone-deadline",
  "2026-07-30",
  "--velocity",
  "5p/1d",
  "--out",
  planPath,
]);
assert.equal(initialized.schema_version, "Perttool.InitResult.v1");
assert.equal(initialized.operation, "project.init");
assert.equal(initialized.document_id, "FILE_FIRST");
assert.deepEqual(initialized.write, {
  mode: "out",
  target: planPath,
  written: true,
});
assert.equal(readFileSync(planPath, "utf8"), initialized.candidate_text);
assert.match(
  initialized.candidate_text,
  /^# Existing \.pert plans should normally be maintained through perttool commands; direct DSL editing bypasses goal\/DAG owner-confirmation checks\.\nproject FILE_FIRST:/,
);
assert.doesNotMatch(initialized.candidate_text, /^(?:task|gate|resource) /m);

const initialProject = invokeJson(["project", "show", planPath]);
assert.deepEqual(initialProject.project, {
  id: "FILE_FIRST",
  version: 2,
  title: "File-first package acceptance",
  description: null,
  as_of: {
    kind: "date",
    source_text: "2026-07-24",
    year: 2026,
    month: 7,
    day: 24,
  },
  duration_unit: "point",
  velocity: "5p/1d",
  finish: "START",
  finish_deadline: {
    kind: "date",
    source_text: "2026-07-30",
    year: 2026,
    month: 7,
    day: 30,
  },
  governance: {
    source_contract_version: 1,
    declared: {
      goal_owner: null,
      goal_delegates: null,
      dag_owner: null,
      dag_delegates: null,
    },
    effective: {
      goal_owner: "user",
      goal_delegates: [],
      dag_owner: "user",
      dag_delegates: [],
    },
  },
  plan_assurance_model: null,
  plan_assurance_hash_model: null,
  critical_epsilon: null,
  target_duration: null,
});

const governanceUpgrade = writeMutation([
  "project",
  "set",
  planPath,
  "--goal-owner",
  "user",
  "--goal-delegates",
  "[]",
  "--dag-owner",
  "user",
  "--dag-delegates",
  "[]",
]);
assert.equal(governanceUpgrade.governance.applicable, true);
assert.deepEqual(
  governanceUpgrade.governance.affected_scopes,
  ["goal", "dag"],
);
assert.equal(governanceUpgrade.governance.write_authorized, true);
assert.match(governanceUpgrade.updated_text, /  version 6\n/);

const initialDigest = invokeJson([
  "document",
  "check",
  planPath,
]).source_digest;
const connectedPlan = {
  kind: "batch",
  mutations: [
    {
      kind: "project.set",
      set: {
        id: "FILE_FIRST_ACCEPTED",
        version: 4,
        title: "Installed package workflow",
        description: "Created and maintained only through perttool commands.",
        asOf: "2026-07-25",
        durationUnit: "point",
        velocity: "10p/2d",
        finish: "DONE",
        criticalEpsilon: "1p",
        targetDuration: "8p",
      },
    },
    {
      kind: "resource.add",
      id: "DEV",
      resource: {
        title: "Developers",
        description: "Installed-package acceptance capacity",
        capacity: 1,
      },
    },
    {
      kind: "milestone.add",
      id: "READY",
      milestone: {
        title: "Implementation ready",
        description: "The installed workflow reached review.",
        state: "planned",
        deadline: "2026-07-28",
        tags: ["build", "review"],
      },
    },
    {
      kind: "milestone.add",
      id: "DONE",
      milestone: {
        title: "Acceptance complete",
        description: "The installed workflow is accepted.",
        state: "planned",
        deadline: "2026-07-30",
        tags: ["release"],
      },
    },
    {
      kind: "task.add",
      id: "BUILD",
      from: "START",
      to: "READY",
      task: {
        title: "Exercise installed maintenance",
        description: "Use every task field through the installed CLI.",
        estimate: {
          optimistic: "1p",
          mostLikely: "3p",
          pessimistic: "5p",
        },
        status: "blocked",
        notBefore: "2026-07-25",
        deadline: "2026-07-28",
        priority: 80,
        requirements: [{ resourceId: "DEV", units: 1 }],
        owner: "package-reviewer",
        tags: ["build", "package"],
        blockedReason: "Awaiting installed-package selection.",
        source: "CLI3-012",
      },
    },
    {
      kind: "gate.add",
      id: "APPROVAL",
      from: "READY",
      to: "DONE",
      gate: {
        reason: "Installed-package approval",
      },
    },
  ],
};
const beforeDenied = readFileSync(planPath, "utf8");
const governancePreview = invokeJson(
  ["batch", "apply", planPath, "--request", "-"],
  { input: JSON.stringify(connectedPlan) },
);
assert.equal(governancePreview.schema_version, "Perttool.MutationResult.v5");
assert.equal(governancePreview.governance.applicable, true);
assert.deepEqual(
  governancePreview.governance.affected_scopes,
  ["goal", "dag"],
);
assert.equal(governancePreview.governance.write_authorized, false);
assert.equal(governancePreview.write.written, false);

const governanceDenied = invokeJson(
  [
    "batch",
    "apply",
    planPath,
    "--request",
    "-",
    "--write",
    "--expect-digest",
    initialDigest,
  ],
  {
    input: JSON.stringify(connectedPlan),
    expectedStatus: 1,
  },
);
assert.equal(governanceDenied.ok, false);
assert.deepEqual(
  governanceDenied.diagnostics.map(({ code }) => code),
  ["PTGOV-101"],
);
assert.equal(governanceDenied.updated_text, governancePreview.updated_text);
assert.equal(governanceDenied.write.written, false);
assert.equal(readFileSync(planPath, "utf8"), beforeDenied);

const governanceStale = invokeJson(
  [
    "batch",
    "apply",
    planPath,
    "--request",
    "-",
    "--actor",
    "user",
    "--write",
    "--expect-digest",
    `sha256:${"0".repeat(64)}`,
  ],
  {
    input: JSON.stringify(connectedPlan),
    expectedStatus: 5,
  },
);
assert.equal(governanceStale.ok, false);
assert.deepEqual(
  governanceStale.diagnostics.map(({ code }) => code),
  ["PTIO-501"],
);
assert.equal(readFileSync(planPath, "utf8"), beforeDenied);

const batch = writeMutation(
  ["batch", "apply", planPath, "--request", "-"],
  {
    digest: initialDigest,
    input: JSON.stringify(connectedPlan),
  },
);
assert.equal(batch.operation, "batch.apply");
assert.equal(batch.governance.applicable, true);
assert.deepEqual(batch.governance.affected_scopes, ["goal", "dag"]);
assert.equal(batch.governance.actor, "user");
assert.equal(batch.governance.write_authorized, true);

const fullProject = invokeJson(["project", "show", planPath]);
assert.deepEqual(fullProject.project, {
  id: "FILE_FIRST_ACCEPTED",
  version: 4,
  title: "Installed package workflow",
  description: "Created and maintained only through perttool commands.",
  as_of: {
    kind: "date",
    source_text: "2026-07-25",
    year: 2026,
    month: 7,
    day: 25,
  },
  duration_unit: "point",
  velocity: "10p/2d",
  finish: "DONE",
  finish_deadline: {
    kind: "date",
    source_text: "2026-07-30",
    year: 2026,
    month: 7,
    day: 30,
  },
  governance: {
    source_contract_version: 1,
    declared: {
      goal_owner: "user",
      goal_delegates: [],
      dag_owner: "user",
      dag_delegates: [],
    },
    effective: {
      goal_owner: "user",
      goal_delegates: [],
      dag_owner: "user",
      dag_delegates: [],
    },
  },
  plan_assurance_model: null,
  plan_assurance_hash_model: null,
  critical_epsilon: "1p",
  target_duration: "8p",
});

const blockedNext = invokeJson(["dag", "next", planPath]);
assert.equal(blockedNext.schema_version, "Perttool.NextResult.v7");
assert.equal(blockedNext.recommendation.explanation_status.complete, true);
assert.deepEqual(blockedNext.groups.ready, []);
assert.deepEqual(blockedNext.groups.blocked_now, ["BUILD"]);

const projectUpdate = writeMutation([
  "project",
  "set",
  planPath,
  "--title",
  "Installed package workflow accepted",
  "--description",
  "All project fields remain tool-maintainable.",
  "--as-of",
  "2026-07-26",
  "--velocity",
  "12p/2d",
  "--critical-epsilon",
  "2p",
  "--target-duration",
  "13p",
]);
assert.equal(projectUpdate.operation, "project.set");

const milestoneUpdate = writeMutation([
  "milestone",
  "set",
  planPath,
  "READY",
  "--title",
  "Package ready",
  "--description",
  "The isolated package passed mutation setup.",
  "--state",
  "planned",
  "--deadline",
  "2026-07-29",
  "--remove-tag",
  "build",
  "--add-tag",
  "accepted",
]);
assert.equal(milestoneUpdate.operation, "milestone.set");

const resourceUpdate = writeMutation([
  "resource",
  "set",
  planPath,
  "DEV",
  "--title",
  "Package developers",
  "--description",
  "Capacity verified through the installed CLI",
  "--capacity",
  "2",
]);
assert.equal(resourceUpdate.operation, "resource.set");

const gateUpdate = writeMutation([
  "gate",
  "set",
  planPath,
  "APPROVAL",
  "--reason",
  "Installed package accepted",
]);
assert.equal(gateUpdate.operation, "gate.set");

const taskUpdate = writeMutation([
  "task",
  "set",
  planPath,
  "BUILD",
  "--from",
  "START",
  "--to",
  "READY",
  "--title",
  "Complete installed maintenance",
  "--description",
  "The installed CLI owns every change.",
  "--duration",
  "5p",
  "--status",
  "planned",
  "--not-before",
  "2026-07-26",
  "--deadline",
  "2026-07-29",
  "--priority",
  "90",
  "--owner",
  "package-agent",
  "--source",
  "installed-package",
  "--require",
  "DEV=1",
  "--remove-tag",
  "build",
  "--add-tag",
  "accepted",
  "--clear",
  "blocked_reason",
]);
assert.equal(taskUpdate.operation, "task.set");

const maintainedText = readFileSync(planPath, "utf8");
for (const expected of [
  "project FILE_FIRST_ACCEPTED:",
  'title "Installed package workflow accepted"',
  'description "All project fields remain tool-maintainable."',
  "velocity 12p/2d",
  "critical_epsilon 2p",
  "target_duration 13p",
  "as_of 2026-07-26",
  "resource DEV:",
  'title "Package developers"',
  "capacity 2",
  "milestone READY:",
  "deadline 2026-07-29",
  'title "Package ready"',
  "tags [",
  "accepted",
  "task BUILD START -> READY:",
  'title "Complete installed maintenance"',
  "duration 5p",
  "not_before 2026-07-26",
  "deadline 2026-07-29",
  "priority 90",
  'owner "package-agent"',
  'source "installed-package"',
  "gate APPROVAL READY -> DONE:",
  'reason "Installed package accepted"',
]) {
  assert.ok(maintainedText.includes(expected), `missing maintained field: ${expected}`);
}
assert.doesNotMatch(maintainedText, /blocked_reason|optimistic|most_likely|pessimistic/);

const analysis = invokeJson(["dag", "analyze", planPath]);
assert.equal(analysis.schema_version, "Perttool.AnalysisResult.v6");
assert.equal(analysis.precedence.makespan.display, "5");
assert.equal(analysis.resource.makespan.display, "5");
assert.equal(analysis.temporal.precedence.state, "available");
assert.ok(analysis.temporal.deadline_evaluations.length > 0);

const selected = invokeJson(["dag", "next", planPath]);
assert.deepEqual(selected.groups.ready, ["BUILD"]);
assert.deepEqual(selected.groups.runnable_now, ["BUILD"]);
assert.deepEqual(selected.recommendation.recommended_task_ids, ["BUILD"]);
assert.deepEqual(
  selected.temporal.authority.startable_recommended_task_ids,
  ["BUILD"],
);
assert.equal(selected.recommendation.explanation_status.complete, true);

writeMutation([
  "task",
  "set",
  planPath,
  "BUILD",
  "--status",
  "active",
]);
const active = invokeJson(["dag", "next", planPath]);
assert.deepEqual(active.groups.active, ["BUILD"]);

const finished = writeMutation(["task", "finish", planPath, "BUILD"]);
assert.equal(finished.operation, "task.finish");
assert.match(readFileSync(planPath, "utf8"), /task BUILD START -> READY:[\s\S]*status done/);

const completedAnalysis = invokeJson(["dag", "analyze", planPath]);
assert.equal(completedAnalysis.ok, true);
const completedNext = invokeJson(["dag", "next", planPath]);
assert.deepEqual(completedNext.groups.ready, []);
assert.deepEqual(completedNext.recommendation.recommended_task_ids, []);

git("init", "--quiet", "-b", "main");
git("config", "user.name", "Perttool Package Test");
git("config", "user.email", "perttool@example.invalid");
git("add", "--", path.basename(planPath));
git("commit", "--quiet", "-m", "pre-advance snapshot");

const migration = invokeJson([
  "document",
  "migrate",
  planPath,
  "--target-grammar",
  "7",
  "--write",
  "--expect-digest",
  checkedDigest(),
]);
assert.equal(
  migration.schema_version,
  "Perttool.MilestoneAcceptanceMigrationResult.v1",
);
assert.equal(migration.target_grammar_version, 7);

const acceptanceBlocked = invokeJson(
  ["dag", "advance", planPath, "--actor", "user"],
  { expectedStatus: 1 },
);
assert.equal(acceptanceBlocked.schema_version, "Perttool.AdvanceResult.v3");
assert.equal(acceptanceBlocked.acceptance_guard.status, "blocked");
for (const [index, blocked] of acceptanceBlocked.acceptance_guard
  .blocked_milestones.entries()) {
  const setId = `ACCEPT_${blocked.milestone_id}_${index + 1}`;
  const criterionId = `OWNER_ACCEPTED_${index + 1}`;
  const replacement = invokeJson([
    "milestone",
    "acceptance",
    "replace",
    planPath,
    blocked.milestone_id,
    setId,
    "R1",
    "--criterion",
    `${criterionId}:required:owner:Installed package acceptance`,
    "--actor",
    "user",
    "--write",
    "--expect-digest",
    checkedDigest(),
  ]);
  assert.equal(replacement.schema_version, "Perttool.MutationResult.v5");
  assert.equal(replacement.write.written, true);
  const waiver = invokeJson([
    "milestone",
    "acceptance",
    "waive",
    planPath,
    setId,
    criterionId,
    `WAIVE_${blocked.milestone_id}_${index + 1}`,
    "--reason",
    "Installed package acceptance fixture",
    "--actor",
    "user",
    "--write",
    "--expect-digest",
    checkedDigest(),
  ]);
  assert.equal(waiver.schema_version, "Perttool.MutationResult.v5");
  assert.equal(waiver.write.written, true);
}
const shownAcceptance = invokeJson([
  "milestone",
  "acceptance",
  "show",
  planPath,
]);
assert.equal(
  shownAcceptance.schema_version,
  "Perttool.MilestoneAcceptanceResult.v1",
);
assert.equal(
  acceptanceBlocked.acceptance_guard.blocked_milestones.every(
    ({ milestone_id: milestoneId }) =>
      shownAcceptance.milestones.some(
        ({ milestone_id, acceptance }) =>
          milestone_id === milestoneId && acceptance === "accepted",
      ),
  ),
  true,
);

git("add", "--", path.basename(planPath));
git("commit", "--quiet", "-m", "record milestone acceptance");

const advanceHeadBefore = git("rev-parse", "HEAD");
const advanceIndexBefore = git(
  "ls-files",
  "--stage",
  "--",
  path.basename(planPath),
);
const advanceText = invoke([
  "dag",
  "advance",
  planPath,
  "--color=never",
]);
assert.match(
  advanceText.stderr,
  /^HISTORY_GUARD status=not_applicable cause=preview$/m,
);
assert.match(
  advanceText.stderr,
  /^HISTORY_CHANGE source_bytes=\d+ candidate_bytes=\d+ added_lines=\d+ removed_lines=\d+$/m,
);
assert.match(
  advanceText.stderr,
  /^HISTORY_ENTITIES destructive=.+ overlapping=-$/m,
);
assert.match(
  advanceText.stderr,
  /^HISTORY_FORCE requested=false$/m,
);

const advanced = writeMutation(["dag", "advance", planPath]);
assert.equal(advanced.operation, "dag.advance");
assert.equal(advanced.history_guard.status, "passed");
assert.equal(advanced.history_guard.cause, "baseline_matches");
assert.equal(advanced.history_guard.force_requested, false);
assert.equal(advanced.history_guard.repository_relative_path, "file-first.pert");
assert.equal(advanced.history_guard.head_commit_id, advanceHeadBefore);
assert.deepEqual(advanced.advance.removed_task_ids, ["BUILD"]);
assert.deepEqual(advanced.advance.removed_gate_ids, ["APPROVAL"]);
assert.deepEqual(advanced.advance.removed_milestone_ids, ["READY", "START"]);
assert.deepEqual(advanced.advance.frontier_after, ["DONE"]);
assert.equal(git("rev-parse", "HEAD"), advanceHeadBefore);
assert.equal(
  git("ls-files", "--stage", "--", path.basename(planPath)),
  advanceIndexBefore,
);

const advancedText = readFileSync(planPath, "utf8");
assert.doesNotMatch(advancedText, /^(?:task BUILD|gate APPROVAL|milestone START|milestone READY):?/m);
assert.match(advancedText, /resource DEV:/);
assert.match(advancedText, /milestone DONE:[\s\S]*state reached/);

const finalProject = invokeJson(["project", "show", planPath]);
assert.equal(finalProject.project.id, "FILE_FIRST_ACCEPTED");
assert.equal(finalProject.project.finish, "DONE");
assert.equal(finalProject.project.velocity, "12p/2d");

const finalCheck = invokeJson(["document", "check", planPath]);
assert.equal(finalCheck.summary.tasks, 0);
assert.equal(finalCheck.summary.gates, 0);
assert.equal(finalCheck.summary.milestones, 1);
assert.equal(finalCheck.summary.resources, 1);

const finalAnalysis = invokeJson(["dag", "analyze", planPath]);
assert.equal(finalAnalysis.precedence.makespan.display, "0");
assert.equal(finalAnalysis.resource.makespan.display, "0");
const finalNext = invokeJson(["dag", "next", planPath]);
assert.deepEqual(finalNext.groups, {
  active: [],
  suspended: [],
  ready: [],
  runnable_now: [],
  blocked_now: [],
  upcoming: [],
});
assert.equal(finalNext.recommendation.explanation_status.complete, true);

const beforeMigrationText = readFileSync(planPath, "utf8");
const migrationPreview = invokeJson([
  "project",
  "migrate-unit",
  planPath,
  "--to-unit",
  "day",
]);
assert.equal(
  migrationPreview.schema_version,
  "Perttool.UnitMigrationResult.v3",
);
assert.equal(migrationPreview.changed, true);
assert.equal(migrationPreview.source_unit, "point");
assert.equal(migrationPreview.target_unit, "day");
assert.equal(
  migrationPreview.grammar_disposition,
  "retained",
);
assert.ok(
  migrationPreview.converted_fields.some(
    ({ canonical_token: token }) => token.includes("/"),
  ),
);
assert.equal(readFileSync(planPath, "utf8"), beforeMigrationText);

const migrationWrite = invokeJson([
  "project",
  "migrate-unit",
  planPath,
  "--to-unit",
  "day",
  "--write",
  "--expect-digest",
  checkedDigest(),
]);
assert.equal(migrationWrite.write.mode, "in_place");
assert.equal(migrationWrite.write.written, true);
assert.equal(migrationWrite.target_grammar_version, 7);
assert.equal(readFileSync(planPath, "utf8"), migrationWrite.updated_text);

const repeatedMigration = invokeJson([
  "project",
  "migrate-unit",
  planPath,
  "--to-unit",
  "day",
]);
assert.equal(repeatedMigration.changed, false);
assert.equal(repeatedMigration.reversibility, "not_applicable");

const inverseMigration = invokeJson([
  "project",
  "migrate-unit",
  planPath,
  "--to-unit",
  "point",
  "--replacement-velocity",
  "12p/2d",
  "--write",
  "--expect-digest",
  checkedDigest(),
]);
assert.equal(inverseMigration.write.written, true);
assert.equal(inverseMigration.target_unit, "point");
assert.ok(
  ["exact", "values_exact_metadata_changed"].includes(
    inverseMigration.reversibility,
  ),
);
const inverseText = readFileSync(planPath, "utf8");
assert.match(inverseText, /duration_unit point/);
assert.match(inverseText, /critical_epsilon 2p/);
assert.match(inverseText, /target_duration 13p/);
assert.match(inverseText, /deadline 2026-07-30/);
assert.equal(invokeJson(["document", "check", planPath]).ok, true);

process.stdout.write("installed package Contract 8 file-first acceptance passed\n");
