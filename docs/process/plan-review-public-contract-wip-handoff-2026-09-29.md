# Plan Review public contract WIP handoff

Date: 2026-09-29
State: WIP; `PLAN_REVIEW_PUBLIC_CONTRACT` is not complete.

Active checkout: `/home/katsumata-m/perttool-worktrees/issue-21-plan-review`,
branch `codex/issue-21-plan-review`. The separate main checkout contains
unrelated dirty work and was not modified. The branch started this slice at
`ed15fe64ab77c95fc0ff74b2ff82e39e48924b91`. Before this WIP commit,
`origin/codex/issue-21-plan-review` was
`168f5ba71ae0f0f3775774a77cee80d4935461d9`, two commits behind the
local branch, and `origin/main` was
`d51fcbba85b01ed60cc3edc047eecccb677a5427`. A protected-route fetch
confirmed those revisions on 2026-09-29. The final pushed revision must be
read back separately.

## Review boundary

The subject is `PLAN_REVIEW_PUBLIC_CONTRACT` on the Issue #21 branch. The
governing input is `docs/specs/plan-review-request.md`, especially sections
5-7 and 10-12. This task activates Grammar 10 and CLI Contract 11 as one
public boundary. `PLAN_REVIEW_ACCEPTANCE` remains the successor for the
complete closed-case, installed-package, race, and cross-surface acceptance
trace. Release selection, publication, remote writes, Issue mutation, editor
or MCP mutation, and canonical plan advance are separate decisions.

## Public implementation

- The active registry has 75 commands. Four `plan` paths create, list, show,
  and resolve Plan Review Requests. Contract 11 Help and Guide expose their
  arguments and the advisory review procedure.
- Valid Grammar 9 documents migrate to Grammar 10 with a version-token edit.
  The active check, analysis, Next, format, mutation, and lifecycle paths
  preserve the complete Grammar 10 source and its request declarations.
- Every supported Grammar 1 through 10 `dag next` result has identity
  `Perttool.NextResult.v9`. Grammar 1 through 9 projects a clear Plan Review
  state. Grammar 10 projects open request IDs and a review action while
  retaining the underlying recommendation and start-authority results.
- The active catalog has 31 root schemas, including the two Plan Review
  results and the v9 Next replacement. Nested request, basis, projection,
  and authority definitions are closed. The root and Node facades expose
  155 runtime values; Core exposes 51. The private read-only MCP adapter
  projects the active Next identity and Plan Review state without adding a
  mutation method.
- Canonical Grammar 10 advance rejects an unresolved request whose Task
  would be removed. It removes input-pre-resolved requests with removed
  Tasks, reports their IDs, and composes the exact HEAD and stage-0 history
  proof before an in-place write.

## Review findings and limits

- `INSIDE`, fixed: the first library Next wrapper preserved v8 identity, so
  MCP could not project the active result. The final wrapper returns v9 and
  includes Plan Review state; the MCP schema and projection consume it.
- `INSIDE`, fixed: the override validator accepted only v8 source decisions.
  It now accepts a matching complete v8 or v9 decision without relaxing its
  authority and trace checks.
- `INSIDE`, fixed: the Contract 11 Guide index inherited a v8 `next` summary.
  The active index and detail now identify v9.
- `INSIDE`, open: the CLI now bounds raw composed batch JSON input before
  decoding and parsing. The library normalizer still checks its canonical
  UTF-8 byte limit after canonicalization; direct library input can allocate
  that intermediate representation before rejection. Reconcile the accepted
  pre-allocation limit and add a direct-library regression before closing this
  task.
- `OUTSIDE`: the complete eighteen-case contract trace, output-race and
  installed-package evidence, and owner acceptance remain in
  `PLAN_REVIEW_ACCEPTANCE`.

## Verification

The public CLI tests cover migration, advisory Next, create, list, show,
resolve, JSON Schema validation, legacy-Grammar rejection, canonical advance
blocking and cleanup, Git history proof, and preview/write byte identity.
The complete pre-fix `npm test` run passed 1,390/1,390. A bounded
post-fix `node --test --test-concurrency=4 --test-reporter=dot test/*.test.mjs`
run passed 1,393/1,393. Focused public/schema/override tests passed 18/18;
an oversized
8,388,609-byte CLI batch input returned `PTREV-104`, exit 1, with no write.
`check:static`, `check:english`, `check:docs`, read-only self-use on 47 plans,
isolated LSP and MCP package checks, the supported VS Code 1.101.0 host gate,
temporary link, and the isolated public package check passed. The accepted
direct-library byte-limit rule remains open before marking the task complete.

The implementation makes the capability locally usable through source and
CLI, but no release or installed beneficiary access has occurred. Realized
external value is zero. The next action is to close the direct-library batch
limit gap, rerun the complete gate, and then review the exact
`PLAN_REVIEW_PUBLIC_CONTRACT` exit condition. Keep its PERT status planned
until that evidence exists; then proceed to `PLAN_REVIEW_ACCEPTANCE` under
its own task boundary.
