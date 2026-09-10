# Issue #21 Requirement First-Owner Review Input

- Status: Proposed first-owner review input
- Date: 2026-09-10
- Candidate: `docs/requirements/plan-review-request-v1.md`
- Candidate revision: Candidate 1.0
- Candidate SHA-256: `a43466a2922d10795e0c6696e2eb1336d2e7ac0005a519ce2604c691eb94e132`
- Source: GitHub Issue #21 and the owner's 2026-09-10 instruction to address it
- Proposed route after first-owner review: `REVIEW_THEN_DECIDE`

## Review scope

Review the complete candidate. It introduces no runtime behavior. The current
Grammar 9, CLI Contract 10, and perttool 0.11.1 implementation remain the
active authority.

The candidate selects a persistent Task-bound request, explicit create and
resolve lifecycle, advisory-only Next projection, history-safe removal, and a
future Grammar 10 / CLI Contract 11 boundary. It proposes two new Plan Review
result identities and a replacement Next result, but does not activate them.

## Acceptance and compatibility questions

1. Is advisory presentation before recommendation sufficient, with no change
   to readiness, ranking, `runnable_now`, or start authority?
2. May any explicit actor create a request without goal/DAG authority?
3. Should resolution require the effective DAG owner, delegate, or a fresh
   candidate-bound DAG-owner assertion?
4. Should canonical advance block Task removal while a request is open and
   explicitly remove resolved records with history proof?
5. Are Grammar 10, CLI Contract 11, `Perttool.PlanReviewResult.v1`,
   `Perttool.PlanReviewMutationResult.v1`, and `Perttool.NextResult.v9`
   acceptable inputs to the later contract review?

## Unknowns retained for the later contract

- exact declaration field order and text limits;
- exact command operands and option names;
- diagnostic codes and exit mapping;
- JSON field layout and active schema/export counts; and
- whether any later adapter should expose the read-only projection.

These unknowns do not permit implementation before the contract fixes them.

## Independent-review request

If the owner chooses `REVIEW` or `REVIEW_THEN_DECIDE`, independently review the
unchanged candidate digest for:

- contradiction with existing governance, assurance, acceptance,
  recommendation, advance-history, and Planning Pool authority;
- a path that lets a requester create or clear unrelated authority;
- loss or orphaning of open and resolved evidence;
- silent changes to current Grammar 1 through 9 behavior;
- non-determinism from time, IDs, locators, ordering, or retries; and
- optional future features accidentally promoted into v1 acceptance.

Classify each finding as contradiction, evidence gap or unknown, optional or
future, or out of scope. Do not edit the candidate during independent review.

## Effects not authorized by this review

This first-owner review does not authorize a specification, ADR, plan,
implementation, commit, push, PR, release, publication, Issue mutation,
dist-tag change, or runtime activation.
