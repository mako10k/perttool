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

test("0.11.0 publication and durable acceptance retain their exact boundaries", async () => {
  const [plan, requirements, adr, design, procedure, preparation, candidate, publication, acceptance, gate, gateReview, issueBody, bindingContract, bindingAcceptance, replanDocument, replanResealDocument, replanRequestText, correction, integration, planningContract, changelog, readme, selfUse, manifestText, lockText, lspManifestText, mcpManifestText, versionSource, mcpProtocol] = await Promise.all([
    readFile(path.join(root, "plans/planning-pool-release-readiness.pert"), "utf8"),
    readFile(path.join(root, "docs/requirements.md"), "utf8"),
    readFile(path.join(root, "docs/adr/0003-beta-versioning.md"), "utf8"),
    readFile(path.join(root, "docs/basic-design.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-release.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-preparation.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-candidate.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-publish.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-release-acceptance.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-gate-design.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-gate-design-independent-review.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-governance-binding-issue-body.md"), "utf8"),
    readFile(path.join(root, "docs/process/issue-38-governance-binding-contract-acceptance.md"), "utf8"),
    readFile(path.join(root, "docs/process/issue-38-governance-binding-acceptance.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-gate-replan-candidate.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-gate-replan-reseal-candidate.md"), "utf8"),
    readFile(path.join(root, "docs/process/0.11.0-gate-replan-request.json"), "utf8"),
    readFile(path.join(root, "docs/process/grammar9-milestone-acceptance-mutation-acceptance.md"), "utf8"),
    readFile(path.join(root, "docs/process/planning-pool-release-integration-acceptance.md"), "utf8"),
    readFile(path.join(root, "docs/specs/planning-pool.md"), "utf8"),
    readFile(path.join(root, "CHANGELOG.md"), "utf8"),
    readFile(path.join(root, "README.md"), "utf8"),
    readFile(path.join(root, "scripts/check-self-use.sh"), "utf8"),
    readFile(path.join(root, "package.json"), "utf8"),
    readFile(path.join(root, "package-lock.json"), "utf8"),
    readFile(path.join(root, "adapters/lsp/package.json"), "utf8"),
    readFile(path.join(root, "adapters/mcp/package.json"), "utf8"),
    readFile(path.join(root, "src/version.ts"), "utf8"),
    readFile(path.join(root, "adapters/mcp/src/protocol.ts"), "utf8"),
  ]);

  const checked = checkDocument(plan);
  const metadata = getProjectMetadata(plan);
  const next = selectNextTasks(plan);
  assert.equal(checked.ok, true);
  assert.equal(metadata.ok, true);
  assert.equal(metadata.grammarVersion, 6);
  assert.equal(metadata.project.id, "POOL_RELEASE_READINESS");
  assert.equal(metadata.project.finish, "POOL_RELEASE_ACCEPTED");
  assert.equal(Buffer.byteLength(plan, "utf8"), 37304);
  assert.equal(
    createHash("sha256").update(plan, "utf8").digest("hex"),
    "e7cbb956bc2d1959513e4149a700d8d0f964bd37ed285e331d20d5db3652fcfe",
  );
  assert.equal(checked.document.declarations.filter(({ kind }) => kind === "task").length, 19);
  assert.deepEqual(next.groups.active, []);
  assert.deepEqual(next.groups.ready, []);
  assert.deepEqual(next.groups.runnableNow, []);
  assert.deepEqual(next.groups.suspended, []);
  assert.deepEqual(next.recommendation.recommendedTaskIds, []);
  assert.deepEqual(next.temporal.authority.startableRecommendedTaskIds, []);
  assert.deepEqual(next.temporal.authority.assuranceWithheldRecommendedTaskIds, []);
  assert.deepEqual(next.temporal.authority.assuranceUnavailableRecommendedTaskIds, []);
  assert.equal(next.temporal.authority.complete, true);
  const manifest = JSON.parse(manifestText);
  const lock = JSON.parse(lockText);
  assert.equal(manifest.version, "0.11.0");
  assert.equal(lock.version, "0.11.0");
  assert.equal(lock.packages[""].version, "0.11.0");
  assert.equal(JSON.parse(lspManifestText).peerDependencies.perttool, "0.11.0");
  assert.equal(JSON.parse(mcpManifestText).peerDependencies.perttool, "0.11.0");
  assert.match(versionSource, /TOOL_VERSION = "0\.11\.0"/u);
  assert.match(mcpProtocol, /MCP_SERVER_VERSION = "0\.11\.0"/u);
  assert.match(plan, /^task POOL_GRAMMAR9_ACCEPTANCE_MUTATION POOL_INTEGRATED -> POOL_GRAMMAR9_ACCEPTANCE_MUTATION_READY:$/mu);
  assert.match(plan, /^task POOL_RELEASE_GATE_DESIGN POOL_GRAMMAR9_ACCEPTANCE_MUTATION_READY -> POOL_RELEASE_GATE_ACCEPTED:$/mu);
  assert.match(plan, /task POOL_GRAMMAR9_ACCEPTANCE_MUTATION[\s\S]*?^  status done$/mu);
  assert.match(plan, /task POOL_RELEASE_GATE_DESIGN[\s\S]*?^  status done$/mu);
  assert.match(plan, /^task_outcome OUTCOME_POOL_GRAMMAR9_ACCEPTANCE_MUTATION:$/mu);
  assert.match(plan, /^work_event EV_POOL_RELEASE_GATE_DESIGN_START_001:$/mu);
  assert.match(plan, /^work_event EV_POOL_RELEASE_GATE_DESIGN_SUSPEND_P1_REPLAN_001:$/mu);
  assert.match(plan, /^work_event EV_POOL_NEXT_SIGNAL_CONSISTENCY_START_001:$/mu);
  assert.match(plan, /^work_event EV_POOL_NEXT_SIGNAL_CONSISTENCY_FINISH_001:$/mu);
  assert.match(plan, /^work_event WE-26ef416bb9b80c97de8769bf00e011a25684c09ab13a12a7a81c2541140c160e:$/mu);
  assert.match(plan, /^work_event WE-95d0cc29dea5f4191faaae707b0f8cff442643564c57a894eb5bce2ce2242363:$/mu);
  assert.match(plan, /^work_event WE-8daaa5c3aa9b79169d1afd805ad828629da6af3c3ac65e6c709735dc08700452:$/mu);
  assert.match(plan, /^task_outcome OUTCOME_POOL_NEXT_SIGNAL_CONSISTENCY:$/mu);
  assert.match(
    plan,
    /^task_outcome OUTCOME_POOL_GOVERNANCE_BINDING_FIX:\n  model 1\n  task POOL_GOVERNANCE_BINDING_FIX\n  against_basis sha256:95a77c4e1ce8cf8272a2cecfa32f4e1602663e7c7a93e499d3210c97ad8ad9f7\n  status conformant\n  reason "Accepted authoritative outer-source governance binding across Grammar 7 through 9"$/mu,
  );
  assert.match(plan, /task POOL_NEXT_SIGNAL_CONSISTENCY[\s\S]*?^  status done$/mu);
  assert.match(plan, /^task POOL_GOVERNANCE_BINDING_FIX /mu);
  assert.match(plan, /task POOL_GOVERNANCE_BINDING_FIX[\s\S]*?^  status done$/mu);
  assert.match(plan, /^task POOL_NEXT_SIGNAL_CONSISTENCY /mu);
  assert.match(plan, /^milestone POOL_GOVERNANCE_BINDING_READY:$/mu);
  assert.match(plan, /^milestone POOL_NEXT_SIGNAL_READY:$/mu);
  assert.match(plan, /^gate POOL_RELEASE_BINDING_JOIN /mu);
  assert.match(plan, /^gate POOL_RELEASE_NEXT_JOIN /mu);
  assert.match(plan, /Issues #37 and #38 are independently accepted/u);
  assert.match(
    plan,
    /^task_outcome OUTCOME_POOL_RELEASE_GATE_DESIGN:\n  model 1\n  task POOL_RELEASE_GATE_DESIGN\n  against_basis sha256:67501d4e662d6274c5ab3b4b9caba9c13b74e2e369ecbefbc18f51a8e5a0cebe\n  status conformant\n  reason "Accepted Planning Pool 0\.11\.0 Gate Design Candidate 3\.0, complete gate, and independent exact-byte review"$/mu,
  );
  assert.match(
    plan,
    /^work_event WE-5d6811b35e0b11e90b5ac366ecb0c0490eed605343bba379d8fc912acb7740b8:\n  model 1\n  task POOL_RELEASE_GATE_DESIGN\n  kind finish\n  occurred_at 2026-09-07T17:25:35\+09:00\n  active_time 12143\/3600h\n  effort 12143\/1800ph$/mu,
  );
  assert.match(
    plan,
    /^work_event WE-cb1e80b08036598dde1feeeb8bd28fbbacb26b27333b38c756108b99d5f9df69:\n  model 1\n  task POOL_RELEASE_PREPARATION\n  kind start\n  occurred_at 2026-09-07T17:36:09\+09:00$/mu,
  );
  assert.match(
    plan,
    /^work_event WE-c927fda87e832076728fa97068e98a4317a99ecddfbef5308d7a9ba883e01891:\n  model 1\n  task POOL_RELEASE_PREPARATION\n  kind finish\n  occurred_at 2026-09-07T18:07:56\+09:00\n  active_time 1907\/3600h\n  effort 1907\/3600ph$/mu,
  );
  assert.match(
    plan,
    /^task_outcome OUTCOME_POOL_RELEASE_PREPARATION:\n  model 1\n  task POOL_RELEASE_PREPARATION\n  against_basis sha256:f0636f232c12b847f67aeb4f5dbfc8540492acf8b2737eea93cd5b21bf75f04b\n  status conformant\n  reason "Accepted 0\.11\.0 Source Preparation Candidate 1\.0 and complete local and installed-package gates"$/mu,
  );
  assert.match(
    plan,
    /^work_event WE-1be9d73935180a33e985f66b7d622860d9e8befeb8b9474dc9c3947af7ad7524:\n  model 1\n  task POOL_RELEASE_CANDIDATE\n  kind start\n  occurred_at 2026-09-07T18:10:08\+09:00$/mu,
  );
  assert.match(plan, /task POOL_RELEASE_CANDIDATE[\s\S]*?^  status done$/mu);
  assert.match(
    plan,
    /^work_event WE-25faa3fa63108492c5a45f38e992cc21b90990716e0cc5108bd1be8afaf7d1a6:\n  model 1\n  task POOL_RELEASE_CANDIDATE\n  kind finish\n  occurred_at 2026-09-07T18:43:45\+09:00\n  active_time 2017\/3600h\n  effort 2017\/3600ph$/mu,
  );
  assert.match(
    plan,
    /^task_outcome OUTCOME_POOL_RELEASE_CANDIDATE:\n  model 1\n  task POOL_RELEASE_CANDIDATE\n  against_basis sha256:c3200795a64a2e6172ee0a3a75b50522836441f3cdaf263601855ebdb7f56029\n  status conformant\n  reason "Accepted 0\.11\.0 Planning Pool Immutable Candidate 1\.0 from commit 6ad44db8aa833e5f7fbdc49adfef39419151984a and tarball sha256:fa43e222fa6a53c0a5287a1cca7700b7808179513743db0a9a5790c2192fecf4"$/mu,
  );
  assert.match(
    plan,
    /^plan_seal POOL_GOVERNANCE_BINDING_FIX:\n  accepted_contract sha256:8d28314e3f599e5890505822b1e95a100518d13d1dc9f17d997bd587c839b56f\n  accepted_basis sha256:95a77c4e1ce8cf8272a2cecfa32f4e1602663e7c7a93e499d3210c97ad8ad9f7/mu,
  );
  assert.match(
    plan,
    /^plan_seal POOL_NEXT_SIGNAL_CONSISTENCY:\n  accepted_contract sha256:4bc05bcecfad08a2ba7e932e040add94326b44aef8f8b43bee683639182212d6\n  accepted_basis sha256:8f880210a2a04a8b6c65bd3e2f9dfc1e13e91db0fd8220872da1fffe248c1819/mu,
  );
  assert.match(
    plan,
    /^plan_seal POOL_RELEASE_GATE_DESIGN:\n  accepted_contract sha256:6e67b379ee4cbbefa16ae331ea5bb727dc826aaec9735c430d828a4df4e234db\n  accepted_basis sha256:67501d4e662d6274c5ab3b4b9caba9c13b74e2e369ecbefbc18f51a8e5a0cebe/mu,
  );
  assert.match(
    plan,
    /^plan_seal POOL_RELEASE_PREPARATION:\n  accepted_contract sha256:2c947c3f[\s\S]*?accepted_basis sha256:f0636f23/mu,
  );
  assert.match(
    plan,
    /^plan_seal POOL_RELEASE_CANDIDATE:\n  accepted_contract sha256:5a5303fe1d02c85310649b7b99f380b937c69dc1afc670c461ab6f16496bb02c\n  accepted_basis sha256:c3200795a64a2e6172ee0a3a75b50522836441f3cdaf263601855ebdb7f56029/mu,
  );
  assert.match(
    plan,
    /^plan_seal POOL_RELEASE_PUBLISH:\n  accepted_contract sha256:d3539ebd3ee73472c80c30a578322e040fee92c326422cc0a158879f182df8e9\n  accepted_basis sha256:140ff8d4fe78a697ba34da6fe82d279838344fdb8a1346a17b416d0482e905e5\n  accepted_inputs:\n    POOL_RELEASE_CANDIDATE both sha256:c3200795a64a2e6172ee0a3a75b50522836441f3cdaf263601855ebdb7f56029\n  reason "Accepted PUBLISH basis after conformant 0\.11\.0 Immutable Candidate 1\.0 from source commit 6ad44db8aa833e5f7fbdc49adfef39419151984a and artifact sha256:fa43e222fa6a53c0a5287a1cca7700b7808179513743db0a9a5790c2192fecf4"$/mu,
  );
  assert.match(
    plan,
    /^work_event WE-03901625df271d4e3642e4673e030cd2daf4cde0a37f8bf1a1842a1c7f5f2d8b:\n  model 1\n  task POOL_RELEASE_PUBLISH\n  kind start\n  occurred_at 2026-09-07T19:14:17\+09:00\n  planned_value 3p$/mu,
  );
  assert.match(
    plan,
    /^work_event WE-0b198fc9891e331f1a1173199a206c338c6787afb365dcdf1195cb1d5157838f:\n  model 1\n  task POOL_RELEASE_PUBLISH\n  kind finish\n  occurred_at 2026-09-07T20:53:48\+09:00\n  active_time 5971\/3600h\n  effort 5971\/3600ph$/mu,
  );
  assert.match(
    plan,
    /^task_outcome OUTCOME_POOL_RELEASE_PUBLISH:\n  model 1\n  task POOL_RELEASE_PUBLISH\n  against_basis sha256:140ff8d4fe78a697ba34da6fe82d279838344fdb8a1346a17b416d0482e905e5\n  status conformant\n  reason "Accepted exact 0\.11\.0 Git, CI, GitHub prerelease, and byte-identical npm beta publication"$/mu,
  );
  assert.match(
    plan,
    /^work_event WE-d2a84b4504673e215dc69abafd35113db2863a434cf70c68ddaf490bf318011a:\n  model 1\n  task POOL_RELEASE_ACCEPTANCE\n  kind finish\n  occurred_at 2026-09-07T21:05:13\+09:00\n  active_time 541\/3600h\n  effort 541\/3600ph$/mu,
  );
  assert.match(
    plan,
    /^task_outcome OUTCOME_POOL_RELEASE_ACCEPTANCE:\n  model 1\n  task POOL_RELEASE_ACCEPTANCE\n  against_basis sha256:d83336157613f30948f60895905f2cff2df4e46c06050c07f10098b776f3a60c\n  status conformant\n  reason "Accepted durable 0\.11\.0 public identity, installed Contract 10, review corrections, and exact 0\.10\.6 rollback"$/mu,
  );

  assert.match(requirements, /^26\. \[x\] Release the accepted Planning Pool boundary as suffix-free beta$/mu);
  assert.match(requirements, /exact `0\.10\.6` rollback behavior/u);
  assert.match(requirements, /restore milestone criterion-set and receipt\n      mutation for valid Grammar 9 documents/u);
  assert.match(requirements, /bind every generic Grammar 7 through 9\n      assurance-mutation/u);
  assert.match(requirements, /Resolve Issue #37 so one complete NextResult/u);
  assert.match(adr, /2026-09-07 \(accepted `v0\.11\.0` Grammar 9 and CLI Contract 10 Planning Pool\n  Gate Design Candidate 3\.0\)/u);
  assert.match(adr, /^- Status: Accepted$/mu);
  assert.match(adr,
    /^- Accepted scope: Base decision and the amendments listed under `Amended`$/mu);
  assert.match(adr, /^### Off-main compatible-hotfix publication$/mu);
  assert.match(adr, /^### Accepted Planning Pool `0\.11\.0` target$/mu);
  assert.match(design, /^### Post-MVP Slice 8A: Planning Pool `v0\.11\.0` beta minor$/mu);
  assert.match(procedure, /- Status: Released and durably accepted as npm `beta=0\.11\.0`; npm\n  `latest=0\.10\.5` remains unchanged/u);
  assert.match(procedure, /`POOL_GRAMMAR9_ACCEPTANCE_MUTATION` restores criterion and receipt mutation/u);
  assert.match(procedure, /PUBLISH requires a later authorization naming that exact candidate/u);
  assert.match(procedure, /Exact `perttool@0\.10\.6` is the rollback pin/u);
  assert.match(procedure, /GitHub prerelease `384029996`/u);
  assert.match(procedure, /All nineteen release-readiness tasks are complete/u);
  assert.match(preparation, /- Document status: Accepted 1\.0/u);
  assert.match(preparation, /1,341 Node\.js tests/u);
  assert.match(preparation, /supported VS Code 1\.101\.0 trusted and untrusted host, replacement, and\n  uninstall gate under Xvfb/u);
  assert.match(preparation, /1,019-file isolated public-package workflow/u);
  assert.match(preparation, /complete with conformant Outcome/u);
  assert.match(preparation, /Only the separately resealed `POOL_RELEASE_CANDIDATE` then became startable/u);
  assert.match(candidate, /- Document status: Accepted 1\.0/u);
  assert.match(candidate, /complete with conformant Outcome/u);
  assert.match(candidate, /Candidate source commit: `6ad44db8aa833e5f7fbdc49adfef39419151984a`/u);
  assert.match(candidate, /Candidate source tree: `8a469730aa017f289a94865b838ff127a61eaa88`/u);
  assert.match(candidate, /files: 1,019/u);
  assert.match(candidate, /packed bytes: 3,273,360/u);
  assert.match(candidate, /unpacked bytes: 11,362,352/u);
  assert.match(candidate, /`fa43e222fa6a53c0a5287a1cca7700b7808179513743db0a9a5790c2192fecf4`/u);
  assert.match(candidate, /retained mode: `0444`/u);
  assert.match(candidate, /finished at\n`2026-09-07T18:43:45\+09:00` with 2,017 seconds/u);
  assert.match(candidate, /`sha256:95d98b2d6ef1c99da2d1831c805484e5a154f3c468c6944bd5af7486477932bd`/u);
  assert.match(candidate, /causal selected reseal for\n`POOL_RELEASE_PUBLISH`/u);
  assert.match(candidate, /`sha256:98d9810574ac77ad84bb44c0dca435288bcf4d72fef2c7425b134d377af49ed1`/u);
  assert.match(candidate, /`POOL_RELEASE_PUBLISH` became active at `2026-09-07T19:14:17\+09:00`/u);
  assert.match(candidate, /`sha256:b9801bacd32ac8a8fe949c8daa800dce317454563abd19e7b1a6313bfaff3f32`/u);
  assert.match(candidate, /npm reported `beta=0\.10\.6`, `latest=0\.10\.5`, and no `alpha` tag/u);
  assert.match(candidate, /`POOL_RELEASE_PUBLISH` remains a separate boundary/u);
  assert.match(publication, /- Document status: Accepted 1\.0/u);
  assert.match(publication, /Annotated tag object:\n  `51e35070ce0ad288d19f0ac6597653d3133b82aa`/u);
  assert.match(publication, /CI run `34113325516`, attempt 2/u);
  assert.match(publication, /`beta=0\.11\.0`, `latest=0\.10\.5`, and no\n`alpha`/u);
  assert.match(acceptance, /- Document status: Accepted 1\.0/u);
  assert.match(acceptance, /Completed plan source digest:\n  `sha256:e7cbb956bc2d1959513e4149a700d8d0f964bd37ed285e331d20d5db3652fcfe`/u);
  assert.match(acceptance, /The acceptance task finished at `2026-09-07T21:05:13\+09:00`/u);
  assert.match(acceptance, /Issues #35, #36, #37, and #38 remain open/u);
  assert.match(gate, /- Document status: Candidate 3\.0 independently reviewed, owner accepted, and\n  registered as the conformant completed Gate Design Outcome/u);
  assert.match(gateReview, /- Verdict: `PASS`/u);
  assert.match(gateReview, /- Findings: zero P0, P1, P2, or P3 findings/u);
  assert.match(gateReview, /- Owner disposition: accepted on 2026-09-07 for the exact reviewed Candidate\n  3\.0 semantics/u);
  assert.match(gateReview, /`plans\/planning-pool-release-readiness\.pert` \| `ae301909e5b2413c5a5a9b3121cddd4a94f4acfd2fd6331cb538d1740686c0cb`/u);
  assert.match(gateReview, /A later\nseparate instruction authorized the exact task finish and conformant Outcome/u);
  assert.match(gate, /\| Commands \| 56 \| 71 \|/u);
  assert.match(gate, /stable patch ID `84fe584b8a2895187bcf72df2af289103b49ca88`/u);
  assert.match(gate, /at Candidate 2\.0 evidence capture, the source\n  digest was\n  `sha256:80aea315154da1aa810a8366f21b3fa5150ed105641e23050fa372a7d80fd59d`/u);
  assert.match(gate, /separately authorized P1 replan suspended Gate Design and produced source\n  digest\n  `sha256:6c0592deaa94395325fffc817e855a1732db3d13f0bc5b36c3cb0ecb4fe7b3b5`/u);
  assert.match(gate, /selected Issue #37 frontier reseal then produced\n  digest\n  `sha256:23ef7711c89afba91733e540e0bd4a91675cbfd6672af2f4c19f4b1bdfe510b7`/u);
  assert.match(gate, /resulting pre-reseal plan digest was\n  `sha256:b44b07766020111f27a0bb0afc4825bc035bcde1dee018293071424a82fafe77`/u);
  assert.match(gate, /produced plan\n  digest\n  `sha256:ae301909e5b2413c5a5a9b3121cddd4a94f4acfd2fd6331cb538d1740686c0cb`/u);
  assert.match(gate, /The separately authorized finish at `2026-09-07T17:25:35\+09:00`/u);
  assert.match(gate, /The separately authorized conformant Outcome then produced current digest\n  `sha256:1d1862bb053912097656b1d493108652711fde26e586846688b7a8faca100c52`/u);
  assert.match(gate, /fresh complete run passed 1,341 of 1,341 tests/u);
  assert.match(gate, /supported\n  VS Code 1\.101\.0 trusted\/untrusted host gate under Xvfb/u);
  assert.match(gate, /the first\n  timeout's cause remains unknown/u);
  assert.match(gate, /`F-011-BINDING-001 P1 resolved locally`/u);
  assert.match(gate, /`F-011-NEXT-001 P1 resolved locally`/u);
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
  assert.match(bindingContract, /The accepted contract was established before implementation/u);
  assert.match(bindingContract, /source_digest = original_digest = governance\.source_digest/u);
  assert.match(bindingContract, /The previously rejected reason-only bulk candidate was not reused/u);
  assert.match(bindingContract, /does\s+not start or finish that task/u);
  assert.match(bindingAcceptance, /owner-confirmed conformant Outcome complete/u);
  assert.match(bindingAcceptance, /The owner subsequently accepted the exact semantic result/u);
  assert.match(bindingAcceptance, /plan source digest\n`sha256:b44b07766020111f27a0bb0afc4825bc035bcde1dee018293071424a82fafe77`/u);
  assert.match(bindingAcceptance, /Gate Design\nremains suspended, no task is recommended or startable/u);
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
  assert.deepEqual(next.assurance.replanRequiredTaskIds, []);
  assert.equal(next.assurance.coverage, "complete");
  assert.deepEqual(
    next.assurance.taskResults.filter(({ status }) => status !== "verified"),
    [],
  );
  assert.deepEqual(next.assurance.requiredActions, []);
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
  assert.match(gate, /A later\nseparate instruction authorized the exact finish and conformant Outcome/u);
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
  assert.match(changelog, /^## \[0\.11\.0\] - 2026-09-07$/mu);
  assert.match(readme, /npm `beta` is `0\.11\.0` with\nGrammar 9 and CLI Contract 10/u);
  assert.match(readme, /Exact `0\.10\.6` remains the compatible Grammar 8/u);
  assert.match(selfUse, /plans\/planning-pool-release-readiness\.pert/u);
  assert.match(selfUse, /read-only self-use checks passed \(46 plans/u);
});
