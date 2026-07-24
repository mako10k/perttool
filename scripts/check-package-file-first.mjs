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
  assert.equal(value.cli_contract_version, 3);
  if ((options.expectedStatus ?? 0) === 0) assert.equal(value.ok, true);
  return value;
}

function checkedDigest() {
  const result = invokeJson(["document", "check", planPath]);
  assert.equal(result.schema_version, "Perttool.CheckResult.v1");
  assert.equal(result.document_id, "FILE_FIRST_ACCEPTED");
  return result.source_digest;
}

function writeMutation(args, options = {}) {
  const digest = options.digest ?? checkedDigest();
  const result = invokeJson(
    [...args, "--write", "--expect-digest", digest],
    { input: options.input },
  );
  assert.equal(result.schema_version, "Perttool.MutationResult.v1");
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
  "1",
  "--as-of",
  "2026-07-24",
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
assert.match(initialized.candidate_text, /^project FILE_FIRST:/);
assert.doesNotMatch(initialized.candidate_text, /^(?:task|gate|resource) /m);

const initialProject = invokeJson(["project", "show", planPath]);
assert.deepEqual(initialProject.project, {
  id: "FILE_FIRST",
  version: 1,
  title: "File-first package acceptance",
  description: null,
  as_of: "2026-07-24",
  duration_unit: "point",
  velocity: "5p/1d",
  finish: "START",
  critical_epsilon: null,
  target_duration: null,
});

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
        version: 1,
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
const batch = writeMutation(
  ["batch", "apply", planPath, "--request", "-"],
  {
    digest: initialDigest,
    input: JSON.stringify(connectedPlan),
  },
);
assert.equal(batch.operation, "batch.apply");

const fullProject = invokeJson(["project", "show", planPath]);
assert.deepEqual(fullProject.project, {
  id: "FILE_FIRST_ACCEPTED",
  version: 1,
  title: "Installed package workflow",
  description: "Created and maintained only through perttool commands.",
  as_of: "2026-07-25",
  duration_unit: "point",
  velocity: "10p/2d",
  finish: "DONE",
  critical_epsilon: "1p",
  target_duration: "8p",
});

const blockedNext = invokeJson(["dag", "next", planPath]);
assert.equal(blockedNext.schema_version, "Perttool.NextResult.v3");
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
  "resource DEV:",
  'title "Package developers"',
  "capacity 2",
  "milestone READY:",
  'title "Package ready"',
  "tags [",
  "accepted",
  "task BUILD START -> READY:",
  'title "Complete installed maintenance"',
  "duration 5p",
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
assert.equal(analysis.schema_version, "Perttool.AnalysisResult.v2");
assert.equal(analysis.precedence.makespan.display, "5");
assert.equal(analysis.resource.makespan.display, "5");

const selected = invokeJson(["dag", "next", planPath]);
assert.deepEqual(selected.groups.ready, ["BUILD"]);
assert.deepEqual(selected.groups.runnable_now, ["BUILD"]);
assert.deepEqual(selected.recommendation.recommended_task_ids, ["BUILD"]);
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

const advanced = writeMutation(["dag", "advance", planPath]);
assert.equal(advanced.operation, "dag.advance");
assert.deepEqual(advanced.advance.removed_task_ids, ["BUILD"]);
assert.deepEqual(advanced.advance.removed_gate_ids, ["APPROVAL"]);
assert.deepEqual(advanced.advance.removed_milestone_ids, ["READY", "START"]);
assert.deepEqual(advanced.advance.frontier_after, ["DONE"]);

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
  ready: [],
  runnable_now: [],
  blocked_now: [],
  upcoming: [],
});
assert.equal(finalNext.recommendation.explanation_status.complete, true);

process.stdout.write("installed package file-first acceptance passed\n");
