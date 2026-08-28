# Planning Pool Release Integration Acceptance

Document status: Accepted 1.0; task, independent review, and assurance outcome accepted  
Acceptance date: 2026-08-27  
Workstream: Planning Pool release readiness  
Task: `POOL_RELEASE_INTEGRATION_ACCEPTANCE`  
Plan: [../../plans/planning-pool-release-readiness.pert](../../plans/planning-pool-release-readiness.pert)

## 1. Candidate boundary

This acceptance composes the ten Planning Pool review corrections for Issues
#25 through #34. It does not add another Planning Pool capability. The accepted
surface remains Grammar 9, CLI Contract 10, package version `0.10.5`, 71
commands, 29 root schemas, 139 reference-identical root and Node runtime
exports, and 51 portable Core runtime exports.

The current plan-assurance projection reports all ten predecessor tasks as
verified and conformant. Their accepted bases compose the exact verified basis
of `POOL_RELEASE_INTEGRATION_ACCEPTANCE`. The integration task and complete
candidate gate are finished, its independent review is accepted, and its exact
assurance outcome is registered with separately confirmed owner authority.

## 2. Review-issue composition

| Issue | PERT task | Accepted correction |
| --- | --- | --- |
| #25 | `POOL_ADVANCE_EOF_FIX` | Terminal Advance deletion owns only its exact separator trivia and retains final-milestone evidence. |
| #28 | `POOL_POST_ADVANCE_TEST_FIX` | Post-Advance regression reads immutable pre-Advance evidence without restoring removed declarations. |
| #26 | `POOL_WINDOW_OPTION_CONTRACT` | Planning Pool commands reject inapplicable Task mutation options before document input. |
| #27 | `POOL_GRAMMAR9_GUIDE` | Active syntax and Planning Pool Guide describe the complete additive Grammar 9 surface. |
| #29 | `POOL_HUMAN_TEXT_UI` | Work, Window, observation, and reshape preflight text retain semantic JSON parity and recovery guidance. |
| #30 | `POOL_INTENT_UI` | Intent commands compile bounded audited requests and preserve preview, owner response, and token gates. |
| #31 | `POOL_REQUEST_SCHEMAS` | Three standalone closed Planning Pool request schemas are discoverable and packaged. |
| #33 | `POOL_GOAL_BOUNDARY_GUIDANCE` | Planning Pool guidance explicitly disclaims Final Goal coverage without implementing Issue #24. |
| #32 | `POOL_COMPOUND_HELP` | Every natural compound Help path resolves, and incomplete prefixes return exact child choices. |
| #34 | `POOL_ENTITY_INSPECTION` | Four read-only Event and Activity inspection commands retain project ownership and reverse Work associations. |

The detailed acceptance records under `docs/process/issue-25-*` through
`docs/process/issue-34-*` remain the evidence owners for each correction. This
record accepts their composition rather than replacing their individual
contracts or independent reviews.

## 3. Complete candidate verification

The exact implementation and test candidate passed the complete Node.js 22
repository gate with Linux `/tmp`: 1,327 of 1,327 tests, 1,297
English-baseline text files, 369 Markdown files, seven PERT examples, 45
self-use plans, the pinned 147-clone / 2,743-line duplication ratchet, the
5,135-function / 168-legacy-entry complexity ratchet, isolated LSP and MCP
packages, the packaged trusted and untrusted VS Code 1.101.0 host workflow,
temporary npm linking, and the 1,019-file isolated public package all passed.
The package dry-run retained `perttool@0.10.5` and the `beta` tag without
publishing.

After that complete gate, only the task lifecycle record in the PERT source
and this acceptance record changed. No implementation, test, adapter, build,
schema, package, or package-harness source changed. The finished PERT source
was rechecked through document validation, both schedule analyses, current
Next and plan-assurance projection, and exact outcome preview. The acceptance
record was rechecked through the English baseline, documentation gate, and
`git diff --check`; the corrected LSP test also passed its exact thirteen-case
Node.js 22 regression again.

`git diff --check`, current public identity readback, document validation,
both schedule analyses, and the complete next-authority projection passed on
the finished source. Before owner acceptance, plan assurance had the expected
single current-task gap, `outcome_missing`, and consequently marked the five
downstream tasks unavailable. The accepted outcome now verifies the task and
clears every unavailable task, mismatch, replan requirement, active-attention
requirement, and required action.

The exact finish event `EV_POOL_RELEASE_INTEGRATION_ACCEPTANCE_FINISH_001` was
written once at `2026-08-27T15:17:08+09:00`. It records `171/400h` active time
and `171/400ph` effort, changing only the plan source digest from
`sha256:141db450d3d0ee94b6e007819f077ed8b7334b1bf8f9b75d3899ffbfe87ae9b6`
to
`sha256:bae8c70467f092ab2f2c78b1507b7976bc14fd147916da9968d7996661c08948`.
The finish authority was not governance-applicable and required no owner
assertion.

The first complete run under the ambient Node.js 25 selected all 230 root test
files concurrently. The two-second stdio initialization boundary in
`test/lsp-read-core.test.mjs` expired under that load and left its disposable
LSP child alive after rejection. Node.js 22 reproduced the same loaded failure,
while the exact thirteen-test file passed in isolation in under one second.
The test now uses the same fifteen-second response boundary as the accepted
isolated LSP probe and registers unconditional child cleanup. This changes no
runtime, adapter protocol, package inventory, or public interface.

## 4. Selective subsystem retest assessment

Interface-contract-aware downstream retesting is feasible, but a source-path
filter or TypeScript declaration digest alone is insufficient. The current
root `build`, `typecheck`, `test`, and `check` scripts always include the LSP,
VSIX, and MCP workspaces. The root test call also selects all 230 test files,
including 21 adapter-, LSP-, MCP-, VSIX-, or editor-named files. CI has one
repository job for each supported Node version and contains no affected-test
selector.

The dependency boundary is already explicit enough to support a fail-closed
selector:

- LSP consumes the portable `perttool/core` interface;
- MCP consumes the Node-backed `perttool/node` interface;
- VSIX consumes the bundled LSP and its negotiated editor protocols;
- CLI and root package gates consume the root and Node facades directly.

A safe selector should therefore use three independent trigger classes:

1. a subsystem source, manifest, build, test, or package-harness change always
   runs that subsystem's own tests;
2. a changed upstream semantic interface contract runs every downstream
   consumer gate;
3. an unavailable base, unknown ownership, selector error, release candidate,
   protected-branch integration, or explicit full request runs the complete
   gate.

Changes to the selector, test ownership manifests, semantic-contract snapshot
generator, dependency manifest, lockfile, shared TypeScript configuration,
toolchain, or build infrastructure also fall back to the complete gate unless
their ownership and downstream effect are themselves closed by an accepted
contract.

The semantic interface digest must cover exported type and runtime identities,
closed result schemas, protocol and model versions, capability registries, and
consumer-visible conformance vectors. Root-owned contract tests must still run
for a root implementation change even when that digest is unchanged. Only the
downstream adapter replay may then be skipped. This preserves the distinction
between a compatible implementation change and an accepted interface change.

The preferred rollout is additive: retain `npm run check` as the complete
release and fallback gate, add subsystem-owned test manifests and contract
snapshot generation, then add a fail-closed `check:affected` path for local and
pull-request feedback. No selector, CI routing, package script, contract
snapshot, or release rule is changed by this acceptance task.

## 5. Evidence chain

- **E-INT-001:** The exact pre-start `document check`, both schedule analyses,
  `dag next`, and plan-assurance readback selected only
  `POOL_RELEASE_INTEGRATION_ACCEPTANCE`, with complete assurance and no
  required action. The finished readback retains a valid document and both
  analyses while reporting only the expected missing current-task outcome.
- **E-INT-002:** All ten predecessor tasks are verified and conformant in the
  exact active plan source.
- **E-INT-003:** Direct runtime readback fixes the current 71-command,
  29-schema, 139/139/51-export public boundary with root/Node reference
  identity.
- **E-INT-004:** The complete supported Node.js 22 repository, static,
  documentation, self-use, adapter, Help, Guide, schema, temporary-link, and
  isolated-package gate passed on the exact implementation and test candidate
  before the lifecycle-only PERT and acceptance-record changes.
- **E-INT-005:** Exact preview, one authorized finish write, and fresh readback
  bind the finished task to source digest
  `sha256:bae8c70467f092ab2f2c78b1507b7976bc14fd147916da9968d7996661c08948`.
- **E-GATE-001:** Loaded Node.js 25 and 22 runs reproduced the narrow LSP stdio
  timeout and leaked-child path; the exact test passed alone.
- **E-SELECT-001:** `package.json`, `.github/workflows/ci.yml`, the three
  workspace manifests, and adapter imports establish the unconditional current
  gate and the Core-to-LSP, Node-to-MCP, and LSP-to-VSIX dependencies.
- **E-REVIEW-001:** The independent reviewer rejected the first record, then
  accepted corrected Candidate 1.1 at SHA-256
  `51cb846d4abb6fb14c8ae416e6267daa9de5cff032af1bdf1b882e7df49773fc`
  with no remaining P0, P1, P2, or P3 finding.
- **E-INT-006:** The owner-confirmed outcome write changed the PERT source once
  from
  `sha256:bae8c70467f092ab2f2c78b1507b7976bc14fd147916da9968d7996661c08948`
  to
  `sha256:4c3cb48510bf56172c60f6831b560494f2790644c961a620758ca72df336db86`;
  fresh document, assurance, and Next readback agree.

- **C-INT-001 `high`:** The ten accepted review corrections are internally
  consistent and ready for one complete integration gate. References:
  E-INT-001 through E-INT-005.
- **C-GATE-001 `high`:** The loaded LSP failure belongs to the test harness
  timeout and cleanup path rather than the language-server implementation.
  Reference: E-GATE-001.
- **C-SELECT-001 `high`:** Fail-closed semantic-interface-driven downstream
  test selection is feasible without weakening the complete release gate.
  Reference: E-SELECT-001.

- **A-GATE-001 `implementation permitted`, executed:** align the root LSP stdio
  test with the accepted fifteen-second isolated response boundary and always
  reap its disposable child. Reference: C-GATE-001.
- **A-SELECT-001 `implementation permitted`, proposed separately:** introduce
  subsystem manifests, semantic contract snapshots, dependency-DAG selection,
  and full-gate fallback. Reference: C-SELECT-001.
- **A-SELECT-002 `implementation prohibited`, not executed:** do not skip a
  subsystem's own changed implementation tests or use path/type-only changes
  as a complete semantic-compatibility proof. Reference: C-SELECT-001.

## 6. Accepted assurance outcome

The assertion-free `OUTCOME_POOL_RELEASE_INTEGRATION_ACCEPTANCE` preview was
bound to finished source digest
`sha256:bae8c70467f092ab2f2c78b1507b7976bc14fd147916da9968d7996661c08948`,
accepted basis
`sha256:6363d1eef9d59d939c4df259616eeca62a9f367550403678b79859c4c5714013`,
and candidate digest
`sha256:4c3cb48510bf56172c60f6831b560494f2790644c961a620758ca72df336db86`.
Its status is `conformant` and its reason is `Accepted corrected Planning Pool
release surface and complete supported gate`. The user confirmed that exact
candidate, affecting only `plan_assurance`, and it was written once with actor
`codex` and the candidate-bound `user` owner assertion. Fresh readback at
source digest
`sha256:4c3cb48510bf56172c60f6831b560494f2790644c961a620758ca72df336db86`
reports the integration task as `verified` and `conformant`, with complete
assurance and no required action. It recommends but does not start
`POOL_RELEASE_GATE_DESIGN`.

## 7. Independent review

The first independent read-only review returned `REJECT` with no P0 or P1
finding and two documentation-scope P2 findings. It required an unambiguous
separation between the pre-start no-action assurance state and the finished
`outcome_missing` state, and it required the complete-gate claim to exclude
the later lifecycle-only PERT and acceptance-record changes. Candidate 1.1
applies both corrections and adds the reviewer's P3 fail-closed conditions for
selector and shared-build inputs. The same reviewer then returned `ACCEPT` for
the exact Candidate 1.1 bytes at SHA-256
`51cb846d4abb6fb14c8ae416e6267daa9de5cff032af1bdf1b882e7df49773fc`,
with no remaining P0, P1, P2, or P3 finding. The reviewer concluded that the
outcome evidence, accepted basis, authority boundary, and projected assurance
state are consistent and suitable for owner approval.

## 8. Retained boundaries

This acceptance does not authorize or perform a commit, push, Issue mutation,
release selection, version change, tag, GitHub Release, npm publication,
dist-tag movement, public VSIX publication, Planning Pool plan advance, or the
successor release-gate task. Issue #24 Goal Coverage and Goal Seal remain
separate.
