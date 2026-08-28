import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import {
  compilePlanningIntentRequest,
} from "../dist/planning-pool/intent.js";
import {
  auditPlanningReshape,
  preflightPlanningReshape,
  preparePlanningReshapeApply,
  PLANNING_RESHAPE_CORE_CAPABILITY,
} from "../dist/planning-pool/reshape.js";
import { PlanningReshapeTokenRegistry } from "../dist/planning-pool/reshape-token.js";
import {
  parsePlanningPoolSource,
  PLANNING_POOL_SOURCE_CAPABILITY,
} from "../dist/planning-pool/source.js";
import {
  auditPlanningWindowMutation,
  PLANNING_WINDOW_CORE_CAPABILITY,
} from "../dist/planning-pool/window.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "dist", "cli.js");
const schemas = path.join(root, "schemas");
const q = (id) => `POOL::${id}`;
const digest = (text) => `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;

function source({ planning = true } = {}) {
  return `${[
    "project POOL:",
    "  version 9",
    '  title "Pool"',
    "  as_of 2026-08-26",
    "  duration_unit point",
    "  finish END",
    "  dag_owner user",
    "",
    ...(planning ? [
      "work W1:",
      '  title "First"',
      '  description "First meaning"',
      "  events:",
      "    MID",
      "  activities:",
      "    A1",
      "    A2",
      "",
      "work W2:",
      '  title "Second"',
      "",
      "event MID:",
      '  title "Middle"',
      "",
      "activity A1 START -> MID:",
      '  title "Reach middle"',
      "  duration 1p",
      "",
      "activity A2 MID -> END:",
      '  title "Reach end"',
      "  duration 1p",
      "",
      "window NOW:",
      '  title "Now"',
      '  objective "Reach the middle"',
      "  works:",
      "    W1",
      "",
      "work_order:",
      "  W1",
      "  W2",
      "",
    ] : []),
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone END:",
    '  title "End"',
    "",
    "task BASE START -> END:",
    '  title "Base"',
    "  duration 1p",
    "",
  ].join("\n")}\n`;
}

function model(text) {
  const result = parsePlanningPoolSource(text, PLANNING_POOL_SOURCE_CAPABILITY);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.model;
}

function intent(text, action) {
  return {
    request_schema_version: "Perttool.PlanningIntentRequest.v1",
    source_digest: digest(text),
    action,
  };
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

function schemaValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const file of readdirSync(schemas).filter((name) => name.endsWith(".schema.json"))) {
    ajv.addSchema(JSON.parse(readFileSync(path.join(schemas, file), "utf8")));
  }
  return ajv;
}

function validateResult(ajv, value) {
  const id = `https://github.com/mako10k/perttool/schemas/${value.schema_version}.schema.json`;
  const validate = ajv.getSchema(id);
  assert.equal(typeof validate, "function", value.schema_version);
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
}

test("routine Work intents compile to one audited v2 reshape candidate", () => {
  const initial = source();
  const updated = auditPlanningReshape(initial, intent(initial, {
    kind: "update_work",
    work_id: q("W1"),
    title: "First revised",
    description: "Revised meaning",
  }), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(updated.ok, true, JSON.stringify(updated.diagnostics));
  assert.equal(updated.normalizedRequest.request_schema_version, "Perttool.PlanningReshapeRequest.v2");
  assert.match(updated.candidateText, /work W1:\n  title "First revised"\n  description "Revised meaning"/u);

  const dependency = auditPlanningReshape(initial, intent(initial, {
    kind: "set_dependency",
    dependent_work_id: q("W2"),
    prerequisite_work_id: q("W1"),
    present: true,
  }), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(dependency.ok, true, JSON.stringify(dependency.diagnostics));
  assert.match(dependency.candidateText, /work W2:[\s\S]*depends_on:\n    W1/u);

  const moved = auditPlanningReshape(initial, intent(initial, {
    kind: "move_work",
    work_id: q("W2"),
    insert_after_work_id: null,
  }), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(moved.ok, true, JSON.stringify(moved.diagnostics));
  assert.match(moved.candidateText, /work_order:\n  W2\n  W1/u);

  const archived = auditPlanningReshape(initial, intent(initial, {
    kind: "archive_work",
    work_id: q("W2"),
  }), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(archived.ok, true, JSON.stringify(archived.diagnostics));
  assert.doesNotMatch(archived.candidateText, /^work W2:$/mu);
});

test("projection and narrow deferral intents compile complete explicit dispositions", () => {
  const initial = source();
  const projected = auditPlanningReshape(initial, intent(initial, {
    kind: "project",
    event_ids: [q("MID")],
    activity_ids: [q("A1"), q("A2")],
  }), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(projected.ok, true, JSON.stringify(projected.diagnostics));
  assert.match(projected.candidateText, /^milestone MID:$/mu);
  assert.match(projected.candidateText, /^task A1 START -> MID:$/mu);
  assert.match(projected.candidateText, /work W1:[\s\S]*milestone_links:\n    MID[\s\S]*task_links:\n    A1/u);

  const deferred = auditPlanningReshape(projected.candidateText, intent(projected.candidateText, {
    kind: "defer",
    task_ids: [q("A1"), q("A2")],
    milestone_ids: [q("MID")],
  }), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(deferred.ok, true, JSON.stringify(deferred.diagnostics));
  assert.match(deferred.candidateText, /^event MID:$/mu);
  assert.match(deferred.candidateText, /^activity A1 START -> MID:$/mu);
});

test("Window intents build create, select, remove, and close requests", () => {
  const initial = source();
  const create = compilePlanningIntentRequest(intent(initial, {
    kind: "create_window",
    window_id: q("NEXT"),
    title: "Next",
    objective: "Reach the next outcome",
    start: null,
    end: null,
    work_ids: [q("W2")],
  }), model(initial));
  assert.equal(create.ok, true, JSON.stringify(create.diagnostics));
  const created = auditPlanningWindowMutation(initial, create.windowRequest, PLANNING_WINDOW_CORE_CAPABILITY);
  assert.equal(created.ok, true, JSON.stringify(created.diagnostics));
  assert.match(created.candidateText, /^window NEXT:$/mu);

  for (const selected of [true, false]) {
    const membership = compilePlanningIntentRequest(intent(initial, {
      kind: "set_window_membership",
      window_id: q("NOW"),
      work_id: q("W2"),
      selected,
    }), model(initial));
    assert.equal(membership.ok, true, JSON.stringify(membership.diagnostics));
    const audited = auditPlanningWindowMutation(initial, membership.windowRequest, PLANNING_WINDOW_CORE_CAPABILITY);
    assert.equal(audited.ok, true, JSON.stringify(audited.diagnostics));
    assert.equal(audited.normalizedRequest.final.work_ids.includes(q("W2")), selected);
  }

  const close = compilePlanningIntentRequest(intent(initial, {
    kind: "close_window",
    window_id: q("NOW"),
    carry_over_work_ids: [q("W1")],
    carry_over_target: {
      kind: "new",
      window_id: q("NEXT"),
      title: "Next",
      objective: "Continue explicit Work",
      start: null,
      end: null,
    },
  }), model(initial));
  assert.equal(close.ok, true, JSON.stringify(close.diagnostics));
  const closed = auditPlanningWindowMutation(initial, close.windowRequest, PLANNING_WINDOW_CORE_CAPABILITY);
  assert.equal(closed.ok, true, JSON.stringify(closed.diagnostics));
  assert.equal(closed.closeReport.targetCreated, true);
});

test("intent recovery fails closed for stale source, failed build, expired token, and missing owner response", () => {
  const initial = source();
  const stale = preflightPlanningReshape(initial, {
    ...intent(initial, {
      kind: "update_work",
      work_id: q("W1"),
      title: "Stale",
      description: null,
    }),
    source_digest: `sha256:${"0".repeat(64)}`,
  }, new PlanningReshapeTokenRegistry(), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(stale.ok, false);
  assert.equal(stale.preflightToken, null);
  assert.ok(stale.diagnostics.some(({ code }) => code === "PTPOOL-111"));

  const missing = preflightPlanningReshape(initial, intent(initial, {
    kind: "update_work",
    work_id: q("MISSING"),
    title: "Missing",
    description: null,
  }), new PlanningReshapeTokenRegistry(), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(missing.ok, false);
  assert.equal(missing.preflightToken, null);
  assert.ok(missing.diagnostics.some(({ code }) => code === "PTPOOL-118"));

  let now = Date.parse("2026-08-26T00:00:00Z");
  const registry = new PlanningReshapeTokenRegistry({
    now: () => now,
    lifetimeMs: 1_000,
    randomBytes: (size) => new Uint8Array(size).fill(7),
  });
  const request = intent(initial, {
    kind: "update_work",
    work_id: q("W1"),
    title: "Token-bound",
    description: null,
  });
  const issued = preflightPlanningReshape(initial, request, registry, PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(issued.ok, true, JSON.stringify(issued.diagnostics));
  now += 1_001;
  const expired = preparePlanningReshapeApply(
    initial,
    request,
    issued.preflightHash,
    issued.preflightToken,
    registry,
    PLANNING_RESHAPE_CORE_CAPABILITY,
  );
  assert.equal(expired.ok, false);
  assert.equal(expired.preflightTokenValidated, false);
  assert.ok(expired.diagnostics.some(({ code }) => code === "PTPOOL-111"));

  const owner = preflightPlanningReshape(initial, intent(initial, {
    kind: "project",
    event_ids: [q("MID")],
    activity_ids: [q("A1"), q("A2")],
  }), new PlanningReshapeTokenRegistry(), PLANNING_RESHAPE_CORE_CAPABILITY);
  assert.equal(owner.ok, true, JSON.stringify(owner.diagnostics));
  assert.deepEqual(owner.authorityImpact.affectedScopes, ["dag"]);
  assert.equal(owner.authorityImpact.requiredOwner, "user");
  assert.equal(owner.authorityImpact.userResponseRequired, true);

  const recovery = readFileSync(path.join(root, "docs", "examples", "planning-pool-intents.md"), "utf8");
  for (const phrase of [
    "Stale source digest",
    "Failed preflight",
    "Expired or mismatched token",
    "Owner response required",
    "History unavailable or overlapping",
  ]) assert.match(recovery, new RegExp(phrase, "u"));
});

test("CLI accepts intent request as the exclusive builder input from an empty Grammar 9 Pool", (t) => {
  const workspace = mkdtempSync(path.join(tmpdir(), "perttool-intent-ui."));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  const plan = path.join(workspace, "pool.pert");
  const grammar8 = source({ planning: false }).replace("  version 9", "  version 8");
  writeFileSync(plan, grammar8, "utf8");
  invoke([
    "document", "migrate", plan,
    "--target-grammar", "9",
    "--write",
    "--expect-digest", digest(grammar8),
    "--format", "json",
  ], 0, workspace);
  const initial = readFileSync(plan, "utf8");
  assert.match(initial, /^  version 9$/mu);
  const request = path.join(workspace, "intent.json");
  writeFileSync(request, JSON.stringify(intent(initial, {
    kind: "create_work",
    work_id: q("FIRST"),
    title: "First Work",
    description: "Define the first explicit outcome",
    insert_after_work_id: null,
  })), "utf8");
  const preflight = invoke([
    "work", "reshape", "preflight", plan,
    "--intent-request", request,
    "--format", "json",
  ], 0, workspace);
  const result = JSON.parse(preflight.stdout);
  assert.equal(result.normalized_request.request_schema_version, "Perttool.PlanningReshapeRequest.v2");
  assert.match(result.candidate_text, /^work FIRST:$/mu);
  assert.equal(readFileSync(plan, "utf8"), initial);
  const ajv = schemaValidator();
  validateResult(ajv, result);

  const appliedOutput = invoke([
    "work", "reshape", "apply", plan,
    "--intent-request", request,
    "--preflight-hash", result.preflight_hash,
    "--preflight-token", result.preflight_token,
    "--write",
    "--expect-digest", digest(initial),
    "--format", "json",
  ], 0, workspace);
  validateResult(ajv, JSON.parse(appliedOutput.stdout));
  const withWork = readFileSync(plan, "utf8");
  assert.match(withWork, /^work FIRST:$/mu);

  const windowRequest = path.join(workspace, "window-intent.json");
  writeFileSync(windowRequest, JSON.stringify(intent(withWork, {
    kind: "create_window",
    window_id: q("NOW"),
    title: "Now",
    objective: "Clarify the first explicit outcome",
    start: null,
    end: null,
    work_ids: [q("FIRST")],
  })), "utf8");
  const windowOutput = invoke([
    "window", "add", plan, "NOW",
    "--intent-request", windowRequest,
    "--write",
    "--expect-digest", digest(withWork),
    "--format", "json",
  ], 0, workspace);
  validateResult(ajv, JSON.parse(windowOutput.stdout));
  assert.match(readFileSync(plan, "utf8"), /^window NOW:$/mu);

  const missing = invoke(["work", "reshape", "preflight", plan, "--format", "json"], 2, workspace);
  assert.match(`${missing.stdout}${missing.stderr}`, /exactly one of --request or --intent-request is required/u);
  const conflict = invoke([
    "work", "reshape", "preflight", plan,
    "--request", request,
    "--intent-request", request,
  ], 2, workspace);
  assert.match(`${conflict.stdout}${conflict.stderr}`, /conflict/u);
});
