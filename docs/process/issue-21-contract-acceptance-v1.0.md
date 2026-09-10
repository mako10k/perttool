# Issue #21 Contract Acceptance v1.0

- Status: Accepted
- Date: 2026-09-10
- Decision owner: user
- Owner decision: `ACCEPT`
- Review input: `docs/process/issue-21-contract-review-input-v1.0.md`
- Accepted ADR: `docs/adr/0010-separate-plan-review-from-plan-authority.md`
- Normative contract: `docs/specs/plan-review-request.md`
- Decision audit: `fatal=0 error=0 warning=0`

## Accepted review snapshot

The owner accepted the complete review scope presented as ADR 0010 and Plan
Review Request Contract Candidate 1.0.

The exact pre-acceptance review snapshots were:

- ADR 0010 SHA-256:
  `0bf7dcdd63dfaaff2d57842c22bfcdec23f4ba064520495dc615e449c5cca40f`;
- Contract Candidate 1.0 SHA-256:
  `68651bbcbeb036edbdee753c2068904ed9f98d980038edfb7fa09c29f9b9a4b4`;
  and
- Review input SHA-256:
  `4cd70307c10f0ef07d79543dd6350e04703709e7835334f2b267734ca7c80056`.

## Status-only acceptance projection

Acceptance changed only review-state text:

- ADR 0010 moved from `Proposed` to `Accepted` and records the owner decision;
- the contract moved from `Candidate 1.0` to `Normative 1.0` and records the
  owner decision; and
- the review input moved from `Owner review requested` to `Owner accepted`.

No architectural, source-model, command, result, authority, lifecycle,
diagnostic, limit, compatibility, acceptance-case, or out-of-scope meaning was
changed after review.

The final accepted files read back as:

- ADR 0010 SHA-256:
  `e170481783848f53959c93e7a46bee77854e1b35f444ba86378a2edf974f63ae`;
- Contract Normative 1.0 SHA-256:
  `7791a190800b388f51a33567c2e35378bddde04accd9b7413c1be6bfe556a770`;
  and
- accepted review input SHA-256:
  `4fb5a7d0c3d08917bde62e0d912b846b6c15d7780c29bedda59265a67e6e6e07`.

## Accepted decisions

- Plan Review is a persistent advisory axis independent from recommendation,
  start authority, Plan Assurance, Milestone Outcome Acceptance, and
  governance.
- `plan_retained` has no Plan Review plan-basis change.
- `plan_changed` atomically composes one non-empty plan mutation and separately
  passes every applicable authority and safety guard.
- Digest inequality proves plan-content change, not relevance or correctness.
- A normalized batch-request digest closes idempotent replay without external
  history retrieval.
- Canonical advance may remove only a request already resolved in the input;
  it retains a request resolved by the same Task-removing candidate.
- Grammar 10, CLI Contract 11, the four commands, Plan Review identities,
  diagnostics, Help, Guide, migration, and NextResult v9 form one future
  atomic activation.

## Effects not authorized

This acceptance does not authorize delivery-plan mutation, implementation,
commit, push, PR, merge, release, publication, Issue mutation, dist-tag change,
runtime activation, or canonical plan advance. Those remain separate action
boundaries.
