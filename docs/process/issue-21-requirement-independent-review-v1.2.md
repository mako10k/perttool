# Issue #21 Candidate 1.2 Independent Requirement Review

- Status: Completed
- Date: 2026-09-10
- First-owner route: `REVIEW_THEN_DECIDE`
- Reviewed candidate: `docs/requirements/plan-review-request-v1.2.md`
- Candidate revision: Candidate 1.2
- Candidate SHA-256: `94632d3c85cf3400a920ff56cb59064b8ca378fc5e11c3d97c9bc6c031e28c38`
- Review input: `docs/process/issue-21-requirement-review-input-v1.2.md`
- Review-input SHA-256: `a01b8923428c05ed7eadc3f7f0312a7b99e27333e36f558905f40f45509a49f4`
- Audited reasoning: `docs/process/issue-21-requirement-independent-review-v1.2.think`
- LLMThink audit: `fatal=0 error=0 warning=0`

## Review conclusion

Candidate 1.2 is reviewable and has no identified requirement contradiction.
It resolves all three Candidate 1.1 findings while preserving the Issue #21
advisory, compatibility, authority, assurance, acceptance, history, and
external-effect boundaries.

Two exact behaviors remain subsequent-contract unknowns: the short-circuit for
an exact `plan_changed` replay and the retention rule for a request resolved in
the same canonical-advance candidate that removes its Task. Neither unknown
requires a new requirement capability or conflicts with an accepted current
authority.

The candidate was not edited during this review.

## Findings

### IR-21-201 — Evidence gap or unresolved unknown — Medium

Candidate 1.2 requires `plan_changed` to contain a Plan Review plan-basis
change, and separately requires an exact repeated resolution to be an
idempotent no-op. An exact replay against an already resolved source has no new
plan change.

This is not a requirement contradiction because an idempotent no-op need not
construct a new resolution candidate. The subsequent contract must define the
closed replay short-circuit, including comparison with the stored outcome,
actors, reasons, source binding, and before and after basis digests. It must
reject a changed replay rather than reconstructing or inventing a plan delta.

### IR-21-202 — Evidence gap or unresolved unknown — Medium

Canonical advance may remove declarations associated with a Task whose
requests are all resolved. Candidate 1.2 also permits an open request to be
resolved as `plan_changed` in the same complete candidate that advances away
its Task.

The subsequent contract must fix the evaluation point for removal eligibility.
If removing a newly resolved declaration would leave the final candidate
without the required `plan_changed` record and basis evidence, that record
must remain as a historical reference. The contract must not silently treat
an intermediate resolution as a final persisted record.

## Candidate 1.1 findings resolved

- IR-21-101 is resolved: Task removal or remove-and-add rename can compose
  atomically with request resolution while existing plan-change authority
  remains independently required.
- IR-21-102 is resolved: unequal Plan Review plan-basis digests prove a
  plan-content change, while relevance to the observation and correctness
  remain explicitly outside machine proof.
- IR-21-103 is resolved: resolved Task references remain valid historical
  references after ordinary governed removal.

## Owner questions reviewed

1. Same-candidate `plan_changed` composition is internally consistent.
2. The selected Plan Review plan-basis boundary is coherent at the requirement
   level; its exact closed projection remains contract work.
3. Separating machine-proved plan change from actor-asserted relevance avoids
   evidence laundering.
4. Atomic composition preserves independent existing authority and removes
   the Task-removal ordering deadlock.
5. Historical validity after ordinary removal closes the prior lifecycle gap.
6. Candidate 1.2 otherwise preserves the reviewed Candidate 1.1 scope.

## Optional or future candidates

No optional or future feature became an acceptance blocker. External change
receipts, severity, hard blocking, automatic observation capture, locator
retrieval, LSP, VSIX, MCP mutation, notifications, external Issue
synchronization, and multi-document propagation remain outside Candidate 1.2.

## Out of scope

Implementation, specification, ADR, delivery-plan mutation, commit, push, PR,
release, publication, Issue mutation, dist-tag changes, runtime activation,
and plan advance remain unauthorized.

## Second-owner route

The selected `REVIEW_THEN_DECIDE` route now proceeds to lifecycle Step 4. The
owner must choose exactly one:

- `REVISE`: return to Step 1 and create a new candidate revision;
- `REREVIEW`: keep the candidate digest unchanged, add or change a review
  question, and repeat the independent review; or
- `ACCEPT`: accept these exact Candidate 1.2 bytes.

The review recommendation is `ACCEPT`. The two remaining findings are bounded
contract details already assigned to the subsequent contract and do not
contradict the requirement or current authority.
