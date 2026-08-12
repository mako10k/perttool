import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocument } from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const acceptanceCaseIds = [
  "HGC-001",
  "HGC-002",
  "HGC-003",
  "HGC-004",
  "HGC-005",
  "HGC-006",
  "HGC-007",
];

test("GUIDE-CONSISTENCY-001 contract, completed plan, and acceptance trace agree", async () => {
  const [contract, plan, acceptance] = await Promise.all([
    read("docs/specs/help-guide-consistency.md"),
    read("plans/help-guide-consistency.pert"),
    read("docs/process/help-guide-consistency-acceptance.md"),
  ]);

  assert.equal(checkDocument(plan).ok, true);
  assert.deepEqual(
    [...contract.matchAll(/^\| `(HGC-\d{3})` \|/gm)].map((match) => match[1]),
    acceptanceCaseIds,
  );
  assert.deepEqual(
    [...plan.matchAll(/^task (GUIDE_[A-Z_]+) /gm)].map((match) => match[1]),
    [
      "GUIDE_CONSISTENCY_CONTRACT",
      "GUIDE_RUNTIME_REPAIR",
      "GUIDE_DOCUMENT_RECONCILIATION",
      "GUIDE_CONSISTENCY_ACCEPTANCE",
    ],
  );
  assert.equal(plan.match(/^  status done$/gm)?.length, 4);
  assert.match(
    acceptance,
    /Final pre-advance plan digest: `sha256:53acadb6ce8e31058b455b327fa2a01089534ea034982c3e90cb1ecced4846e9`/,
  );
  for (const caseId of acceptanceCaseIds) {
    assert.equal(acceptance.includes(`| \`${caseId}\` |`), true);
  }
});

test("current guidance and historical compatibility labels preserve their boundaries", async () => {
  const [
    readme,
    requirements,
    examples,
    assuranceInterface,
    contract2,
    contract3,
    temporalUnits,
    projectActuals,
    governance,
  ] = await Promise.all([
    read("README.md"),
    read("docs/requirements.md"),
    read("docs/examples/plan-assurance.md"),
    read("docs/specs/plan-assurance-interface.md"),
    read("docs/specs/interfaces.md"),
    read("docs/specs/cli-contract-3.md"),
    read("docs/specs/temporal-unit-interface.md"),
    read("docs/specs/project-actuals.md"),
    read("docs/specs/governance-interface.md"),
  ]);

  assert.match(
    readme,
    /made `beta=latest=0\.7\.1`/,
  );
  assert.match(readme, /package=perttool@0\.8\.0/);
  assert.match(
    readme,
    /At its publication\s+boundary, this release does not move npm `latest` from Contract 6 `0\.6\.0`/,
  );
  assert.match(requirements, /active Grammar 6 and CLI Contract 7 source/);
  assert.match(examples, /active Grammar 6 source contract/);
  assert.match(assuranceInterface, /Active package boundary: `beta=latest=0\.7\.1`/);
  assert.match(contract2, /active source is now CLI Contract 7/);
  assert.match(contract3, /active Contract 7/);
  assert.match(temporalUnits, /historical Grammar 3 and CLI Contract 4/);
  assert.match(projectActuals, /active Grammar 6 and CLI Contract 7 source retains/);
  assert.match(governance, /Pre-cutover Contract 4 identity/);
});

test("repository policy and self-use registration include the accepted workstream", async () => {
  const [agents, copilot, selfUseScript, selfUseGuide, planIndex] =
    await Promise.all([
      read("AGENTS.md"),
      read(".github/copilot-instructions.md"),
      read("scripts/check-self-use.sh"),
      read("docs/process/self-use.md"),
      read("plans/README.md"),
    ]);

  for (const policy of [agents, copilot]) {
    assert.match(policy, /GUIDE-CONSISTENCY-001/);
    assert.match(policy, /help-guide-consistency-acceptance\.md/);
  }
  assert.match(selfUseScript, /plans\/help-guide-consistency\.pert/);
  assert.match(selfUseScript, /plans\/adapter-platform\.pert/);
  assert.match(selfUseScript, /37 plans; check, analyze, next/);
  assert.match(selfUseGuide, /all thirty-seven current plans/);
  assert.match(planIndex, /`help-guide-consistency\.pert`/);
});
