import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { planPlanReviewResolve } from "../dist/index.js";
import { planReviewBatchFitsUtf8 } from "../dist/plan-review/request-size.js";
import { rfc8785Json } from "../dist/model/rfc8785.js";
import { normalizePlanReviewResolveRequest } from "../dist/plan-review/request.js";

const maximum = 8_388_608;
function batch(description) {
  return { kind: "batch", mutations: [{ kind: "task.set", id: "TASK_A", set: { description } }] };
}
function resolve(request) {
  return normalizePlanReviewResolveRequest({
    schemaVersion: "Perttool.PlanReviewResolveRequest.v1",
    requestId: "PRR_001", outcome: "plan_changed", actor: "user",
    resolvedAt: "2026-09-30T10:00:00+09:00", resolutionReason: "Reviewed", request,
  });
}

test("bounded counter matches canonical UTF-8 including escapes and Unicode", () => {
  for (const value of [null, true, false, 0, -12, Number.MAX_SAFE_INTEGER,
    '"\\\b\t\n\f\r\u0000', "é\u65e5\u672c😀", [], {}, { z: [false, null, "é"], a: 3 }]) {
    const size = Buffer.byteLength(rfc8785Json(value));
    assert.equal(planReviewBatchFitsUtf8(value, size), true);
    assert.equal(planReviewBatchFitsUtf8(value, size - 1), false);
  }
  const cycle = {}; cycle.self = cycle;
  for (const value of [cycle, undefined, { missing: undefined }, NaN, "\ud800", "\udc00"]) {
    assert.equal(planReviewBatchFitsUtf8(value, maximum), false);
  }
});

test("direct library accepts exact byte limit and rejects one extra byte before serialization", () => {
  const overhead = Buffer.byteLength(rfc8785Json(batch("")));
  const description = "a".repeat(maximum - overhead);
  assert.equal(resolve(batch(description)).ok, true);
  const stringify = JSON.stringify;
  let oversizedSerialized = false;
  JSON.stringify = function (value, ...rest) {
    if (typeof value === "string" && value.length > maximum - overhead) oversizedSerialized = true;
    return stringify(value, ...rest);
  };
  try {
    const rejected = resolve(batch(description + "a"));
    assert.equal(rejected.ok, false);
    assert.equal(rejected.diagnostics[0].code, "PTREV-104");
    const source = readFileSync("plans/plan-review-request.pert", "utf8").replace("  version 9", "  version 10");
    const planned = planPlanReviewResolve(source, {
      schemaVersion: "Perttool.PlanReviewResolveRequest.v1",
      requestId: "PRR_001", outcome: "plan_changed", actor: "user",
      resolvedAt: "2026-09-30T10:00:00+09:00", resolutionReason: "Reviewed",
      request: batch(description + "a"),
    });
    assert.equal(planned.ok, false);
    assert.equal(planned.diagnostics[0].code, "PTREV-104");
    assert.equal(planned.diagnostics[0].data.cause, "invalid_change_request");
    assert.equal(planned.updatedText, null);
    assert.equal(planned.changed, false);
    assert.equal(oversizedSerialized, false);
  } finally {
    JSON.stringify = stringify;
  }
});

test("direct library counts escape expansion and multibyte payload before serialization", () => {
  for (const description of ["\u0000".repeat(1_400_000), "\u65e5".repeat(2_800_000)]) {
    const stringify = JSON.stringify;
    let payloadSerialized = false;
    JSON.stringify = function (value, ...rest) {
      if (value === description) payloadSerialized = true;
      return stringify(value, ...rest);
    };
    try {
      assert.equal(resolve(batch(description)).ok, false);
      assert.equal(payloadSerialized, false);
    } finally { JSON.stringify = stringify; }
  }
});
