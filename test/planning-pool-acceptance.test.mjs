import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as coreApi from "../dist/core/index.js";
import * as nodeApi from "../dist/node/index.js";
import * as rootApi from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function expectedIds(prefix, count) {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, "0")}`,
  );
}

test("PPA-001 through PPA-009 trace every normative Planning Pool case", async () => {
  const trace = JSON.parse(
    await repositoryText("test/fixtures/planning-pool-acceptance-v1.json"),
  );
  assert.equal(trace.schema_version, "Perttool.PlanningPoolAcceptanceTrace.v1");
  assert.equal(trace.contract_id, "PLAN-POOL-001");
  assert.deepEqual(trace.traces.map(({ id }) => id), expectedIds("PPA", 9));
  const covered = trace.traces.flatMap(({ contract_case_ids: ids }) => ids);
  assert.deepEqual(covered, expectedIds("PPC", 40));
  assert.equal(new Set(covered).size, covered.length);

  for (const acceptanceTrace of trace.traces) {
    assert.notEqual(acceptanceTrace.evidence.length, 0, acceptanceTrace.id);
    for (const evidence of acceptanceTrace.evidence) {
      const absolute = path.join(root, evidence.file);
      await access(absolute);
      const text = await readFile(absolute, "utf8");
      for (const id of evidence.ids) {
        assert.match(text, new RegExp(`"${id}"`, "u"), `${acceptanceTrace.id}: ${id}`);
      }
    }
  }
});

test("final Planning Pool acceptance preserves its historical boundary and current additive catalog", async () => {
  const trace = JSON.parse(
    await repositoryText("test/fixtures/planning-pool-acceptance-v1.json"),
  );
  const catalog = rootApi.getJsonSchemaCatalog();
  assert.deepEqual(trace.target, {
    grammar_version: 9,
    cli_contract_version: 10,
    commands: 67,
    root_schemas: 26,
    root_exports: 139,
    node_exports: 139,
    core_exports: 51,
  });
  // The trace is the immutable public-activation boundary. Later accepted
  // request schemas and Issue #34 inspection commands extend the live catalog
  // without rewriting that historical evidence.
  assert.equal(rootApi.COMMAND_REGISTRY.length, 71);
  assert.equal(catalog.length, 29);
  assert.equal(Object.keys(rootApi).length, trace.target.root_exports);
  assert.equal(Object.keys(nodeApi).length, trace.target.node_exports);
  assert.equal(Object.keys(coreApi).length, trace.target.core_exports);
  assert.deepEqual(trace.forbidden_effects, [
    "release_selection",
    "publication",
    "remote_write",
    "issue_mutation",
    "editor_mutation",
    "mcp_mutation",
    "plan_advance",
  ]);
});

test("Linux VSIX acceptance is isolated from the operator display", async () => {
  const [shell, workflow, trace] = await Promise.all([
    repositoryText("scripts/check-vsix-shell.sh"),
    repositoryText("docs/process/ai-development.md"),
    repositoryText("test/fixtures/planning-pool-acceptance-v1.json").then(JSON.parse),
  ]);
  assert.match(shell, /if \[\[ "\$\(uname -s\)" == "Linux" \]\]/u);
  assert.doesNotMatch(shell, /-z "\$\{DISPLAY:-\}"/u);
  assert.match(shell, /-u WAYLAND_DISPLAY/u);
  assert.match(shell, /XDG_SESSION_TYPE=x11 xvfb-run -a/u);
  assert.match(shell, /-screen 0 1280x1024x24 -nolisten tcp/u);
  assert.match(workflow, /always runs in a fresh\s+Xvfb display/u);
  assert.equal(trace.required_gates.includes("npm run check:vsix-shell"), true);
});

test("accepted Planning Pool lifecycle and record remain aligned", async () => {
  const [record, requirements, design, backlog, acceptedPlan, residualPlan] =
    await Promise.all([
      repositoryText("docs/process/planning-pool-acceptance.md"),
      repositoryText("docs/requirements.md"),
      repositoryText("docs/basic-design.md"),
      repositoryText("docs/backlog.md"),
      repositoryText("test/fixtures/planning-pool-pre-advance-accepted.pert"),
      repositoryText("plans/planning-pool.pert"),
    ]);
  const finalTask =
    /^task PLANNING_POOL_ACCEPTANCE[\s\S]*?(?=^plan_seal )/mu.exec(
      acceptedPlan,
    )?.[0] ?? "";
  assert.match(record, /Document status: Accepted 1\.0/u);
  assert.match(record, /C-POOL-ACCEPT-001 `high`, accepted/u);
  assert.match(record, /A-POOL-ACCEPT-001\*\*, implementation permitted, executed/u);
  assert.match(record, /`PPC-001` through `PPC-040`/u);
  assert.match(record, /Xvfb/u);
  assert.match(requirements, /25\. \[x\] Implement the Work-centered planning pool/u);
  assert.match(design, /final end-to-end acceptance[\s\S]*?is complete/u);
  assert.match(backlog, /runtime and\s+end-to-end acceptance complete/u);
  assert.match(finalTask, /^  status done$/mu);
  assert.equal((residualPlan.match(/^milestone /gmu) ?? []).length, 1);
  assert.match(
    residualPlan,
    /milestone PLANNING_POOL_ACCEPTED:[\s\S]*?state reached/u,
  );
  assert.match(
    residualPlan,
    /milestone_acceptance_receipt PLANNING_POOL_ACCEPTANCE_EVIDENCE:/u,
  );
  assert.doesNotMatch(residualPlan, /^task /mu);
});
