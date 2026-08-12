# Milestone Acceptance Advance Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-12
- Plan: [`plans/milestone-acceptance.pert`](../../plans/milestone-acceptance.pert)
- Plan task: `MILESTONE_ACCEPTANCE_ADVANCE`
- Runtime status: internal advance composition only
- Public activation: not implemented

## 1. Decision

Accept the internal acceptance-aware advance composition in
`src/milestone-acceptance/advance.ts`. It preserves the accepted canonical
advance algorithm while placing one pure milestone-acceptance guard before
plan assurance, governance, history safety, race checks, and persistence.

## 2. Provisional and affected plan

Grammar 7 source validation precedes planning. The ordinary canonical planner
then produces one complete provisional candidate, digest, diff, edit set, and
advance summary without Git inspection. Criterion sets and receipts owned by
milestones removed by that candidate are included in the same contraction.

The affected set contains exactly closure-derived milestones that the plan
would remove or make explicitly reached. A migration-bound grandfathered
milestone remains a separate accepted exception. Every other affected
milestone must have the shared evaluator state `accepted`.

## 3. Blocking and promotion

One undeclared, pending, failed, or unavailable affected milestone blocks the
entire operation. The result retains the explanatory provisional candidate,
diff, edits, affected milestones, acceptance states, and ordered required
criterion blockers, but has no canonical or persistable candidate. No partial
advance or general acceptance force exists, and later Git history inspection
is not invoked for this result.

When the guard passes, canonical composition is invoked and must return the
same candidate bytes and digest. A different candidate fails closed. Existing
plan-assurance, DAG governance, warning, history-safety, expected-digest,
source-race, symlink, atomic-write, and post-write phases therefore remain
later independent controls in their established order. The existing
`--force-history-loss` can affect only its later history guard.

## 4. Cases and verification

[`milestone-acceptance-advance-v1.json`](../../test/fixtures/milestone-acceptance-advance-v1.json)
fixes twelve dependency-ordered cases for migration, provisional planning,
affected identities, grandfathering, all blocking states, all-or-nothing
behavior, accepted and waived passage, byte-identical promotion, guard order,
history-force isolation, owned-record contraction, and inactive public
surfaces.

Acceptance requires:

```sh
npm run build
node --test test/milestone-acceptance-advance.test.mjs
npm run check
git diff --check
```

The final gate passed 1,014 tests, the English baseline over 820 text files,
documentation checks over 231 Markdown files and seven PERT examples,
read-only self-use over 36 plans, isolated LSP and MCP package acceptance, the
VSIX shell/DAG gate under VS Code 1.101.0, temporary-link acceptance, and the
699-file isolated public-package workflow. `git diff --check` also passed.

Public Contract 8 activation, history reconstruction, adapter projection, plan
advance, Git commit or remote write, release, publication, and Issue mutation
remain outside this task.
