# Milestone Acceptance Evaluator Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-12
- Plan: [`plans/milestone-acceptance.pert`](../../plans/milestone-acceptance.pert)
- Plan task: `MILESTONE_ACCEPTANCE_CORE`
- Milestone-acceptance model: 1
- Runtime status: internal pure evaluator only
- Public activation: not implemented

## 1. Decision

Accept the pure milestone-acceptance evaluator in
`src/milestone-acceptance/evaluate.ts`. It consumes only an accepted source
projection, document-ordered milestone IDs, and the separately computed
closure-reached set. It performs no parsing, Git access, file write, clock
read, authentication, network request, task-plan assurance change, mutation,
advance, or adapter projection.

## 2. Evaluation semantics

Each milestone projects closure and acceptance independently. An absent set is
`not_declared`; a migration grandfather flag remains separate and never
invents `accepted`. Each criterion exposes requiredness, evidence kind,
commitment, effective state, exact effective receipt, normalized caller-
asserted provenance, waiver reason, and explicitly revoked receipt IDs.

The evaluator enforces one unrevoked terminal receipt per criterion. A revoke
must name one earlier terminal receipt for the same criterion and may name it
only once. It cannot revoke another revoke. Replacing a terminal fact therefore
requires an explicit prior revoke; declaration or timestamp order never
silently selects a winner. Only required criteria may be waived.

Required aggregation is deterministic:

1. any `failed` criterion makes the milestone `failed`;
2. otherwise any `unavailable` criterion makes it `unavailable`;
3. all `satisfied` or `waived` criteria make it `accepted`; and
4. otherwise it is `pending`.

Optional states remain visible but do not affect aggregation or the blocking
list. Blocking required IDs retain criterion declaration order.

## 3. Time and authority boundary

The accepted source layer validates real calendar components in strict UTC
`Z` form and canonicalizes only redundant fractional-second trailing zeros.
The evaluator returns that asserted value without reading a clock or treating
it as authentication or ordering authority. Verifier, actor, and DAG-owner
confirmation remain distinct meanings. Owner authorization of waiver writes
belongs to the later mutation task.

Milestone acceptance remains excluded from task-plan assurance hashes, seals,
and downstream start authority in model 1. This evaluator changes neither
readiness nor recommendation.

## 4. Cases and verification

[`milestone-acceptance-core-v1.json`](../../test/fixtures/milestone-acceptance-core-v1.json)
fixes fourteen dependency-ordered cases covering separate axes, undeclared and
grandfathered milestones, every criterion state, aggregation precedence,
optional nonblocking behavior, explicit revoke, replacement conflict,
malformed revocation, optional waiver rejection, deterministic output, and the
internal-only boundary.

Acceptance requires:

```sh
npm run build
node --test test/milestone-acceptance-core.test.mjs
npm run check
git diff --check
```

The final repository gate passed 998 tests, the English baseline over 812 text
files, documentation checks over 229 Markdown files and seven PERT examples,
read-only self-use over 36 plans, isolated LSP and MCP package acceptance, the
VSIX shell/DAG gate under VS Code 1.101.0, temporary-link acceptance, and the
691-file isolated public-package workflow. `git diff --check` also passed.

The package gate exposed and corrected one pre-existing acceptance-harness
error: installed Grammar 2/3 compatibility plans legitimately emit the
non-blocking `PTSEM-114` unit-migration warning, so package validation now
rejects semantic errors rather than rejecting every diagnostic. The runtime,
warning, public counts, and compatibility meaning are unchanged.

No criterion or receipt mutation, DAG-owner persistence, acceptance-aware
advance, public Contract 8 surface, history integration, adapter work, plan
advance, Git commit or remote write, release, publication, or Issue mutation
is authorized here.
