import assert from "node:assert/strict";
import test from "node:test";
import { CONTRACT9_COMMAND_REGISTRY, getContract9CommandDiscovery } from "../dist/command/contract9-discovery.js";

const replacements = new Map([
  ["Perttool.ProjectResult.v4", "Perttool.ProjectResult.v5"], ["Perttool.CheckResult.v5", "Perttool.CheckResult.v6"],
  ["Perttool.AnalysisResult.v6", "Perttool.AnalysisResult.v7"], ["Perttool.NextResult.v7", "Perttool.NextResult.v8"],
  ["Perttool.MutationResult.v5", "Perttool.MutationResult.v6"], ["Perttool.PlanAssuranceResult.v1", "Perttool.PlanAssuranceResult.v2"],
  ["Perttool.UnitMigrationResult.v3", "Perttool.UnitMigrationResult.v4"],
]);

test("all 56 Contract 9 command paths resolve to one descriptor", () => {
  assert.equal(CONTRACT9_COMMAND_REGISTRY.length, 56);
  assert.equal(new Set(CONTRACT9_COMMAND_REGISTRY.map(({ path }) => path.join("\0"))).size, 56);
  for (const descriptor of CONTRACT9_COMMAND_REGISTRY) {
    const [resource, ...action] = descriptor.path;
    const result = action.length === 0 ? getContract9CommandDiscovery({ resource, action: null })
      : getContract9CommandDiscovery({ resource, action: action.join(" ") });
    assert.equal(result.ok, true, descriptor.operation);
    assert.equal(result.commands.some(({ operation }) => operation === descriptor.operation), true, descriptor.operation);
  }
});

test("Contract 9 replaces all seven identities without retaining an old identity", () => {
  const advertised = new Set(CONTRACT9_COMMAND_REGISTRY.flatMap(({ resultSchemas }) => resultSchemas));
  for (const [oldIdentity, replacement] of replacements) {
    assert.equal(advertised.has(oldIdentity), false, oldIdentity);
    assert.equal(advertised.has(replacement), true, replacement);
  }
  assert.equal([...advertised].filter((identity) => identity.startsWith("Perttool.")).length, 22);
});
