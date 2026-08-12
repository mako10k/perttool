# Milestone Acceptance History Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-12
- Plan: [`plans/milestone-acceptance.pert`](../../plans/milestone-acceptance.pert)
- Plan task: `MILESTONE_ACCEPTANCE_HISTORY`
- Runtime status: Contract 8 historical projection active

## 1. Decision

Accept the bounded first-parent milestone-acceptance history in
`src/history/milestone-acceptance-history.ts` and its shared integration with
the historical linear Core and `dag history`. It reconstructs exact
checkpoint semantics and canonical advance evidence without treating Git
history as current acceptance or write authority.

## 2. Checkpoints and provenance

`Perttool.HistoricalMilestoneAcceptanceModel.v1` reports Contract 7 and older
checkpoints as `not_applicable`. Each valid Grammar 7 checkpoint reports its
current migration, criterion-set, and receipt records with immutable source
ranges and the same evaluator result consumed by current Contract 8 analysis.
Deleted revisions and receipts remain visible only at the commits that contain
them.

The first Grammar 7 migration record must match one inspected pre-migration
checkpoint by opaque repository identity, relative path, SHA-1 or SHA-256
object format, exact `HEAD`, blob, and raw source digest. A missing lower
boundary, mismatched proof, contract regression, invalid or unsupported
source, or hard limit is explicit and cannot create grandfather or acceptance
authority.

The migration baseline may disappear from current source only on an exact
canonical advance that records its removal. Subsequent checkpoints retain the
baseline through Git lineage, matching the accepted decision that post-
advance persistence in Git is sufficient; an arbitrary deletion remains
incomplete.

## 3. Canonical advance and public projection

A historical canonical-advance proof is emitted only when the compatible
acceptance-aware planner reproduces the next checkpoint byte-for-byte and its
acceptance guard passes. The proof retains affected, grandfathered, accepted,
and removed record identities. A blocked explanatory candidate or an edited
lookalike is not authority.

`Perttool.HistoricalGraphResult.v1` now requires the closed
`milestone_acceptance_history` member. JSON preserves the shared model and
text adds `ACCEPTANCE_CHECKPOINT` and `ACCEPTANCE_ADVANCE` lines. The command
remains read-only, bounded, and first-parent-only. Existing snapshot, lineage,
timeline, analysis, source binding, LSP, VSIX, and MCP meanings remain
unchanged.

## 4. Cases and verification

[`milestone-acceptance-history-v1.json`](../../test/fixtures/milestone-acceptance-history-v1.json)
fixes twelve dependency-ordered cases for older contracts, exact migration
provenance, checkpoint evaluation, revision epochs, canonical and blocked
advance, missing baselines, contract regression, hard limits, SHA-1/SHA-256,
and public read-only projection.

Acceptance requires:

```sh
npm run build
node --test test/milestone-acceptance-history.test.mjs \
  test/historical-linear-core.test.mjs \
  test/historical-cli.test.mjs \
  test/historical-dag-acceptance.test.mjs \
  test/json-schema.test.mjs
npm run check
git diff --check
```

The focused history, CLI, schema, and existing historical-DAG regression gate
passed. The complete repository gate then passed 1,031 tests, the English
baseline over 835 text files with three allowlisted lines, documentation checks
over 234 Markdown files and seven PERT examples, read-only self-use over 37
plans, isolated LSP and MCP acceptance, the VSIX shell/DAG gate under VS Code
1.101.0, temporary linking, and the 709-file isolated public-package workflow.
`git diff --check` also passed.

## 5. Boundary

This acceptance completes only `MILESTONE_ACCEPTANCE_HISTORY`. Read-only
adapter projection, final milestone-acceptance integration, release version
selection, publication, remote writes, Issue mutation, and unrelated work
remain separate. The user separately requested canonical advance of this plan
after the required committed migration and criterion evidence are present.
