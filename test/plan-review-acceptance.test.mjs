// R: Trace accepted Plan Review behavior through source and installed interfaces.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = process.env.PERTTOOL_PLAN_REVIEW_PACKAGE_ROOT ?? repository;
const api = await import(pathToFileURL(path.join(target, "dist/index.js")));
const advance = await import(pathToFileURL(path.join(target, "dist/plan-review/advance.js")));
const normalization = await import(pathToFileURL(path.join(target, "dist/plan-review/request.js")));
const legacy = await import(pathToFileURL(path.join(
  process.env.PERTTOOL_PLAN_REVIEW_LEGACY_ROOT ?? target,
  process.env.PERTTOOL_PLAN_REVIEW_LEGACY_ROOT ? "dist/index.js" : "dist/application/contract10-runtime.js",
)));
const fixture = JSON.parse(readFileSync(path.join(repository, "test/fixtures/plan-review-acceptance-v1.json")));
const validators = new Ajv2020({ strict: false, allErrors: true });
for (const name of readdirSync(path.join(target, "schemas")).filter((name) => name.endsWith(".schema.json"))) {
  validators.addSchema(JSON.parse(readFileSync(path.join(target, "schemas", name))));
}
function source(version = 10, status = "planned") {
  return `project REVIEW:\n  version ${version}\n  title "Review"\n  as_of 2026-09-30\n  duration_unit point\n  velocity 4p/1d\n  finish END\n${version >= 4 ? '  dag_owner user\n  dag_delegates [delegate]\n' : ''}\nresource DEV:\n  title "Developer"\n  capacity 1\n\nmilestone START:\n  title "Start"\n  state reached\n\nmilestone END:\n  title "End"\n\ntask TASK_A START -> END:\n  title "Task A"\n  duration 2p\n  status ${status}\n${status === 'blocked' ? '  blocked_reason "Dependency unavailable"\n' : ''}  requires:\n    DEV 1\n\ntask TASK_B START -> END:\n  title "Task B"\n  duration 1p\n`;
}
const create = (requestId = "PRR_A", overrides = {}) => ({
  schemaVersion: api.PLAN_REVIEW_CREATE_REQUEST_ID, requestId, taskId: "TASK_A",
  reason: "Review estimate", createdAt: "2026-09-30T10:00:00+09:00", actor: "codex", ...overrides,
});
const resolve = (requestId = "PRR_A", overrides = {}) => ({
  schemaVersion: api.PLAN_REVIEW_RESOLVE_REQUEST_ID, requestId, outcome: "plan_retained",
  resolvedAt: "2026-09-30T10:05:00+09:00", actor: "user", resolutionReason: "Reviewed", ...overrides,
});
const batch = (mutations) => ({ kind: "batch", mutations });
const change = batch([{ kind: "task.set", id: "TASK_A", set: { duration: "3p" } }]);
function success(result) { assert.equal(result.ok, true, JSON.stringify(result.diagnostics)); return result.updatedText; }
function opened(ids = ["PRR_A"], text = source()) {
  return ids.reduce((text, id) => success(api.planPlanReviewCreate(text, create(id))), text);
}
function rejected(result, code) {
  assert.equal(result.ok, false, JSON.stringify(result.diagnostics));
  assert.equal(result.diagnostics.some((item) => item.code === code), true, JSON.stringify(result.diagnostics));
  assert.equal(result.updatedText, null);
}
function workspace(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-plan-review-acceptance-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function cli(args, expected = 0, json = true) {
  const result = spawnSync(process.execPath, [path.join(target, "dist/cli.js"), ...args, ...(json ? ["--format=json"] : [])], {
    encoding: "utf8", maxBuffer: 20 * 1024 * 1024,
  });
  assert.equal(result.status, expected, `${args.join(" ")}\n${result.stderr}\n${result.stdout}`);
  return json ? JSON.parse(result.stdout) : result.stdout;
}
function conforms(value) {
  const validate = validators.getSchema(`https://github.com/mako10k/perttool/schemas/${value.schema_version}.schema.json`);
  assert.equal(typeof validate, "function");
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
}
// Compare decision meaning while permitting the required exact source rebinding.
function decisionMeaning(value) {
  if (Array.isArray(value)) return value.map(decisionMeaning);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "sourceDigest")
      .map(([key, item]) => [key, decisionMeaning(item)]));
  }
  return value;
}
function register(id, body) {
  const row = fixture.cases.find((row) => row.id === id);
  assert.ok(row, id);
  test(`${id} ${row.purpose}`, body);
}

register("PRAC-001", () => {
  const first = api.planPlanReviewCreate(source(), create());
  const text = success(first);
  assert.equal(first.requestAfter.locator, null);
  assert.equal(api.planPlanReviewCreate(text, create()).changed, false);
  for (const overrides of [{ reason: "Different" }, { actor: "other" }, { taskId: "TASK_B" },
    { createdAt: "2026-09-30T10:01:00+09:00" }, { locator: "different" }]) {
    rejected(api.planPlanReviewCreate(text, create("PRR_A", overrides)), "PTREV-105");
  }
});
register("PRAC-002", (t) => {
  const file = path.join(workspace(t), "plan.pert");
  const mixed = success(api.planPlanReviewResolve(opened(["PRR_B", "PRR_A"]), resolve("PRR_A")));
  writeFileSync(file, mixed);
  for (const [state, ids] of [["all", ["PRR_A", "PRR_B"]], ["open", ["PRR_B"]], ["resolved", ["PRR_A"]]]) {
    const result = cli(["plan", "review-list", file, "--state", state]); conforms(result);
    assert.deepEqual(result.requests.map(({ id }) => id), ids);
  }
  for (const [id, state] of [["PRR_A", "resolved"], ["PRR_B", "open"]]) {
    const result = cli(["plan", "review-show", file, id]); conforms(result);
    assert.equal(result.requests[0].state, state);
    assert.match(cli(["plan", "review-show", file, id], 0, false), new RegExp(id));
  }
});
register("PRAC-003", () => {
  let text = opened(["PRR_A", "PRR_B"]);
  const before = api.selectNextTasks(source());
  text = success(api.planPlanReviewResolve(text, resolve("PRR_A")));
  assert.deepEqual(api.planReviewProjection(text).open_request_ids, ["PRR_B"]);
  assert.equal(api.planReviewProjection(text).required_actions.length, 1);
  text = success(api.planPlanReviewResolve(text, resolve("PRR_B")));
  assert.deepEqual(api.planReviewProjection(text), { model_version: 1, state: "clear", open_request_ids: [], required_actions: [] });
  assert.deepEqual(decisionMeaning(api.selectNextTasks(text).recommendation), decisionMeaning(before.recommendation));
});
register("PRAC-004", () => {
  const text = opened();
  for (const overrides of [{ actor: "user" }, { actor: "delegate" }, { actor: "codex", acceptedOwners: ["user"] }]) {
    assert.equal(api.planPlanReviewResolve(text, resolve("PRR_A", overrides)).ok, true);
  }
  rejected(api.planPlanReviewResolve(text, resolve("PRR_A", { actor: "wrong" })), "PTREV-106");
  rejected(api.planPlanReviewResolve(text, resolve(), { expectedDigest: `sha256:${"0".repeat(64)}` }), "PTREV-106");
});
register("PRAC-005", () => {
  const result = api.planPlanReviewResolve(opened(), resolve()); success(result);
  assert.deepEqual(result.planBasis, { status: "unchanged", beforeDigest: null, afterDigest: null });
  rejected(api.planPlanReviewResolve(opened(), resolve("PRR_A", { request: change })), "PTREV-104");
});
register("PRAC-006", () => {
  const text = opened();
  const result = api.planPlanReviewResolve(text, resolve("PRR_A", { outcome: "plan_changed", request: change }));
  success(result); assert.equal(result.planBasis.status, "changed");
  assert.notEqual(result.planBasis.beforeDigest, result.planBasis.afterDigest);
  assert.equal(result.composedMutation.originalDigest, result.originalDigest);
  assert.equal(result.planReviewAuthority.candidate_digest, result.updatedDigest);
  assert.equal(api.checkDocument(result.updatedText).ok, true);
});
register("PRAC-007", () => {
  rejected(api.planPlanReviewResolve(opened(), resolve("PRR_A", { outcome: "plan_changed",
    request: batch([{ kind: "plan_review.create" }]) })), "PTREV-104");
});
register("PRAC-008", () => {
  const input = resolve("PRR_A", { outcome: "plan_changed", request: change });
  const result = api.planPlanReviewResolve(opened(), input); const text = success(result);
  const replay = api.planPlanReviewResolve(text, input);
  assert.equal(replay.ok, true); assert.equal(replay.changed, false); assert.equal(replay.composedMutation, null);
  for (const overrides of [{ outcome: "plan_retained", request: undefined }, { actor: "delegate" },
    { resolvedAt: "2026-09-30T10:06:00+09:00" }, { resolutionReason: "Other" },
    { request: batch([{ kind: "task.set", id: "TASK_A", set: { duration: "4p" } }]) }]) {
    rejected(api.planPlanReviewResolve(text, { ...input, ...overrides }), "PTREV-105");
  }
  const later = success(api.planPlanReviewBatchMutation(text, batch([{ kind: "task.set", id: "TASK_A", set: { duration: "4p" } }]),
    { governance: { intent: "persist", actor: "user" } }));
  assert.equal(api.planPlanReviewResolve(later, input).updatedText, later);
});
register("PRAC-009", () => {
  for (const status of ["planned", "active", "blocked", "suspended", "done"]) {
    const text = source(10, status); assert.equal(api.checkDocument(text).ok, true, status);
    const created = api.planPlanReviewCreate(text, create()); success(created);
    assert.equal(created.requestAfter.taskReferenceState, "current");
    const before = api.selectNextTasks(text); const after = api.selectNextTasks(created.updatedText);
    assert.deepEqual(decisionMeaning(after.recommendation), decisionMeaning(before.recommendation));
    assert.deepEqual(decisionMeaning(after.temporal.authority), decisionMeaning(before.temporal.authority));
  }
});
register("PRAC-010", () => {
  const text = opened(["PRR_A", "PRR_B"]);
  for (const mutations of [[{ kind: "task.remove", id: "TASK_A" }],
    [{ kind: "task.remove", id: "TASK_A" }, { kind: "task.add", id: "TASK_C", from: "START", to: "END", task: { title: "Renamed", duration: "2p" } }]]) {
    const result = api.planPlanReviewBatchMutation(text, batch(mutations), { governance: { intent: "persist", actor: "user" } });
    rejected(result, "PTREV-108");
    assert.deepEqual(result.diagnostics.find(({ code }) => code === "PTREV-108").data.request_ids, ["PRR_A", "PRR_B"]);
  }
});
register("PRAC-011", () => {
  for (const extra of [[], [{ kind: "task.add", id: "TASK_C", from: "START", to: "END", task: { title: "Renamed", duration: "2p" } }]]) {
    const result = api.planPlanReviewResolve(opened(), resolve("PRR_A", { outcome: "plan_changed",
      request: batch([{ kind: "task.remove", id: "TASK_A" }, ...extra]) }));
    success(result); assert.match(result.updatedText, /plan_review_request PRR_A TASK_A:/u);
    assert.equal(result.requestAfter.taskReferenceState, "historical");
    assert.equal(api.checkDocument(result.updatedText).ok, true);
  }
});
register("PRAC-012", () => {
  const resolved = success(api.planPlanReviewResolve(opened(), resolve()));
  const declaration = resolved.slice(resolved.indexOf("plan_review_request"));
  const later = success(api.planPlanReviewBatchMutation(resolved, batch([{ kind: "task.remove", id: "TASK_A" }]),
    { governance: { intent: "persist", actor: "user" } }));
  assert.equal(later.slice(later.indexOf("plan_review_request")), declaration);
  rejected(api.planPlanReviewCreate(later, create("NEW")), "PTREV-102");
});
register("PRAC-013", () => {
  const text = success(api.planPlanReviewResolve(opened(), resolve()));
  const start = text.indexOf("task TASK_A"); const end = text.indexOf("task TASK_B");
  const result = advance.composePlanReviewAdvanceCandidate(text, [{ startOffset: start, endOffset: end, replacement: "" }], ["TASK_A"]);
  assert.equal(result.ok, true); assert.deepEqual(result.removedRequestIds, ["PRR_A"]);
  const bytes = (text) => new TextEncoder().encode(text);
  const baseline = { status: "complete", currentSource: bytes(text), headSource: bytes(text), indexSource: bytes(text),
    repositorySnapshotId: "snapshot", repositoryRelativePath: "plan.pert", headCommitId: "head" };
  assert.equal(advance.assessPlanReviewAdvanceHistory(text, result, baseline).status, "passed");
  for (const field of ["headSource", "indexSource"]) {
    assert.equal(advance.assessPlanReviewAdvanceHistory(text, result, { ...baseline,
      [field]: bytes(text.replace('resolution_reason "Reviewed"', 'resolution_reason "Other"')) }).status, "blocked");
  }
});
register("PRAC-014", () => {
  const text = opened();
  const resolved = api.planPlanReviewResolve(text, resolve("PRR_A", { outcome: "plan_changed", request: batch([{ kind: "task.remove", id: "TASK_A" }]) }));
  success(resolved);
  const result = advance.composePlanReviewAdvanceCandidate(text, resolved.edits, ["TASK_A"]);
  assert.equal(result.ok, true); assert.deepEqual(result.removedRequestIds, []);
  assert.match(result.updatedText, /plan_review_request PRR_A TASK_A:/u);
});
register("PRAC-015", (t) => {
  const directory = workspace(t); const file = path.join(directory, "plan.pert");
  const sentinel = path.join(directory, "executed"); writeFileSync(file, source());
  const locator = `$(touch ${sentinel}); https://invalid.example/locator`;
  const result = cli(["plan", "review-request", file, "PRR_A", "TASK_A", "--reason", "Observation",
    "--created-at", "2026-09-30T10:00:00+09:00", "--actor", "codex", "--locator", locator]);
  conforms(result); assert.equal(result.request.locator, locator);
  assert.deepEqual(readdirSync(directory), ["plan.pert"]);
  rejected(api.planPlanReviewCreate(source(), { ...create(), extra: true }), "PTREV-104");
  rejected(api.planPlanReviewCreate(source(), create("PRR_A", { reason: "a".repeat(16_385) })), "PTREV-104");
  assert.equal(api.planPlanReviewCreate(source(), create("PRR_A", { reason: "a".repeat(16_384) })).ok, true);
  for (const [field, maximum] of [["locator", 8192], ["reason", 16384]]) {
    assert.equal(api.planPlanReviewCreate(source(), create("PRR_A", { [field]: "a".repeat(maximum) })).ok, true);
    rejected(api.planPlanReviewCreate(source(), create("PRR_A", { [field]: "a".repeat(maximum + 1) })), "PTREV-104");
  }
  assert.equal(api.planPlanReviewResolve(opened(), resolve("PRR_A", { resolutionReason: "a".repeat(16384) })).ok, true);
  rejected(api.planPlanReviewResolve(opened(), resolve("PRR_A", { resolutionReason: "a".repeat(16385) })), "PTREV-104");
  const operation = { kind: "task.set", id: "TASK_A", set: { duration: "3p" } };
  for (const [count, expected] of [[10000, true], [10001, false]]) {
    assert.equal(normalization.normalizePlanReviewResolveRequest(resolve("PRR_A", { outcome: "plan_changed",
      request: batch(Array.from({ length: count }, () => operation)) })).ok, expected);
  }
  const prefix = source() + "#";
  const exact = prefix + "x".repeat(8388608 - Buffer.byteLength(prefix));
  assert.equal(api.parsePlanReviewSource(exact, api.PLAN_REVIEW_SOURCE_CAPABILITY).ok, true);
  assert.equal(api.parsePlanReviewSource(exact + "x", api.PLAN_REVIEW_SOURCE_CAPABILITY).ok, false);
});
register("PRAC-016", async (t) => {
  const directory = workspace(t); const file = path.join(directory, "plan.pert"); const output = path.join(directory, "output.pert");
  const text = opened(); writeFileSync(file, text);
  const results = [api.planPlanReviewResolve(text, resolve()),
    api.planPlanReviewResolve(text, resolve("PRR_A", { resolutionReason: "Other" }))];
  const persistence = api.createNodeHost().safePersistence;
  const settled = await Promise.allSettled(results.map((result) => api.persistPlanReviewMutation(result,
    { mode: "out", source: file, target: output }, persistence)));
  assert.equal(settled.filter(({ status }) => status === "fulfilled").length, 1);
  const loser = settled.find(({ status }) => status === "rejected");
  assert.equal(loser.reason.reason, "target_exists");
  assert.ok(results.some(({ updatedText }) => updatedText === readFileSync(output, "utf8")));
  assert.equal(readFileSync(file, "utf8"), text);
  assert.deepEqual(readdirSync(directory).sort(), ["output.pert", "plan.pert"]);
  const changedSource = text.replace('title "Review"', 'title "Changed"'); writeFileSync(file, changedSource);
  await assert.rejects(api.persistPlanReviewMutation(results[0], { mode: "in_place", target: file }, persistence),
    (error) => error instanceof api.SafeWriteConflictError);
  assert.equal(readFileSync(file, "utf8"), changedSource);
  const blocked = cli(["plan", "review-resolve", file, "PRR_A", "--outcome", "plan_retained", "--resolved-at",
    "2026-09-30T10:05:00+09:00", "--actor", "user", "--resolution-reason", "Reviewed", "--output", output], 5);
  assert.equal(blocked.ok, false); conforms(blocked);
});
register("PRAC-017", (t) => {
  const directory = workspace(t); const file = path.join(directory, "plan.pert"); writeFileSync(file, opened());
  for (const args of [["help", "plan", "review-resolve"], ["guide", "plan-review"], ["plan", "review-show", file, "PRR_A"]]) {
    const result = cli(args); conforms(result);
    const text = cli(args, 0, false); assert.ok(text.length > 0);
    assert.match(text, /review|PRR_A/iu);
  }
  const next = cli(["dag", "next", file]); conforms(next);
  for (const [text, state] of [[opened(), "review_required"], [source(), "clear"]]) {
    writeFileSync(file, text);
    const json = cli(["dag", "next", file]); conforms(json);
    assert.equal(json.plan_review.state, state);
    const keys = Object.keys(json);
    assert.ok(keys.indexOf("plan_review") < keys.indexOf("recommendation"));
    const rendered = cli(["dag", "next", file], 0, false);
    const firstLine = rendered.split("\n")[0];
    assert.ok(firstLine.startsWith("PLAN_REVIEW "));
    assert.deepEqual(JSON.parse(firstLine.slice("PLAN_REVIEW ".length)), json.plan_review);
    assert.ok(rendered.indexOf(firstLine) < rendered.indexOf("RECOMMENDATION\n"));
  }
  const withExtra = { ...next, unrecognized: true };
  const checker = validators.getSchema("https://github.com/mako10k/perttool/schemas/Perttool.NextResult.v9.schema.json");
  assert.equal(checker(withExtra), false);
  assert.equal(Object.keys(api).length, 155);
  assert.equal(Object.keys(awaitableNode).length, 155);
  assert.equal(Object.keys(awaitableCore).length, 51);
});
const awaitableNode = await import(pathToFileURL(path.join(target, "dist/node/index.js")));
const awaitableCore = await import(pathToFileURL(path.join(target, "dist/core/index.js")));
register("PRAC-018", (t) => {
  const directory = workspace(t);
  for (let version = 1; version <= 9; version += 1) {
    const text = source(version); const before = legacy.selectNextTasks(text); const after = api.selectNextTasks(text);
    const { schemaVersion: oldIdentity, ...oldMeaning } = before;
    const { schemaVersion: newIdentity, planReview, ...newMeaning } = after;
    assert.equal(before.ok, true, `Grammar ${version}`);
    assert.deepEqual(newMeaning, oldMeaning, `Grammar ${version}`);
    assert.equal(newIdentity, "Perttool.NextResult.v9");
    assert.deepEqual(planReview, { model_version: 1, state: "clear", open_request_ids: [], required_actions: [] });
    const file = path.join(directory, `grammar-${version}.pert`); writeFileSync(file, text);
    conforms(cli(["dag", "next", file]));
  }
  const migrated = api.planContract11GrammarMigration(source(9));
  assert.equal(migrated.ok, true); assert.equal(migrated.updatedText, source(10));
});
