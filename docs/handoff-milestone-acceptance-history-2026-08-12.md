# Milestone Acceptance History WIP Handoff (2026-08-12)

## Current boundary

Work stopped at the user's time limit after the planned milestone-history
slice and Issue #11 correction were implemented, passed their pre-advance
gates, were committed, and the completed plan tasks were advanced. A later
real repository readback exposed the blocking defect recorded below, so the
historical migration boundary is not finally accepted. Do not continue
release preparation, publication, dist-tag changes, GitHub Issue mutation, or
unrelated VSIX work without separate authorization.

The working branch is `wip/declaration-identity-release-20260806`. The last
implementation/advance commit before this handoff is
`2e532daf885b572a67666aefec695a73db378723`.

## Completed work

- `6e0bd91915411dd8becb3a85037fcafbbea81ef9` implements milestone acceptance
  history and the Issue #11 terminal-declaration deletion correction.
- `48a0346556a301433d1f416e35257b1dc3a57cb3` migrates
  `plans/milestone-acceptance.pert` to Grammar 7 and records the seven required
  criterion/evidence receipts. The pre-migration source is therefore durably
  available in Git.
- `2e532daf885b572a67666aefec695a73db378723` advances all seven accepted tasks.
  The advance changed source digest
  `sha256:457962f8eb362e2766934c75cb9f76b0480f806cbce791ee3cf09e93533e6b1f`
  to
  `sha256:140573b3b09ef440d921bf10b9f33694b6f3a8f246c482d16d898004aa20a9c6`.
  Its acceptance guard reported eight affected tasks, one grandfathered task,
  seven accepted tasks, and zero blockers. Its history guard accepted exact
  `HEAD` and stage-0 evidence without force.
- The residual plan contains two tasks and 10p. Complete NextResult v6
  recommends only `MILESTONE_ACCEPTANCE_ADAPTERS`. The remaining `PTMAC-102`
  warnings concern the deliberately undeclared future adapter, integrated, and
  final milestone criteria.
- Issue #11 is recorded as a required input to the same next release as
  `MILESTONE-ACCEPT-001`. No release version or release plan was selected, and
  no publication or Issue mutation was performed.

## Verified gates

Before advance, the complete Node.js 22 repository gate passed:

- 1,031 tests;
- English-baseline validation over 835 files with three allowlisted lines;
- documentation validation over 234 Markdown files and seven PERT examples;
- self-use validation over 37 plans;
- isolated LSP, MCP, VSIX, temporary-link, and public-package workflows;
- VS Code 1.101.0 compatibility; and
- a 709-file isolated public package plus `git diff --check`.

The Issue #11 coverage includes twelve pure cases and real CLI preview,
separate-output, and in-place byte-identity checks. The milestone-history
coverage includes twelve model cases and the public result/schema projection.

## Blocking historical readback defect

The real post-advance command below returns a complete top-level historical
graph and the correct canonical acceptance-advance proof, but its nested
`milestone_acceptance_history` projection is incomplete:

```sh
node dist/cli.js dag history plans/milestone-acceptance.pert \
  --base 6e0bd91915411dd8becb3a85037fcafbbea81ef9 \
  --rev 2e532daf885b572a67666aefec695a73db378723 \
  --view timeline --format=json
```

Observed causes are `migration_provenance_mismatch` at commit `48a0346` for
`GRAMMAR_7_BASELINE`, followed by `migration_missing` at commit `2e532da`.
This is not resolved and the milestone-history acceptance claim must not be
treated as complete across a real migration boundary until it is fixed and
the complete gate is repeated.

The directly verified cause is an incompatible repository-identity contract:

- `runDocumentMigration` records
  `captureAdvanceHistoryBaseline.repositorySnapshotId` as
  `CommittedMigrationProofV1.repositoryId`;
- `src/history/git-probe.ts` constructs that value as
  `git:<object-format>:<HEAD>:index:<stage-0-blob>`; but
- historical Git evidence identifies the repository from the real path of the
  common Git directory as `git-repository:sha256:<digest>`.

Exact equality therefore cannot succeed. The subsequent `migration_missing`
appears downstream of the failed baseline establishment and must be retested
after the identity mismatch is corrected.

## Required restart work

1. Reconcile migration capture and historical evidence on one stable,
   linked-worktree-safe repository identity. Do not reinterpret the current
   `HEAD`/index snapshot string as a stable repository identity merely to make
   the comparison pass.
2. Decide how an already committed migration with the incompatible proof is
   represented without silently weakening provenance. Rewriting published or
   shared branch history is destructive and is not authorized by this handoff.
3. Add a real repository test covering migration, commit, advance, commit, and
   `dag history`. Existing synthetic model cases did not expose this cross-probe
   identity mismatch.
4. Repeat the focused historical readback, the complete repository gate, and
   an independent consistency review before claiming the slice accepted.
5. Only after that correction is accepted, resume the plan from
   `MILESTONE_ACCEPTANCE_ADAPTERS`. Release selection remains a separate
   decision, and its input set must include both `MILESTONE-ACCEPT-001` and
   Issue #11.

## Preserved unrelated working-tree changes

The following pre-existing VSIX/presentation changes are intentionally left
unstaged and are not part of this handoff commit:

- `adapters/vscode/README.md`
- `adapters/vscode/src/bindings.ts`
- `adapters/vscode/src/webview.ts`
- `docs/specs/dag-compact-presentation.md`
- `test/dag-presentation-focus.test.mjs`
- `test/fixtures/dag-compact-presentation-cases-v1.json`

Do not discard, amend, or attribute those files to the milestone acceptance
work without separately reviewing their ownership and intent.
