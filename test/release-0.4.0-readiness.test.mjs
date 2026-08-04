import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COMMAND_REGISTRY,
  GOVERNANCE_DIRECT_EDIT_WARNING,
  analyzeDocument,
  checkDocument,
  getProjectMetadata,
  planMutation,
  selectNextTasks,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryFile(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("0.4.0 readiness consumes the reached governance finish", async () => {
  const [plan, acceptance, designAcceptance, readiness] = await Promise.all([
    repositoryFile("plans/governance.pert"),
    repositoryFile("docs/process/governance-acceptance.md"),
    repositoryFile("docs/process/governance-design-acceptance.md"),
    repositoryFile("docs/process/0.4.0-contract5-readiness.md"),
  ]);

  assert.match(
    plan,
    /^milestone GOVERNANCE_ACCEPTED:\n(?:.*\n)*?  state reached$/m,
  );
  const checked = checkDocument(plan);
  const metadata = getProjectMetadata(plan);
  const analyzed = analyzeDocument(plan);
  const next = selectNextTasks(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.project.finish, "GOVERNANCE_ACCEPTED");
  assert.equal(checked.summary.tasks, 0);
  assert.equal(analyzed.precedence.makespan.numerator, 0n);
  assert.equal(analyzed.resource.makespan.numerator, 0n);
  assert.deepEqual(next.recommendation.recommendedTaskIds, []);
  assert.deepEqual(next.temporal.authority.startableRecommendedTaskIds, []);

  assert.match(acceptance, /Document status: Accepted/);
  assert.deepEqual(
    [...acceptance.matchAll(/^\| `GOV-AC-(\d{3})` \| Accepted \|/gm)].map(
      (match) => match[1],
    ),
    ["001", "002", "003", "004", "005", "006", "007", "008", "009", "010"],
  );
  assert.match(
    designAcceptance,
    /There are no open governance design review findings\./,
  );
  assert.match(readiness, /Document status: Accepted 1\.0/);
  assert.match(readiness, /There are no open Contract 5 readiness findings/);
  assert.match(readiness, /starts only\s+`RELEASE_040_PREPARATION`/);
});

test("0.4.0 readiness observes the atomic public Contract 5 boundary", async () => {
  const [legacy, readiness] = await Promise.all([
    repositoryFile("docs/examples/minimal.pert"),
    repositoryFile("docs/process/0.4.0-contract5-readiness.md"),
  ]);
  const governed = legacy
    .replace("  version 1", "  version 4")
    .replace(
      "  finish DONE",
      "  finish DONE\n  goal_owner user\n  dag_owner user",
    );

  assert.equal(COMMAND_REGISTRY.length, 44);
  for (const route of [
    "guide",
    "project show",
    "project set",
    "project migrate-unit",
    "dag advance",
    "batch apply",
  ]) {
    assert.ok(
      COMMAND_REGISTRY.some(({ path: commandPath }) => commandPath.join(" ") === route),
      route,
    );
  }

  const legacyMetadata = getProjectMetadata(legacy);
  assert.equal(legacyMetadata.ok, true);
  assert.equal(legacyMetadata.grammarVersion, 1);
  assert.equal(legacyMetadata.project.governance.effective.goalOwner, "user");
  assert.equal(legacyMetadata.project.governance.effective.dagOwner, "user");
  assert.deepEqual(
    [...legacyMetadata.project.governance.effective.goalDelegates],
    [],
  );
  assert.deepEqual(
    [...legacyMetadata.project.governance.effective.dagDelegates],
    [],
  );

  const mutation = {
    kind: "project.set",
    set: { goalOwner: "admin" },
  };
  const preview = planMutation(governed, mutation);
  assert.equal(preview.schemaVersion, "Perttool.MutationResult.v4");
  assert.equal(preview.ok, true);
  assert.equal(
    preview.governance.schemaVersion,
    "Perttool.GovernanceDecision.v2",
  );
  assert.equal(preview.governance.intent, "preview");
  assert.equal(preview.governance.writeAuthorized, false);
  assert.deepEqual(preview.diagnostics, []);

  const denied = planMutation(governed, mutation, {
    governance: { intent: "persist", actor: "codex" },
  });
  assert.equal(denied.ok, false);
  assert.deepEqual(
    denied.diagnostics.map(({ code }) => code),
    ["PTGOV-101"],
  );
  assert.equal(denied.governance.writeAuthorized, false);

  const authorized = planMutation(governed, mutation, {
    governance: {
      intent: "persist",
      actor: "codex",
      acceptedByOwner: ["user"],
    },
  });
  assert.equal(authorized.ok, true);
  assert.equal(authorized.governance.writeAuthorized, true);
  assert.deepEqual(authorized.diagnostics, []);

  assert.match(GOVERNANCE_DIRECT_EDIT_WARNING, /direct DSL editing bypasses/);
  for (const identity of [
    "Grammar 1/2/3/4",
    "ProjectResult v3",
    "MutationResult v2",
    "GovernanceDecision v1",
    "28-command registry",
  ]) {
    assert.ok(readiness.includes(identity), identity);
  }
});
