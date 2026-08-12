import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  watch,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const cli = path.join(root, "dist", "cli.js");

async function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function run(args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(
    result.status,
    expectedStatus,
    [
      `unexpected exit for: perttool ${args.join(" ")}`,
      `stdout: ${result.stdout}`,
      `stderr: ${result.stderr}`,
    ].join("\n"),
  );
  return result;
}

function runJson(args, expectedStatus = 0, expectedStderr = "") {
  const result = run([...args, "--format=json"], expectedStatus);
  if (expectedStderr instanceof RegExp) {
    assert.match(result.stderr, expectedStderr);
  } else {
    assert.equal(result.stderr, expectedStderr);
  }
  return JSON.parse(result.stdout);
}

function workflowSource() {
  return `project ASSURANCE_CLI_ACCEPTANCE:
  version 5
  title "Assurance CLI acceptance"
  duration_unit point
  finish DONE
  dag_owner user

milestone START:
  title "Started"
  state reached

milestone A_READY:
  title "A ready"

milestone B_READY:
  title "B ready"

milestone C_READY:
  title "C ready"

milestone DONE:
  title "Done"

task A START -> A_READY:
  title "Plan A"
  duration 1p
  status planned
  priority 100

task B A_READY -> B_READY:
  title "Plan B"
  duration 1p
  status planned
  priority 90

task C START -> C_READY:
  title "Plan C"
  duration 1p
  status planned
  priority 80

task D C_READY -> DONE:
  title "Plan D"
  duration 1p
  status planned
  priority 70

gate B_DONE B_READY -> DONE:
  reason "Both branches must finish"
`;
}

test("all plan assurance cases retain executable cross-surface evidence", async () => {
  const [
    semanticText,
    interfaceText,
    traceText,
    requirementsText,
    acceptanceText,
    planText,
  ] = await Promise.all([
    repositoryText("test/fixtures/plan-assurance-contract-v1.json"),
    repositoryText("test/fixtures/plan-assurance-interface-v1.json"),
    repositoryText("test/fixtures/plan-assurance-acceptance-v1.json"),
    repositoryText("docs/requirements.md"),
    repositoryText("docs/process/plan-assurance-acceptance.md"),
    repositoryText("plans/plan-assurance.pert"),
  ]);
  const semantic = JSON.parse(semanticText);
  const interfaceContract = JSON.parse(interfaceText);
  const trace = JSON.parse(traceText);

  assert.equal(
    trace.schema_version,
    "Perttool.PlanAssuranceAcceptanceTrace.v1",
  );
  assert.equal(
    trace.semantic_contract_cases,
    "test/fixtures/plan-assurance-contract-v1.json",
  );
  assert.equal(
    trace.interface_contract_cases,
    "test/fixtures/plan-assurance-interface-v1.json",
  );
  assert.deepEqual(
    trace.semantic_case_evidence.map(({ id }) => id),
    semantic.cases.map(({ id }) => id),
  );
  assert.deepEqual(
    trace.interface_case_evidence.map(({ id }) => id),
    interfaceContract.cases.map(({ id }) => id),
  );

  const sourceCache = new Map();
  async function assertEvidence(evidence, label) {
    if (!sourceCache.has(evidence.file)) {
      sourceCache.set(evidence.file, await repositoryText(evidence.file));
    }
    const source = sourceCache.get(evidence.file);
    if (evidence.test !== undefined) {
      assert.equal(
        source.includes(JSON.stringify(evidence.test)),
        true,
        `${label}: missing test ${evidence.test}`,
      );
    }
    for (const token of evidence.contains ?? []) {
      assert.equal(source.includes(token), true, `${label}: missing ${token}`);
    }
  }

  for (const entry of [
    ...trace.semantic_case_evidence,
    ...trace.interface_case_evidence,
  ]) {
    assert.equal(entry.evidence.length > 0, true, `${entry.id}: no evidence`);
    for (const evidence of entry.evidence) {
      await assertEvidence(evidence, entry.id);
    }
  }
  assert.deepEqual(
    trace.surfaces.map(({ id }) => id),
    [
      "requirements_and_cases",
      "fixed_hash_vectors",
      "source_core",
      "mutation_and_reseal",
      "authority_and_partial_branch",
      "advance_and_history_force",
      "compatibility",
      "public_cli",
      "real_cli_race",
      "schemas",
      "help_and_guide",
      "package_root",
      "temporary_link",
      "isolated_package",
      "installed_assurance_workflow",
      "durable_acceptance",
    ],
  );
  for (const surface of trace.surfaces) {
    await assertEvidence(surface, surface.id);
  }
  assert.match(
    requirementsText,
    /21\. \[x\] Implement conditional plan assurance under `ASSURE-001`\./,
  );
  assert.match(acceptanceText, /Document status: Accepted 1\.0/);
  assert.match(
    planText,
    /task ASSURE_ACCEPTANCE ASSURE_PUBLIC_READY -> ASSURE_ACCEPTED:[\s\S]*?  status done/,
  );
  assert.match(
    planText,
    /work_event [^:]+:[\s\S]*?  task ASSURE_ACCEPTANCE\n  kind finish/,
  );
});

test("public CLI executes the complete assurance maintenance workflow", (t) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "perttool-assurance-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const plan = path.join(directory, "plan.pert");
  writeFileSync(plan, workflowSource(), "utf8");

  function apply(args) {
    const preview = runJson(args);
    assert.equal(preview.ok, true);
    assert.equal(preview.schema_version, "Perttool.MutationResult.v5");
    assert.equal(preview.write.written, false);
    const checked = runJson(["document", "check", plan]);
    const written = runJson([
      ...args,
      "--actor",
      "user",
      "--write",
      "--expect-digest",
      checked.source_digest,
    ]);
    assert.equal(written.ok, true);
    assert.equal(written.write.written, true);
    assert.equal(written.updated_text, preview.updated_text);
    assert.equal(readFileSync(plan, "utf8"), written.updated_text);
    assert.match(written.updated_text, /^  version 6$/m);
    return written;
  }

  apply([
    "plan-assurance",
    "seal",
    plan,
    "--reason",
    "Accept the complete initial CLI baseline",
  ]);
  let shown = runJson(["plan-assurance", "show", plan]);
  assert.equal(shown.assurance.coverage, "complete");
  assert.deepEqual(
    shown.assurance.task_results.map(({ status }) => status),
    ["verified", "conditional", "verified", "conditional"],
  );
  const hash = run([
    "plan-assurance",
    "hash",
    plan,
    "A",
    "--kind",
    "contract",
  ]);
  assert.equal(hash.stderr, "");
  assert.match(hash.stdout, /^sha256:[0-9a-f]{64}\n$/);
  apply([
    "plan-dependency",
    "add",
    plan,
    "REL_EXEC",
    "A",
    "B",
    "--mode",
    "execution-only",
    "--reason",
    "B execution remains ordered but its reviewed plan is independent",
  ]);
  apply([
    "plan-assurance",
    "reseal",
    plan,
    "--task",
    "B",
    "--reason",
    "Reaccept B without A as a planning input",
  ]);
  apply([
    "plan-dependency",
    "set",
    plan,
    "REL_EXEC",
    "--mode",
    "both",
    "--clear",
    "reason",
  ]);
  apply([
    "plan-assurance",
    "reseal",
    plan,
    "--task",
    "B",
    "--reason",
    "Restore the default reviewed dependency",
  ]);
  apply(["plan-dependency", "remove", plan, "REL_EXEC"]);

  apply([
    "plan-dependency",
    "add",
    plan,
    "REL_PLAN",
    "A",
    "C",
    "--mode",
    "planning-only",
    "--reason",
    "C consumes A planning findings without execution order",
  ]);
  apply([
    "plan-assurance",
    "reseal",
    plan,
    "--task",
    "C",
    "--task",
    "D",
    "--reason",
    "Accept the explicit planning-only branch input",
  ]);
  apply(["plan-dependency", "remove", plan, "REL_PLAN"]);
  apply([
    "plan-assurance",
    "reseal",
    plan,
    "--task",
    "C",
    "--task",
    "D",
    "--reason",
    "Restore the independent branch baseline",
  ]);

  apply(["task", "set", plan, "A", "--title", "Replanned A"]);
  shown = runJson(
    ["plan-assurance", "show", plan],
    0,
    /PTASSURE-202 warning: accepted and computed planning bases differ/,
  );
  assert.deepEqual(
    shown.assurance.replan_required_task_ids,
    ["A", "B"],
  );
  apply([
    "plan-assurance",
    "reseal",
    plan,
    "--task",
    "A",
    "--task",
    "B",
    "--reason",
    "Accept the reviewed A and B replanning",
  ]);

  const contractBeforeLifecycle = run([
    "plan-assurance",
    "hash",
    plan,
    "A",
    "--kind",
    "contract",
  ]).stdout;
  apply([
    "task",
    "finish",
    plan,
    "A",
    "--at",
    "2026-08-04T00:00:00+00:00",
  ]);
  assert.equal(
    run([
      "plan-assurance",
      "hash",
      plan,
      "A",
      "--kind",
      "contract",
    ]).stdout,
    contractBeforeLifecycle,
  );
  apply([
    "task-outcome",
    "add",
    plan,
    "OUT_A",
    "A",
    "--status",
    "conformant",
    "--reason",
    "A completed against the accepted basis",
  ]);
  apply([
    "task-outcome",
    "set",
    plan,
    "OUT_A",
    "--status",
    "changed",
    "--summary",
    "A delivered a reviewed alternative",
    "--reason",
    "Record the changed outcome commitment",
  ]);
  shown = runJson(
    ["plan-assurance", "show", plan],
    0,
    /PTDAG-208 warning:[\s\S]*PTASSURE-202 warning:/,
  );
  assert.equal(
    shown.assurance.task_results.find(({ task_id: id }) => id === "A")
      .outcome_status,
    "changed",
  );
  assert.ok(shown.assurance.replan_required_task_ids.includes("B"));
  apply([
    "plan-assurance",
    "reseal",
    plan,
    "--task",
    "B",
    "--reason",
    "Accept A's versioned changed outcome for B",
  ]);
  shown = runJson(
    ["plan-assurance", "show", plan],
    0,
    /PTDAG-208 warning:/,
  );
  assert.equal(
    shown.assurance.task_results.find(({ task_id: id }) => id === "B").status,
    "verified",
  );
  apply(["task-outcome", "remove", plan, "OUT_A"]);
  shown = runJson(
    ["plan-assurance", "show", plan],
    0,
    /PTDAG-208 warning:[\s\S]*PTASSURE-203 warning:/,
  );
  assert.equal(
    shown.assurance.task_results.find(({ task_id: id }) => id === "A")
      .outcome_status,
    "unavailable",
  );
});

test(
  "assurance CLI output creation loses a real race without overwriting the winner",
  async (t) => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "perttool-assurance-race-"));
    t.after(() => rmSync(directory, { recursive: true, force: true }));
    const source = path.join(directory, "source.pert");
    const output = path.join(directory, "sealed.pert");
    const padding = `# ${"x".repeat(4 * 1024 * 1024)}\n`;
    writeFileSync(source, `${workflowSource()}\n${padding}`, "utf8");

    let wonRace = false;
    const watcher = watch(directory, (_, filename) => {
      if (
        !wonRace &&
        filename?.startsWith(".sealed.pert.perttool-") &&
        filename.endsWith(".tmp")
      ) {
        wonRace = true;
        writeFileSync(output, "external race winner\n", "utf8");
      }
    });
    t.after(() => {
      try {
        watcher.close();
      } catch {
        // The test closes the watcher as soon as the child process exits.
      }
    });

    const child = spawn(process.execPath, [
      cli,
      "plan-assurance",
      "seal",
      source,
      "--reason",
      "Exercise the real output race",
      "--actor",
      "user",
      "--out",
      output,
      "--format=json",
    ], {
      cwd: root,
      encoding: "utf8",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => stdout += chunk);
    child.stderr.on("data", (chunk) => stderr += chunk);
    const status = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    watcher.close();

    assert.equal(wonRace, true);
    assert.equal(status, 5, stderr);
    assert.equal(stderr, "");
    const result = JSON.parse(stdout);
    assert.equal(result.ok, false);
    assert.equal(result.schema_version, "Perttool.CliError.v1");
    assert.equal(result.diagnostics[0].code, "PTIO-501");
    assert.equal(result.diagnostics[0].data.reason, "target_exists");
    assert.equal(readFileSync(output, "utf8"), "external race winner\n");
  },
);
