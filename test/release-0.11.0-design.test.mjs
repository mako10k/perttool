import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocument, getProjectMetadata, selectNextTasks } from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("0.11.0 gate candidate selects Planning Pool and retains separate publication authority", async () => {
  const [plan, requirements, adr, design, procedure, gate, correction, integration, planningContract, changelog, readme, selfUse] = await Promise.all([
    readFile(path.join(root, "plans/planning-pool-release-readiness.pert"), "utf8"),
    readFile(path.join(root, "docs/requirements.md"), "utf8"),
    readFile(path.join(root, "docs/adr/0003-beta-versioning.md"), "utf8"),
    readFile(path.join(root, "docs/basic-design.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-release.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-gate-design.md"), "utf8"),
    readFile(path.join(root, "docs/process/grammar9-milestone-acceptance-mutation-acceptance.md"), "utf8"),
    readFile(path.join(root, "docs/process/planning-pool-release-integration-acceptance.md"), "utf8"),
    readFile(path.join(root, "docs/specs/planning-pool.md"), "utf8"),
    readFile(path.join(root, "CHANGELOG.md"), "utf8"),
    readFile(path.join(root, "README.md"), "utf8"),
    readFile(path.join(root, "scripts/check-self-use.sh"), "utf8"),
  ]);

  const checked = checkDocument(plan);
  const metadata = getProjectMetadata(plan);
  const next = selectNextTasks(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.grammarVersion, 6);
  assert.equal(metadata.project.id, "POOL_RELEASE_READINESS");
  assert.equal(metadata.project.finish, "POOL_RELEASE_ACCEPTED");
  assert.equal(checked.document.declarations.filter(({ kind }) => kind === "task").length, 17);
  assert.deepEqual(next.groups.active, []);
  assert.deepEqual(next.groups.ready, ["POOL_RELEASE_GATE_DESIGN"]);
  assert.deepEqual(next.recommendation.recommendedTaskIds, ["POOL_RELEASE_GATE_DESIGN"]);
  assert.deepEqual(next.temporal.authority.startableRecommendedTaskIds, []);
  assert.deepEqual(next.temporal.authority.assuranceUnavailableRecommendedTaskIds, ["POOL_RELEASE_GATE_DESIGN"]);
  assert.equal(next.temporal.authority.complete, true);
  assert.match(plan, /^task POOL_GRAMMAR9_ACCEPTANCE_MUTATION POOL_INTEGRATED -> POOL_GRAMMAR9_ACCEPTANCE_MUTATION_READY:$/mu);
  assert.match(plan, /^task POOL_RELEASE_GATE_DESIGN POOL_GRAMMAR9_ACCEPTANCE_MUTATION_READY -> POOL_RELEASE_GATE_ACCEPTED:$/mu);
  assert.match(plan, /^  status done$/mu);
  assert.doesNotMatch(plan, /task_outcome OUTCOME_POOL_GRAMMAR9_ACCEPTANCE_MUTATION:/u);
  assert.doesNotMatch(plan, /task_outcome OUTCOME_POOL_RELEASE_GATE_DESIGN:/u);

  assert.match(requirements, /^26\. \[ \] Release the accepted Planning Pool boundary as suffix-free beta$/mu);
  assert.match(requirements, /exact `0\.10\.6` rollback behavior/u);
  assert.match(requirements, /restore milestone criterion-set and receipt\n      mutation for valid Grammar 9 documents/u);
  assert.match(adr, /- Amendment status: Proposed, non-normative until separately accepted by the\n  owner — 2026-08-28 \(`v0\.11\.0` Grammar 9 and CLI Contract 10/u);
  assert.match(adr, /^### Off-main compatible-hotfix publication$/mu);
  assert.match(adr, /^### Proposed Planning Pool `0\.11\.0` target$/mu);
  assert.match(design, /^### Post-MVP Slice 8A: Planning Pool `v0\.11\.0` beta minor$/mu);
  assert.match(procedure, /- Status: Gate design candidate 1\.3; owner acceptance pending/u);
  assert.match(procedure, /`POOL_GRAMMAR9_ACCEPTANCE_MUTATION` restores criterion and receipt mutation/u);
  assert.match(procedure, /PUBLISH requires a later authorization naming that exact candidate/u);
  assert.match(procedure, /Exact `perttool@0\.10\.6` is the rollback pin/u);
  assert.match(gate, /- Document status: Candidate 1\.3; owner acceptance pending/u);
  assert.match(gate, /\| Commands \| 56 \| 71 \|/u);
  assert.match(gate, /stable patch ID `84fe584b8a2895187bcf72df2af289103b49ca88`/u);
  assert.match(gate, /correction task is structurally complete but its Outcome is missing/u);
  assert.match(gate, /assurance requires `restore_assurance_evidence`/u);
  assert.match(gate, /No gate-design task finish, gate milestone criterion, receipt, assurance/u);
  assert.match(correction, /Status: Candidate 1\.3 corrective implementation and complete local gate\n  passed; independent re-review and PERT assurance outcome pending/u);
  assert.match(correction, /before, between, and after Planning Pool declarations/u);
  assert.match(correction, /grammar9-acceptance-before-pool\.pert/u);
  assert.match(correction, /denied persistent request to retain those properties/u);
  assert.match(correction, /1,336 tests/u);
  assert.match(correction, /1,019-file isolated public-package workflow/u);
  assert.match(integration, /The accepted\s+surface remains Grammar 9, CLI Contract 10/u);
  assert.match(integration, /71\ncommands, 29 root schemas, 139 reference-identical root and Node runtime/u);
  assert.match(planningContract, /changes only the version field and owned\nmigration trivia/u);
  assert.match(changelog, /^## \[0\.10\.6\] - 2026-08-28$/mu);
  assert.match(readme, /npm `beta` is the compatible\n`0\.10\.6` Issue #36 correction/u);
  assert.match(selfUse, /plans\/planning-pool-release-readiness\.pert/u);
  assert.match(selfUse, /read-only self-use checks passed \(46 plans/u);
});
