# Issue #21 Contract Review Input v1.0

- Status: Owner accepted
- Date: 2026-09-10
- Accepted requirement baseline: `docs/requirements/plan-review-request-v1.2.md`
- Proposed ADR: `docs/adr/0010-separate-plan-review-from-plan-authority.md`
- Candidate contract: `docs/specs/plan-review-request.md`
- Review scope: the complete Proposed ADR and complete Candidate 1.0 contract
- Implementation status: not started

## Purpose and overview

The proposed ADR separates persistent Plan Review state from recommendation,
start authority, Plan Assurance, Milestone Outcome Acceptance, and governance.
The candidate contract makes the accepted Issue #21 requirement implementable
by fixing exact Grammar 10 syntax, plan-basis semantics, commands, authority,
results, diagnostics, limits, lifecycle, replay, advance, and compatibility.

## Material differences from the accepted requirement

The requirement boundary is unchanged. Candidate 1.0 selects the contract
details that the requirement intentionally left open:

- exact declaration spelling, fields, ordering, and conditional field sets;
- a closed semantic `Perttool.PlanReviewBasis.v1` projection using RFC 8785
  canonical JSON and SHA-256;
- four command paths and their exact required operands and options;
- a separate closed Plan Review authority result;
- two new root results, one Next replacement, nested identities, command and
  schema count deltas;
- one `PTREV-*` diagnostic family and exact limits;
- deterministic idempotent replay through a stored normalized batch-request
  digest; and
- canonical-advance retention of a request resolved in the same candidate
  that removes its Task.

There is no prior accepted contract. The comparison baseline is the accepted
requirement, not an earlier specification candidate.

## Decision points

1. **Advisory separation.** Accept a distinct Plan Review axis that never
   changes recommendation or start authority by itself.
2. **Plan-basis boundary.** Accept the closed included/excluded semantic
   projection and treat digest inequality as change evidence, not correctness
   proof.
3. **Atomic plan change.** Require `plan_changed` to carry one existing batch
   request and independently satisfy every applicable guard.
4. **Replay.** Require exact stored-evidence reproduction from the originally
   reviewed source; unavailable bytes make replay unavailable.
5. **Advance retention.** Allow removal only for a request already resolved in
   the input source; retain a request resolved by the same Task-removing
   candidate.
6. **Public boundary.** Accept Grammar 10, Contract 11, 75 commands, 31 active
   root schemas, NextResult v9, and the listed Plan Review identities as one
   future atomic activation.

## Alternatives and tradeoffs

- Reusing Plan Assurance reduces surface area but changes the meaning of an
  accepted assurance mismatch and cannot represent an observation-only
  concern.
- Making the advisory a hard start block increases enforcement but lets any
  creator with no plan authority halt downstream work.
- Allowing separate resolution and plan writes simplifies command composition
  but cannot bind the resolution to one complete plan candidate.
- Accepting replay from only stored digests is cheaper but cannot establish
  that the supplied plan mutation is the same reviewed change.
- Removing a newly resolved request during the same advance yields a smaller
  residual source but erases the only in-document resolution evidence.

## Risks and unknowns

- The selected plan-basis inventory is broad and must be kept versioned when
  future planning models add fields.
- Exact replay requires access to the originally reviewed source bytes; the
  contract deliberately fails closed when they are unavailable.
- The composed Contract 11 batch envelope must reuse existing mutation kinds
  without creating an authority shortcut. Its exact JSON schema must be
  mechanically validated during implementation.
- Exact public export counts are intentionally not guessed; implementation
  acceptance must derive and freeze them from the finished public surface.
- No implementation evidence exists yet.

## Review routes

- `ACCEPT`: accept the complete Proposed ADR and Candidate 1.0 contract as the
  normative design boundary. This does not authorize implementation.
- `REVISE`: return the candidate for changes and identify the affected decision
  or section.
- `REVIEW_THEN_DECIDE`: request independent review of the unchanged complete
  candidate before the owner decision.
