import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkDocument,
  getProjectMetadata,
  selectNextTasks,
} from "../dist/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("0.11.0 blocked gate replan preserves version and separate publication authority", async () => {
  const [plan, requirements, adr, design, procedure, gate, issueBody, replanDocument, replanResealDocument, replanRequestText, correction, integration, planningContract, changelog, readme, selfUse] = await Promise.all([
    readFile(path.join(root, "plans/planning-pool-release-readiness.pert"), "utf8"),
    readFile(path.join(root, "docs/requirements.md"), "utf8"),
    readFile(path.join(root, "docs/adr/0003-beta-versioning.md"), "utf8"),
    readFile(path.join(root, "docs/basic-design.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-release.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-gate-design.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-governance-binding-issue-body.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-gate-replan-candidate.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-gate-replan-reseal-candidate.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-gate-replan-request.json"), "utf8"),
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
  assert.equal(Buffer.byteLength(plan, "utf8"), 31746);
  assert.equal(
    createHash("sha256").update(plan, "utf8").digest("hex"),
    "dc22cb3f3eef3a458fc95cbb6a85c3feeeb054450e27ead38e38ffb84ebc33e5",
  );
  assert.equal(checked.document.declarations.filter(({ kind }) => kind === "task").length, 19);
  assert.deepEqual(next.groups.active, ["POOL_NEXT_SIGNAL_CONSISTENCY"]);
  assert.deepEqual(next.groups.ready, ["POOL_GOVERNANCE_BINDING_FIX"]);
  assert.deepEqual(next.groups.runnableNow, []);
  assert.deepEqual(next.groups.suspended, ["POOL_RELEASE_GATE_DESIGN"]);
  assert.deepEqual(next.recommendation.recommendedTaskIds, []);
  assert.deepEqual(next.temporal.authority.startableRecommendedTaskIds, []);
  assert.deepEqual(next.temporal.authority.assuranceWithheldRecommendedTaskIds, []);
  assert.deepEqual(next.temporal.authority.assuranceUnavailableRecommendedTaskIds, []);
  assert.equal(next.temporal.authority.complete, true);
  assert.match(plan, /^task POOL_GRAMMAR9_ACCEPTANCE_MUTATION POOL_INTEGRATED -> POOL_GRAMMAR9_ACCEPTANCE_MUTATION_READY:$/mu);
  assert.match(plan, /^task POOL_RELEASE_GATE_DESIGN POOL_GRAMMAR9_ACCEPTANCE_MUTATION_READY -> POOL_RELEASE_GATE_ACCEPTED:$/mu);
  assert.match(plan, /task POOL_GRAMMAR9_ACCEPTANCE_MUTATION[\s\S]*?^  status done$/mu);
  assert.match(plan, /task POOL_RELEASE_GATE_DESIGN[\s\S]*?^  status suspended$/mu);
  assert.match(plan, /^task_outcome OUTCOME_POOL_GRAMMAR9_ACCEPTANCE_MUTATION:$/mu);
  assert.match(plan, /^work_event EV_POOL_RELEASE_GATE_DESIGN_START_001:$/mu);
  assert.match(plan, /^work_event EV_POOL_RELEASE_GATE_DESIGN_SUSPEND_P1_REPLAN_001:$/mu);
  assert.match(plan, /^work_event EV_POOL_NEXT_SIGNAL_CONSISTENCY_START_001:$/mu);
  assert.match(plan, /^task POOL_GOVERNANCE_BINDING_FIX /mu);
  assert.match(plan, /^task POOL_NEXT_SIGNAL_CONSISTENCY /mu);
  assert.match(plan, /^milestone POOL_GOVERNANCE_BINDING_READY:$/mu);
  assert.match(plan, /^milestone POOL_NEXT_SIGNAL_READY:$/mu);
  assert.match(plan, /^gate POOL_RELEASE_BINDING_JOIN /mu);
  assert.match(plan, /^gate POOL_RELEASE_NEXT_JOIN /mu);
  assert.match(plan, /Issues #37 and #38 are independently accepted/u);
  assert.doesNotMatch(plan, /task_outcome OUTCOME_POOL_RELEASE_GATE_DESIGN:/u);
  assert.doesNotMatch(plan, /^plan_seal POOL_GOVERNANCE_BINDING_FIX:$/mu);
  assert.match(
    plan,
    /^plan_seal POOL_NEXT_SIGNAL_CONSISTENCY:\n  accepted_contract sha256:4bc05bcecfad08a2ba7e932e040add94326b44aef8f8b43bee683639182212d6\n  accepted_basis sha256:8f880210a2a04a8b6c65bd3e2f9dfc1e13e91db0fd8220872da1fffe248c1819/mu,
  );

  assert.match(requirements, /^26\. \[ \] Release the accepted Planning Pool boundary as suffix-free beta$/mu);
  assert.match(requirements, /exact `0\.10\.6` rollback behavior/u);
  assert.match(requirements, /restore milestone criterion-set and receipt\n      mutation for valid Grammar 9 documents/u);
  assert.match(requirements, /bind every generic Grammar 7 through 9\n      assurance-mutation/u);
  assert.match(requirements, /Resolve Issue #37 so one complete NextResult/u);
  assert.match(adr, /- Amendment status: Proposed, non-normative until separately accepted by the\n  owner — 2026-08-31 \(`v0\.11\.0` Grammar 9 and CLI Contract 10/u);
  assert.match(adr, /^- Status: Accepted$/mu);
  assert.match(adr,
    /^- Accepted scope: Base decision and the amendments listed under `Amended`$/mu);
  assert.match(adr, /^### Off-main compatible-hotfix publication$/mu);
  assert.match(adr, /^### Proposed Planning Pool `0\.11\.0` target$/mu);
  assert.match(design, /^### Post-MVP Slice 8A: Planning Pool `v0\.11\.0` beta minor$/mu);
  assert.match(procedure, /- Status: Gate design Candidate 2\.0; blocked pending P1 remediation;\n  Issue #37 frontier resealed and Issue #38 unsealed/u);
  assert.match(procedure, /`POOL_GRAMMAR9_ACCEPTANCE_MUTATION` restores criterion and receipt mutation/u);
  assert.match(procedure, /PUBLISH requires a later authorization naming that exact candidate/u);
  assert.match(procedure, /Exact `perttool@0\.10\.6` is the rollback pin/u);
  assert.match(gate, /- Document status: Candidate 2\.0; blocked pending P1 remediation; Issue #37\n  frontier resealed and Issue #38 unsealed/u);
  assert.match(gate, /\| Commands \| 56 \| 71 \|/u);
  assert.match(gate, /stable patch ID `84fe584b8a2895187bcf72df2af289103b49ca88`/u);
  assert.match(gate, /at Candidate 2\.0 evidence capture, the source\n  digest was\n  `sha256:80aea315154da1aa810a8366f21b3fa5150ed105641e23050fa372a7d80fd59d`/u);
  assert.match(gate, /separately authorized P1 replan suspended Gate Design and produced source\n  digest\n  `sha256:6c0592deaa94395325fffc817e855a1732db3d13f0bc5b36c3cb0ecb4fe7b3b5`/u);
  assert.match(gate, /selected Issue #37 frontier reseal then produced the\n  current digest\n  `sha256:23ef7711c89afba91733e540e0bd4a91675cbfd6672af2f4c19f4b1bdfe510b7`/u);
  assert.match(gate, /`F-011-BINDING-001 P1`/u);
  assert.match(gate, /`F-011-NEXT-001 P1`/u);
  assert.match(gate, /bug: lifted assurance mutations report governance bound to lowered source bytes/u);
  assert.match(gate, /5,045 UTF-8 bytes, SHA-256\n  `8e372de505defea91735ebf666335159141e3b5fa0077b95653c43f79515d7d9`/u);
  assert.match(gate, /labels added at creation: `bug`, `priority:P1`/u);
  assert.match(gate, /target: Issue #37/u);
  assert.match(gate, /labels added: `bug`, `priority:P1`/u);
  assert.match(gate, /do not mutate Issue #35 in this batch/u);
  assert.match(gate, /assigned identity: Issue #38, open/u);
  assert.match(gate, /Issue #21 and Issue #35 were not mutated/u);
  assert.equal(Buffer.byteLength(issueBody, "utf8"), 5045);
  assert.equal(
    createHash("sha256").update(issueBody, "utf8").digest("hex"),
    "8e372de505defea91735ebf666335159141e3b5fa0077b95653c43f79515d7d9",
  );
  assert.match(issueBody, /source_digest == original_digest == governance\.source_digest/u);
  assert.match(issueBody, /persistence still checks the outer/u);
  assert.match(issueBody, /^P1\./mu);
  assert.equal(Buffer.byteLength(replanRequestText, "utf8"), 2972);
  assert.equal(
    createHash("sha256").update(replanRequestText, "utf8").digest("hex"),
    "b7535d14b0d5150872a3c5d8f66e93688ecedf37cf5d91bfd4a5855113343787",
  );
  const replanRequest = JSON.parse(replanRequestText);
  assert.equal(replanRequest.kind, "batch");
  assert.deepEqual(replanRequest.mutations.map(({ kind, id }) => [kind, id]), [
    ["milestone.add", "POOL_GOVERNANCE_BINDING_READY"],
    ["milestone.add", "POOL_NEXT_SIGNAL_READY"],
    ["task.add", "POOL_GOVERNANCE_BINDING_FIX"],
    ["task.add", "POOL_NEXT_SIGNAL_CONSISTENCY"],
    ["gate.add", "POOL_RELEASE_BINDING_JOIN"],
    ["gate.add", "POOL_RELEASE_NEXT_JOIN"],
    ["task.set", "POOL_RELEASE_GATE_DESIGN"],
  ]);
  assert.deepEqual(next.assurance.replanRequiredTaskIds, [
    "POOL_RELEASE_ACCEPTANCE",
    "POOL_RELEASE_CANDIDATE",
    "POOL_RELEASE_GATE_DESIGN",
    "POOL_RELEASE_PREPARATION",
    "POOL_RELEASE_PUBLISH",
  ]);
  assert.equal(next.assurance.requiredActions.length, 1);
  assert.equal(next.assurance.requiredActions[0].kind, "replan_and_reseal");
  assert.match(replanDocument, /Status: Candidate 1\.0 applied exactly and independently read back; the\n  selected-frontier reseal completed separately/u);
  assert.match(replanDocument, /An earlier preview[\s\S]*?failed with `PTDAG-207`/u);
  assert.match(replanDocument, /does not silently reuse the old accepted bases/u);
  assert.match(replanDocument, /Both writes are complete/u);
  assert.match(replanResealDocument, /Status: Candidate 1\.1 applied exactly and independently read back; single-\n  frontier task/u);
  assert.match(replanResealDocument, /Source PERT digest:\n  `sha256:6c0592deaa94395325fffc817e855a1732db3d13f0bc5b36c3cb0ecb4fe7b3b5`/u);
  assert.match(replanResealDocument, /Candidate PERT digest:\n  `sha256:23ef7711c89afba91733e540e0bd4a91675cbfd6672af2f4c19f4b1bdfe510b7`/u);
  assert.match(replanResealDocument, /Candidate 1\.0 seven-task bulk reseal/u);
  assert.match(replanResealDocument, /review queue, not an\ninstruction to accept the entire queue/u);
  assert.match(replanResealDocument, /This is not an incomplete write/u);
  assert.match(replanResealDocument, /The owner accepted only one `plan-assurance\.reseal` write for\n`POOL_NEXT_SIGNAL_CONSISTENCY`/u);
  assert.match(replanResealDocument, /That write is complete and independently read back/u);
  assert.match(gate, /`POOL_RELEASE_GATE_DESIGN` started at/u);
  assert.match(gate, /No gate-design task finish, gate milestone criterion, receipt, assurance/u);
  assert.match(correction, /Status: Candidate 1\.4 independently accepted with a conformant PERT\n  assurance outcome/u);
  assert.match(correction, /before, between, and after Planning Pool declarations/u);
  assert.match(correction, /grammar9-acceptance-before-pool\.pert/u);
  assert.match(correction, /denied persistent request to retain those properties/u);
  assert.match(correction, /1,336 tests/u);
  assert.match(correction, /1,019-file isolated public-package workflow/u);
  assert.match(correction, /installed `Perttool\.MutationResult\.v6` schema/u);
  assert.match(integration, /The accepted\s+surface remains Grammar 9, CLI Contract 10/u);
  assert.match(integration, /71\ncommands, 29 root schemas, 139 reference-identical root and Node runtime/u);
  assert.match(planningContract, /changes only the version field and owned\nmigration trivia/u);
  assert.match(changelog, /^## \[0\.10\.6\] - 2026-08-28$/mu);
  assert.match(readme, /npm `beta` is the compatible\n`0\.10\.6` Issue #36 correction/u);
  assert.match(selfUse, /plans\/planning-pool-release-readiness\.pert/u);
  assert.match(selfUse, /read-only self-use checks passed \(46 plans/u);
});
