import assert from "node:assert/strict";
import test from "node:test";
import { getContract9Guide, contract9GuideResultToJson, renderContract9GuideResult } from "../dist/help/contract9-guide.js";
import { getContract9CommandDiscovery } from "../dist/command/contract9-discovery.js";
import { validateContract9CommandInvocation } from "../dist/command/contract9-usage.js";

test("Contract 9 Guide owns temporal schedule and POSTDUE driver adoption", () => {
  const result = getContract9Guide("temporal-schedule", "detail");
  assert.equal(result.ok, true);
  assert.equal(result.cliContractVersion, 9);
  assert.match(renderContract9GuideResult(result), /analysis_argv/u);
  assert.equal(contract9GuideResultToJson(result).topic_id, "temporal-schedule");
  assert.equal(getContract9Guide(null, "index").topics.some(({ id }) => id === "temporal-schedule"), true);
});

test("calendar Help examples use accepted Contract 9 command forms", () => {
  for (const action of ["add", "set", "remove"]) {
    const result = getContract9CommandDiscovery({ resource: "calendar", action });
    assert.equal(result.ok, true);
    const argv = action === "remove" ? ["calendar", action, "plan.pert", "STANDARD", "--diff"]
      : ["calendar", action, "plan.pert", "STANDARD", "--weekday", "mon 09:00..17:00", "--diff"];
    assert.equal(validateContract9CommandInvocation(argv).ok, true, action);
    assert.doesNotMatch(result.commands[0].examples[0].invocation, /--preview/u);
  }
});
