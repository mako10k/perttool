# Issue #21 Candidate 1.1 First-Owner Review Input

- Status: Proposed first-owner review input
- Date: 2026-09-10
- Candidate: `docs/requirements/plan-review-request-v1.1.md`
- Candidate revision: Candidate 1.1
- Candidate SHA-256: `197b14fd7eed8178f1abae725fe168f9bb8e3da64ccef79ba744867740a4640f`
- Source: GitHub Issue #21, Candidate 1.0 independent review, and the owner's
  `REVISE` decision
- Current authority: Grammar 9, CLI Contract 10, and perttool 0.11.1 remain
  active and unchanged

## Review scope

Review the complete Candidate 1.1. It introduces no runtime behavior and
changes only the four findings reported against Candidate 1.0.

Candidate 1.0 and its completed independent review remain unchanged historical
snapshots. Candidate 1.1 is a new lifecycle step-1 snapshot and has no inherited
review or acceptance status.

## Material differences from Candidate 1.0

1. Resolving one request clears `review_required` only when no other open
   request remains.
2. CLI Contract 10 keeps `Perttool.NextResult.v8`. CLI Contract 11 uses
   `Perttool.NextResult.v9` for every supported Grammar 1 through 10 input
   while retaining legacy meanings rather than the v8 envelope identity.
3. `plan_changed` requires a separately authorized and persisted plan change
   to exist in the bound pre-resolution source. A future intention to change
   leaves the request open.
4. Resolution exposes a distinct Plan Review authority decision and does not
   create an existing governance affected scope or alter current
   `PTGOV-*` behavior.

## Owner decision questions

1. Is clearance only after the last open request the accepted multiple-request
   rule?
2. Is one Contract 11 NextResult v9 envelope across supported Grammar 1 through
   10 inputs preferable to grammar-based v8/v9 dispatch?
3. Should `plan_changed` mean that a separately governed change is already
   persisted, rather than only that a review decided to change the plan?
4. Is a distinct Plan Review authority result, without a DAG governance
   affected scope, the accepted authority boundary?
5. Does Candidate 1.1 otherwise preserve the reviewed Candidate 1.0 scope?

## Alternatives and tradeoffs

- Version-dispatch v8 for legacy grammar and v9 for Grammar 10 would preserve
  envelope identity by input grammar, but one installed Contract 11 would have
  two active Next identities and a more complex consumer contract.
- Treating `plan_changed` as a decision to change would permit earlier
  resolution, but it could clear the advisory before the changed plan exists.
- Reusing the existing DAG governance result would reduce result types, but it
  would falsely classify a review-record resolution as a DAG plan mutation.

## Remaining contract work

Exact DSL field order and limits, command operands and options, schemas,
diagnostics, text and JSON ordering, catalog counts, and normative fixtures
remain for a subsequent contract after requirement acceptance.

## Effects not authorized

This review does not authorize specification, ADR, delivery-plan mutation,
implementation, commit, push, PR, release, publication, Issue mutation,
dist-tag changes, runtime activation, or plan advance.

## First-owner routes

The owner chooses exactly one:

- `REVISE`: return to step 1 with another candidate revision;
- `REVIEW_THEN_REVISE`: independently review this exact snapshot, then return
  to step 1;
- `REVIEW_THEN_DECIDE`: independently review this exact snapshot, then
  continue to the second owner decision; or
- `REVIEW`: independently review this exact snapshot without added owner
  questions, then continue to the second owner decision.
