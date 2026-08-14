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
    grammar,
    milestoneAcceptance,
    override,
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
    read("docs/specs/dsl-grammar.md"),
    read("docs/specs/milestone-acceptance.md"),
    read("docs/specs/recommendation-override.md"),
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
  assert.match(readme, /package=perttool@0\.9\.4/);
  assert.match(readme, /npm currently reports\s+`latest=0\.9\.0`, `beta=0\.9\.3`, and no `alpha`/);
  assert.match(readme, /Version `0\.9\.0` is the published Grammar 7 and CLI Contract 8/);
  assert.match(readme, /Version `0\.9\.2` is the published compatible Contract 8 emergency patch/);
  assert.match(
    readme,
    /At its publication\s+boundary, this release does not move npm `latest` from Contract 6 `0\.6\.0`/,
  );
  assert.match(requirements, /active Grammar 7 and CLI\s+Contract 8 source/);
  assert.match(requirements, /Perttool\.NextResult\.v7/);
  assert.match(examples, /retained Grammar 6 assurance source contract/);
  assert.match(examples, /Grammar 7 and CLI Contract 8 source successor/);
  assert.match(assuranceInterface, /Published package boundary: `beta=latest=0\.8\.1`/);
  assert.match(assuranceInterface, /Contract 8 source successor/);
  assert.match(grammar, /Grammar versions: 1, 2, 3, 4, 5, 6, and 7 active/);
  assert.match(grammar, /^### 20\.6 Grammar version 7 milestone-acceptance delta/m);
  assert.match(milestoneAcceptance, /Status: Normative 1\.0/);
  assert.match(milestoneAcceptance, /Active source CLI contract: Contract 8/);
  assert.match(override, /source_schema_version\s+"Perttool\.NextResult\.v7"/);
  assert.match(contract2, /active source is now CLI Contract 8/);
  assert.match(contract3, /active Contract 8/);
  assert.match(temporalUnits, /historical Grammar 3 and CLI Contract 4/);
  assert.match(projectActuals, /active Grammar 7 and CLI Contract 8 source retains/);
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
    assert.match(policy, /Perttool\.NextResult\.v7/);
    assert.match(policy, /beta=latest=0\.9\.0/);
    assert.match(policy, /0\.9\.2.*rollback pin/s);
  }
  assert.match(selfUseScript, /plans\/help-guide-consistency\.pert/);
  assert.match(selfUseScript, /plans\/adapter-platform\.pert/);
  assert.match(selfUseScript, /42 plans; check, analyze, next/);
  assert.match(selfUseGuide, /all forty-two current plans/);
  assert.match(planIndex, /`help-guide-consistency\.pert`/);
  assert.match(planIndex, /All forty-two plans pass/);
  assert.match(planIndex, /accepted reached final milestone/);
});
