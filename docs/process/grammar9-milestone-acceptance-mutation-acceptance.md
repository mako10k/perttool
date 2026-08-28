# Grammar 9 Milestone-Acceptance Mutation Technical Acceptance

- Date: 2026-08-28
- Task: `POOL_GRAMMAR9_ACCEPTANCE_MUTATION`
- Status: Candidate 1.3 corrective implementation and complete local gate
  passed; independent re-review and PERT assurance outcome pending
- Source line: `codex/planning-pool-0.11-wip`
- Release effect: none

## 1. Candidate 1.3 technical boundary

The Contract 10 CLI applies every milestone criterion-set and acceptance-
receipt mutation to valid Grammar 9 documents. It projects the source through
the Planning Pool layer and the existing temporal layer, invokes the accepted
milestone-acceptance planner once, and lifts its exact normalized deletion and
append edits back through both layers. An edit intersecting any source line
changed by lowering fails closed. The final candidate retains Work, Event, Activity,
Window, work-order, observation, work-event, temporal, DAG, governance, and
acceptance declarations.

The outer Grammar 9 source digest is the mutation and governance binding.
Preview remains non-writing, in-place persistence remains expected-digest and
validated-candidate guarded, and stale expected digests return the advertised
exit 5 rather than an internal-error exit. JSON uses the active CLI Contract
10 envelope. Grammar 7 and 8 behavior and result schema identity remain
unchanged. A governance-denied persistent request retains its complete outer
candidate, exact edits, denial diagnostic, and `written=false` independently;
it never exposes a lowered Grammar 7 candidate.

## 2. Causal analysis

- Root cause: Contract 10 introduced a new Planning Pool grammar layer, but
  `runMilestoneAcceptance` composed candidates only through the prior Contract
  9 temporal layer. A valid Grammar 9 document therefore reached a planner
  whose accepted source boundary ended before Planning Pool declarations.
- Contributing cause: the route retained hard-coded Contract 8 result and
  usage text and did not catch safe-write conflicts locally, leaving its outer
  contract projection inconsistent with the active registry.
- Escape cause: Contract 10 tests exercised Planning Pool mutation and older
  milestone-acceptance tests exercised Grammar 7 and 8, but no cross-case
  combined Grammar 9 with criterion/receipt mutation and installed-package
  persistence guards.
- Corrective action: compose and validate the candidate through both extension
  layers, rebind governance to the outer source digest, project Contract 10,
  and map safe-write conflicts through the shared write-failure boundary.
- Recurrence prevention: add a Grammar 9 CLI matrix for replacement, all five
  receipt actions, no-Pool Grammar 9, delegated governance, preview, denial,
  stale digest, safe write, and declaration preservation, plus an isolated
  installed-package replay.

The first correction candidate introduced a second defect:

- Root cause: Candidate 1.1 inferred one continuous changed range from the
  longest common prefix and suffix, although criterion replacement can delete
  an earlier record and append a later record as separate edits.
- Contributing cause: masked Planning Pool declarations inside that inferred
  range were indistinguishable from mutation-owned bytes at reintegration.
- Escape cause: initial tests placed acceptance records only after Planning
  Pool declarations, and the malformed reintegration remained syntactically
  valid.
- Corrective action: make the milestone-acceptance planner return normalized
  exact edits, apply only those edits to outer documents, and reject edits
  intersecting any line changed by lowering.
- Recurrence prevention: exercise criterion sets and receipts before, between,
  and after Pool declarations, including authorized write and installed-
  package preservation.

The second correction candidate retained a third defect:

- Root cause: Candidate 1.2 used `planned.ok` to distinguish candidate presence,
  conflating construction failure with a valid governance-denied candidate.
- Contributing cause: rebinding the outer governance digest made the lowered
  candidate look partially consistent even though its edits and bytes did not
  match the outer source.
- Escape cause: the wrong-actor test exercised preview but not the persistent
  denial path that emits `PTGOV-101` with a retained candidate.
- Corrective action: lift whenever `updatedText` exists, while preserving
  `ok=false`, the denial diagnostic, and no-write state independently.
- Recurrence prevention: reconstruct the complete denial candidate from its
  edits in CLI and installed-package tests, compare every Planning Pool block,
  and prove the source file remains byte-identical.

## 3. Evidence

- `test/contract10-milestone-acceptance-mutation.test.mjs` covers every receipt
  action, no-Pool input, expected-digest persistence, and acceptance records
  before, between, and after Planning Pool declarations.
- `test/fixtures/grammar9-acceptance-before-pool.pert` is the reordered
  installed-package input; `scripts/check-package.sh` requires exact two-edit
  replacement, owned receipt removal, all seven Planning Pool declaration
  blocks to remain byte-identical, and edits to reconstruct the candidate. It
  separately requires a denied persistent request to retain those properties
  while leaving the file unchanged.
- `TMPDIR=/tmp TEMP=/tmp TMP=/tmp npm run check` passed the exact Candidate 1.3
  worktree: static type, duplication, and complexity gates; 1,336 tests;
  English baseline over 1,306 text files with 3 allowlisted lines; 373 Markdown
  and 7 PERT documentation inputs; read-only self-use over 46 plans; isolated
  LSP and MCP packages; the VSIX shell, DAG, and supported VS Code 1.101.0 host;
  temporary npm linking; and the 1,019-file isolated public-package workflow.
  The installed-package replay includes exact edit reconstruction, byte-
  identical Planning Pool blocks, receipt removal, governance denial, and
  no-write proof.
- A fresh independent exact-byte review remains required before the PERT
  outcome may be proposed for owner confirmation.

## 4. Exclusions

This correction does not select or prepare a package version, retain a release
tarball, push a branch, create a tag or GitHub Release, publish npm, move a
distribution tag, close an Issue, accept the `0.11.0` release gate, register a
PERT assurance outcome, or advance a plan.
