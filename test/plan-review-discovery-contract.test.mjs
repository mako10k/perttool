import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTRACT11_COMMAND_REGISTRY,
  getContract11CommandDiscovery,
  contract11CommandHelpResultToJson,
  renderContract11CommandHelpResult,
} from "../dist/command/contract11-discovery.js";
import { validateContract11CommandInvocation } from "../dist/command/contract11-usage.js";
import { getContract11Guide, contract11GuideResultToJson, renderContract11GuideResult } from "../dist/help/contract11-guide.js";

test("Contract 11 exposes exactly four Plan Review paths and closed result identities", () => {
  assert.equal(CONTRACT11_COMMAND_REGISTRY.length, 75);
  const review = CONTRACT11_COMMAND_REGISTRY.filter(({ path }) => path[0] === "plan");
  assert.deepEqual(review.map(({ path }) => path.join(" ")), [
    "plan review-request", "plan review-list", "plan review-show", "plan review-resolve",
  ]);
  assert.deepEqual(review.map(({ resultSchemas }) => resultSchemas[0]), [
    "Perttool.PlanReviewMutationResult.v1", "Perttool.PlanReviewResult.v1",
    "Perttool.PlanReviewResult.v1", "Perttool.PlanReviewMutationResult.v1",
  ]);
  for (const descriptor of review) {
    assert.equal(descriptor.contractVersion, 11);
    const argv = descriptor.examples[0].invocation.split(/\s+/u).slice(1);
    if (descriptor.operation !== "plan.review-request" && descriptor.operation !== "plan.review-resolve") {
      assert.equal(validateContract11CommandInvocation(argv).ok, true);
    }
  }
});

test("Plan Review usage enforces required fields and resolution request outcome", () => {
  const create = ["plan", "review-request", "plan.pert", "REVIEW_1", "TASK_1", "--reason", "review", "--created-at", "2026-09-29T09:00:00+09:00", "--actor", "alice"];
  assert.equal(validateContract11CommandInvocation(create).ok, true);
  assert.equal(validateContract11CommandInvocation(create.slice(0, -2)).ok, false);
  const resolve = ["plan", "review-resolve", "plan.pert", "REVIEW_1", "--outcome", "plan_retained", "--resolved-at", "2026-09-29T10:00:00+09:00", "--actor", "alice", "--resolution-reason", "retained"];
  assert.equal(validateContract11CommandInvocation(resolve).ok, true);
  assert.equal(validateContract11CommandInvocation([...resolve, "--request", "batch.json"]).ok, false);
  const changed = resolve.map((part) => part === "plan_retained" ? "plan_changed" : part);
  assert.equal(validateContract11CommandInvocation(changed).ok, false);
  assert.equal(validateContract11CommandInvocation([...changed, "--request", "batch.json"]).ok, true);
  assert.equal(validateContract11CommandInvocation([...changed, "--request", "-"].map((part) => part === "plan.pert" ? "-" : part)).ok, false);
});

test("registry drives text and JSON Help plus Plan Review Guide", () => {
  const help = getContract11CommandDiscovery({ resource: "plan", action: "review-resolve" });
  assert.equal(help.ok, true);
  assert.equal(help.commands.length, 1);
  const json = contract11CommandHelpResultToJson(help);
  assert.equal(json.cli_contract_version, 11);
  assert.match(renderContract11CommandHelpResult(help), /review-resolve/u);
  const guide = getContract11Guide("plan-review", "detail");
  assert.equal(guide.ok, true);
  assert.equal(contract11GuideResultToJson(guide).cli_contract_version, 11);
  const rendered = renderContract11GuideResult(guide);
  for (const term of ["Active work", "local safety", "new downstream", "plan_retained", "plan_changed", "Plan Assurance", "Milestone Outcome Acceptance", "mutation authority"]) {
    assert.match(rendered, new RegExp(term, "iu"));
  }
  assert.ok(getContract11Guide(null, "index").topics.some(({ id }) => id === "plan-review"));
});
