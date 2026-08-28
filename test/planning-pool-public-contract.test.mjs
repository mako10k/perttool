import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");
const schemas = path.join(root, "schemas");
const schemaBase = "https://github.com/mako10k/perttool/schemas/";

function digest(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function source(version = 9) {
  return `${[
    "project POOL:",
    `  version ${version}`,
    '  title "Pool"',
    "  as_of 2026-08-25",
    "  duration_unit point",
    "  finish END",
    "",
    ...(version === 9 ? [
      "work W1:",
      '  title "Shape outcome"',
      '  description "Keep meaning"',
      "",
      "window SPRINT:",
      '  title "Sprint"',
      '  objective "Refine one explicit outcome"',
      "  start 2026-08-25",
      "  end 2026-09-01",
      "  works:",
      "    W1",
      "",
      "work_order:",
      "  W1",
      "",
    ] : []),
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone END:",
    '  title "End"',
    "",
    "task STRICT START -> END:",
    '  title "Strict execution"',
    "  duration 1p",
    "",
  ].join("\n")}\n`;
}

function invoke(args, expectedStatus = 0, cwd = root) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(result.status, expectedStatus, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function json(args, expectedStatus = 0, cwd = root) {
  const result = invoke([...args, "--format=json"], expectedStatus, cwd);
  assert.equal(result.stderr, "");
  const value = JSON.parse(result.stdout);
  assert.equal(value.cli_contract_version, 10);
  return value;
}

function validator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const file of readdirSync(schemas).filter((name) => name.endsWith(".schema.json"))) {
    ajv.addSchema(JSON.parse(readFileSync(path.join(schemas, file), "utf8")));
  }
  return ajv;
}

function validate(ajv, value) {
  const check = ajv.getSchema(`${schemaBase}${value.schema_version}.schema.json`);
  assert.equal(typeof check, "function", value.schema_version);
  assert.equal(check(value), true, JSON.stringify(check.errors));
}

test("Grammar 9 and Contract 10 publish closed planning read, observe, mutation, reshape, and migration results", (t) => {
  const workspace = mkdtempSync(path.join(tmpdir(), "perttool-planning-public."));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const plan = path.join(workspace, "pool.pert");
  const text = source();
  writeFileSync(plan, text, "utf8");
  const sourceDigest = digest(text);
  const observationPath = path.join(workspace, "observation.json");
  writeFileSync(observationPath, JSON.stringify({
    request_schema_version: "Perttool.PlanningObservationRequest.v1",
    source_digest: sourceDigest,
    selection: { kind: "persisted", window_id: "POOL::SPRINT" },
    observation_at: null,
    close_dispositions: [],
  }), "utf8");
  const windowPath = path.join(workspace, "window.json");
  writeFileSync(windowPath, JSON.stringify({
    request_schema_version: "Perttool.WindowMutationRequest.v1",
    source_digest: sourceDigest,
    operation: "add",
    window_id: "POOL::NEXT",
    final: {
      title: "Next",
      objective: "Retain the next outcome",
      start: "2026-09-01",
      end: "2026-09-08",
      work_ids: ["POOL::W1"],
    },
    objective_disposition: null,
    carry_over_work_ids: [],
    carry_over_target: null,
  }), "utf8");
  const reshapePath = path.join(workspace, "reshape.json");
  writeFileSync(reshapePath, JSON.stringify({
    request_schema_version: "Perttool.PlanningReshapeRequest.v1",
    normalization_contract: "perttool.planning-reshape-normalization@1",
    source_digest: sourceDigest,
    intent: "reshape",
    affected_work_ids: ["POOL::W1"],
    created_works: [],
    removed_work_ids: [],
    semantic_elements: [{
      element_id: "MEANING",
      origin: { kind: "existing", work_id: "POOL::W1", start_utf16: 0, end_utf16: 12, source_text: "Keep meaning" },
      destination: { kind: "work", work_id: "POOL::W1", position: 0, text: "Keep meaning" },
    }],
    planning_entity_dispositions: [],
    association_dispositions: [],
    projection_link_dispositions: [],
    dependency_dispositions: [],
    window_membership_dispositions: [{
      window_id: "POOL::SPRINT",
      origin_work_id: "POOL::W1",
      destination_work_id: "POOL::W1",
    }],
    final_work_order: [],
    add_residual_description: [],
    strict_fragment: null,
    window_close: null,
  }), "utf8");

  const ajv = validator();
  const listed = json(["work", "list", plan], 0, workspace);
  assert.deepEqual(listed.work_order, ["POOL::W1"]);
  validate(ajv, listed);

  const observed = json(["window", "observe", plan, "--request", observationPath], 0, workspace);
  assert.equal(observed.window.window.qualified_id, "POOL::SPRINT");
  validate(ajv, observed);

  const added = json(["window", "add", plan, "NEXT", "--request", windowPath], 0, workspace);
  assert.equal(added.changed, true);
  assert.equal(added.write.written, false);
  validate(ajv, added);

  const preflight = json(["work", "reshape", "preflight", plan, "--request", reshapePath], 0, workspace);
  assert.match(preflight.preflight_hash, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(typeof preflight.preflight_token, "string");
  validate(ajv, preflight);

  const applied = json([
    "work", "reshape", "apply", plan, "--request", reshapePath,
    "--preflight-hash", preflight.preflight_hash,
    "--preflight-token", preflight.preflight_token,
  ], 0, workspace);
  assert.equal(applied.write.written, false);
  validate(ajv, applied);

  const grammar8 = path.join(workspace, "grammar8.pert");
  writeFileSync(grammar8, source(8), "utf8");
  const migrated = json(["document", "migrate", grammar8, "--target-grammar", "9"], 0, workspace);
  assert.equal(migrated.schema_version, "Perttool.UnitMigrationResult.v5");
  assert.equal(migrated.target_grammar_version, 9);
  assert.match(migrated.updated_text, /^  version 9$/mu);
  validate(ajv, migrated);
});

test("public contract acceptance fixes its historical source boundary", () => {
  const acceptance = readFileSync(
    path.join(root, "docs", "process", "planning-pool-public-contract-acceptance.md"),
    "utf8",
  );
  const acceptedPlan = readFileSync(
    path.join(
      root,
      "test",
      "fixtures",
      "planning-pool-pre-advance-accepted.pert",
    ),
    "utf8",
  );
  const residualPlan = readFileSync(
    path.join(root, "plans", "planning-pool.pert"),
    "utf8",
  );
  const publicTask =
    /^task PLANNING_POOL_PUBLIC_CONTRACT[\s\S]*?(?=^task |^plan_seal )/mu.exec(
      acceptedPlan,
    )?.[0] ?? "";
  const finalTask =
    /^task PLANNING_POOL_ACCEPTANCE[\s\S]*?(?=^task |^plan_seal )/mu.exec(
      acceptedPlan,
    )?.[0] ?? "";

  assert.match(acceptance, /Document status: Accepted 1\.0/u);
  assert.match(acceptance, /C-POOL-PUBLIC-001 `high`, accepted/u);
  assert.match(acceptance, /E-POOL-PUBLIC-006/u);
  assert.match(acceptance, /A-POOL-PUBLIC-001`, implementation permitted, executed/u);
  assert.match(acceptance, /67 commands and the schema catalog has 26 root/u);
  assert.match(acceptance, /139 runtime values each, and the portable Core\s+exposes 51/u);
  assert.match(acceptance, /complete 1,296-test repository regression gate/u);
  assert.match(publicTask, /^  status done$/mu);
  assert.match(finalTask, /title "Accept planning pool and bounded Windows end to end"/u);
  assert.match(
    residualPlan,
    /milestone PLANNING_POOL_ACCEPTED:[\s\S]*?state reached/u,
  );
  assert.doesNotMatch(residualPlan, /^task /mu);
});
