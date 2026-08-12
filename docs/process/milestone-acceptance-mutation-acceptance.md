# Milestone Acceptance Mutation Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-12
- Plan: [`plans/milestone-acceptance.pert`](../../plans/milestone-acceptance.pert)
- Plan task: `MILESTONE_ACCEPTANCE_MUTATION`
- Runtime status: internal mutation composition only
- Public activation: not implemented

## 1. Decision

Accept the internal mutation composition in
`src/milestone-acceptance/mutation.ts`. It provides preview-first whole-set
replacement, verify, fail, unavailable, revoke, waiver, show, and guarded
in-place persistence without activating Grammar 7 or CLI Contract 8 publicly.

## 2. Candidate and lifecycle semantics

Replacement computes exact criterion and set commitments, removes every
current set for the milestone and every receipt owned by those sets, and adds
one complete replacement. No receipt or acceptance state continues implicitly.

Receipt candidates bind the exact set and criterion commitments. Verification
also binds its matching evidence kind, non-empty reference, revision identity,
caller-asserted verifier, and normalized strict UTC `Z` time. Fail and
unavailable are explicit terminal facts. Revoke names one earlier terminal
receipt, and waiver is limited to a required criterion with a non-empty reason.
Exact receipt replay is unchanged and idempotent; conflicting reuse of the same
global receipt ID fails closed. Show and every successful candidate use the
accepted pure evaluator rather than deriving a parallel state model.

## 3. Governance and persistence

Every changed candidate is classified as the existing `dag` scope against the
pre-change source digest and effective owner/delegates. Preview returns the
candidate without owner confirmation. Persistent intent requires an actor and
either direct owner/delegate authority or the existing candidate-bound owner
assertion. Actor, verifier, and owner assertion remain distinct caller claims;
no authentication, clock, or external verification service was added.

Approved persistence reuses the existing validated safe-write implementation:
expected and initial digests, regular-file and symlink checks, source-race
recheck, exclusive temporary replacement, candidate revalidation, and
post-write digest/readback validation remain in force.

## 4. Cases and verification

[`milestone-acceptance-mutation-v1.json`](../../test/fixtures/milestone-acceptance-mutation-v1.json)
fixes fourteen dependency-ordered cases for source preflight, whole-set
replacement, governance, preview and persistence, every receipt action, replay
and identity conflict, safe writes, shared evaluation, and the internal-only
boundary.

Acceptance requires:

```sh
npm run build
node --test test/milestone-acceptance-mutation.test.mjs
npm run check
git diff --check
```

The final gate passed 1,006 tests, the English baseline over 816 text files,
documentation checks over 230 Markdown files and seven PERT examples,
read-only self-use over 36 plans, isolated LSP and MCP package acceptance, the
VSIX shell/DAG gate under VS Code 1.101.0, temporary-link acceptance, and the
695-file isolated public-package workflow. `git diff --check` also passed.

Acceptance-aware advance, public commands/results/schemas, adapter and history
integration, plan advance, Git commit or remote write, release, publication,
and Issue mutation remain outside this task.
