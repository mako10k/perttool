# Issue #21 Plan Review Request Requirement Acceptance

- Status: Accepted
- Date: 2026-09-10
- Accepted candidate: `docs/requirements/plan-review-request-v1.2.md`
- Requirement revision: Candidate 1.2
- Accepted SHA-256: `94632d3c85cf3400a920ff56cb59064b8ca378fc5e11c3d97c9bc6c031e28c38`
- First-owner route: `REVIEW_THEN_DECIDE`
- Review input: `docs/process/issue-21-requirement-review-input-v1.2.md`
- Independent review: `docs/process/issue-21-requirement-independent-review-v1.2.md`
- Owner decision: after the completed review recommended `ACCEPT` and
  presented the Step 4 routes, the owner instructed Codex to proceed
- Decision audit: `fatal=0 error=0 warning=0`

## Accepted requirement

The owner accepted the exact unchanged Candidate 1.2 bytes. Acceptance fixes
the Issue #21 requirement boundary for one persistent, machine-readable Plan
Review Request axis under proposed Grammar 10 and CLI Contract 11.

The accepted requirement preserves current Grammar 9, CLI Contract 10,
`Perttool.NextResult.v8`, governance, assurance, milestone acceptance,
recommendation, history, and safe-write meanings until a separately accepted
atomic activation.

## Accepted decisions

- An open request derives a strong `review_required` advisory without changing
  task eligibility, ranking, scheduling, or start authority.
- Request creation does not require or grant plan-change authority.
- Resolution uses a distinct Plan Review authority decision and does not
  manufacture a current governance affected scope.
- `plan_retained` contains no Plan Review plan-basis change.
- `plan_changed` atomically composes resolution with a non-empty plan-content
  change, records unequal before and after Plan Review plan-basis digests, and
  independently satisfies every applicable existing plan-change boundary.
- Plan-content change is machine evidence; relevance to the observation and
  correctness remain resolving-actor assertions rather than machine proof.
- Open Task references cannot become historical without atomic
  `plan_changed` resolution. Resolved Task references remain valid historical
  references after ordinary governed removal.
- CLI Contract 10 retains NextResult v8. Proposed CLI Contract 11 uses
  NextResult v9 for every supported input grammar while preserving legacy
  meanings.

## Retained contract unknowns

The independent review found no requirement contradiction and retained two
medium-severity details for the subsequent contract:

- the exact short-circuit and equality checks for an idempotent
  `plan_changed` replay; and
- the canonical-advance eligibility and retention rule for a request resolved
  in the same candidate that removes its Task.

These unknowns do not authorize the contract author to add an external change
receipt, delete a required final record, weaken replay mismatch rejection, or
change the accepted lifecycle meaning.

## Effects not authorized

This acceptance does not authorize specification or ADR authoring, delivery
plan creation or mutation, implementation, commit, push, PR, merge, release,
publication, Issue mutation, dist-tag changes, runtime activation, or plan
advance. Every such effect retains its separate authority boundary.
