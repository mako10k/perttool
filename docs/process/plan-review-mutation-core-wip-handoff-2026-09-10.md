# Plan Review Mutation Core WIP Handoff

- Date: 2026-09-10
- Worktree: `/home/katsumata-m/perttool-worktrees/issue-21-plan-review`
- Branch: `codex/issue-21-plan-review`
- Starting HEAD before this checkpoint: `202df10d5aa19f177d31b69c1627ce85e58cd420`
- Remote branch before this checkpoint: absent
- State: implementation WIP; not a Plan Review lifecycle, public-contract, release,
  or Issue-status acceptance point

## 1. Completed implementation scope

This checkpoint preserves the private `PLAN_REVIEW_MUTATION_CORE`
implementation on top of the previously committed Plan Review source core.
The implementation adds:

1. closed create and resolve request normalization;
2. exact create and resolve replay handling;
3. a distinct `PlanReviewAuthorityDecision.v1` projection;
4. owner, delegate, and fresh owner-assertion authority evaluation;
5. `plan_retained` and `plan_changed` semantic-basis checks;
6. Application-owned composition with the current Contract 10 batch planner;
7. a normalized RFC 8785 batch digest and one final candidate; and
8. safe persistence through the existing `SafePersistencePort` boundary.

The affected source and acceptance inputs are:

- `src/plan-review/mutation-types.ts`
- `src/plan-review/request.ts`
- `src/plan-review/authority.ts`
- `src/plan-review/mutation.ts`
- `src/plan-review/write.ts`
- `src/application/plan-review-mutation.ts`
- `test/fixtures/plan-review-mutation-core-v1.json`
- `test/plan-review-mutation-core.test.mjs`
- `test/adapter-core-dependency.test.mjs`
- `docs/process/plan-review-mutation-core-review.think`

## 2. Verified evidence

The implementation state before this handoff passed:

- the complete repository test suite: 1,372 of 1,372 tests;
- the final focused Plan Review mutation suite: 14 of 14 tests;
- `npm run check:static`;
- `npm run check:english`, covering 1,366 text files with 3 allowlisted lines;
- `npm run check:docs`, covering 404 Markdown and 7 PERT inputs;
- `git diff --check`; and
- command-line LLMThink audit of
  `docs/process/plan-review-mutation-core-review.think`, with zero fatal,
  error, or warning findings.

The closeout decision covering this handoff, WIP commit, same-branch push, and
scope exclusions was also audited with command-line LLMThink with zero fatal,
error, or warning findings.

## 3. Deliberately unchanged boundaries

This WIP does not activate Grammar 10 or CLI Contract 11 and does not add a
public CLI command, result schema, package-root export, LSP surface, VSIX
surface, or MCP surface. It does not implement the separately planned
`PLAN_REVIEW_LIFECYCLE_HISTORY` behavior.

`plans/plan-review-request.pert` remains unchanged at digest
`sha256:c3a100e500fbe237f3e8b186f108922974e1ad24c7479b7f412ae955f4936488`.
Its declarations still report all five tasks as planned and recommend
`PLAN_REVIEW_SOURCE_CORE`; that structural state is not being rewritten to
match the implementation by this checkpoint.

No Plan Review request was created or resolved, no plan task or milestone was
mutated, and no Issue, release, publication, deployment, or other branch state
was changed.

## 4. Exact restart point

1. Run the repository-start preflight and confirm this branch, its upstream,
   the pushed WIP revision, and a clean worktree.
2. Read this handoff and
   `docs/process/plan-review-mutation-core-review.think`, then inspect the WIP
   diff from `202df10d5aa19f177d31b69c1627ce85e58cd420`.
3. Perform the next requested review or correction of the private mutation
   core. Treat the current test evidence as the checkpoint baseline, not as
   formal lifecycle acceptance.
4. Decide the Plan Review PERT and Issue status corrections separately. The
   current structural recommendation remains stale relative to the committed
   source-core implementation and this WIP mutation-core implementation.
5. Only after the applicable review and lifecycle decision, select between
   the independent `PLAN_REVIEW_LIFECYCLE_HISTORY` slice and formal mutation-
   core acceptance. Public Contract 11 activation remains downstream of both
   core branches.

Do not infer authority for a Plan Review resolution, PERT mutation, Issue
mutation, public activation, release, or publication from this WIP commit or
its remote availability.
