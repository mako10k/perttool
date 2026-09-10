# Issue #21 Candidate 1.2 First-Owner Review Input

- Status: Proposed first-owner review input
- Date: 2026-09-10
- Candidate: `docs/requirements/plan-review-request-v1.2.md`
- Candidate revision: Candidate 1.2
- Candidate SHA-256: `94632d3c85cf3400a920ff56cb59064b8ca378fc5e11c3d97c9bc6c031e28c38`
- Source: GitHub Issue #21, Candidate 1.1 independent review, and the owner's
  `REVISE` decision
- Current authority: Grammar 9, CLI Contract 10, and perttool 0.11.1 remain
  active and unchanged

## Review scope

Review the complete Candidate 1.2. It introduces no runtime behavior and
changes only IR-21-101 through IR-21-103 from the completed Candidate 1.1
independent review.

Candidate 1.1 and its completed independent review remain unchanged historical
snapshots. Candidate 1.2 is a new lifecycle Step 1 snapshot and has no
inherited review or acceptance status.

## Material differences from Candidate 1.1

1. `plan_changed` now requires the same complete final candidate to compose
   the request resolution and a non-empty plan-content change.
2. The resolution record stores unequal before and after Plan Review
   plan-basis digests. The basis excludes Plan Review records and other
   non-planning evidence to avoid self-reference and false change evidence.
3. Plan Review resolution authority and every applicable existing
   plan-mutation decision are evaluated independently and must all succeed
   before one atomic write.
4. Removing, remove-and-add renaming, or advancing away a Task with an open
   request requires atomic `plan_changed` resolution of every affected
   request.
5. A resolved request retains a valid historical Task reference after a later
   ordinary governed Task removal and remains byte-for-byte unless an
   explicitly permitted canonical advance removes it.

## Owner decision questions

1. Should `plan_changed` require an actual plan-content change in the same
   complete candidate rather than an earlier or future change?
2. Is the Plan Review plan-basis boundary correct: plan outcome, tasks,
   dependencies, estimates, constraints, and planning assumptions included;
   Plan Review records, actuals, lifecycle-only changes, assurance,
   acceptance, and governance evidence excluded?
3. Should relevance to the observation remain a resolving-actor assertion
   while the before/after basis digests prove only that plan content changed?
4. Is atomic composition with independently evaluated existing authority the
   accepted solution for Task removal, rename, and advance ordering?
5. Should resolved Task references remain valid historical references after
   ordinary governed removal?
6. Does Candidate 1.2 otherwise preserve the reviewed Candidate 1.1 scope?

## Alternatives and tradeoffs

- Treating `plan_changed` only as a caller assertion about an earlier change
  would need fewer fields and no atomic composition, but it could not prove
  that any plan content changed before clearing the advisory.
- Persisting a complete external change receipt could prove more provenance,
  but would add a durable audit model beyond the Issue #21 request and is not
  selected here.
- Rejecting every Task removal while any historical request remains would be
  simpler, but would permanently constrain ordinary governed maintenance even
  after review completion.

## Remaining contract work

The exact Plan Review plan-basis projection and digest identity, DSL field
order and limits, atomic command or batch syntax, schemas, diagnostics, text
and JSON ordering, catalog counts, and normative fixtures remain for a
subsequent contract after requirement acceptance.

## Effects not authorized

This review does not authorize specification, ADR, delivery-plan mutation,
implementation, commit, push, PR, release, publication, Issue mutation,
dist-tag changes, runtime activation, or plan advance.

## First-owner routes

The owner chooses exactly one:

- `REVISE`: return to Step 1 with another candidate revision;
- `REVIEW_THEN_REVISE`: independently review this exact snapshot, then return
  to Step 1;
- `REVIEW_THEN_DECIDE`: independently review this exact snapshot, then
  continue to the second owner decision; or
- `REVIEW`: independently review this exact snapshot without added owner
  questions, then continue to the second owner decision.
