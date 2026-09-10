# Issue #21 Requirement Independent Review

- Status: Completed
- Date: 2026-09-10
- First-owner route: `REVIEW_THEN_DECIDE`
- Reviewed candidate: `docs/requirements/plan-review-request-v1.md`
- Candidate revision: Candidate 1.0
- Candidate SHA-256: `a43466a2922d10795e0c6696e2eb1336d2e7ac0005a519ce2604c691eb94e132`
- Review input: `docs/process/issue-21-requirement-review-input.md`
- Review-input SHA-256: `92067ac922d937a3ea273d7b66f5287003a4346be396033abf50cb80b50cee5e`
- Audited reasoning: `docs/process/issue-21-requirement-independent-review.think`
- LLMThink audit: `fatal=0 error=0 warning=0 info=0 hint=0`

## Review conclusion

The exact candidate is reviewable and substantially preserves the Issue #21
boundary: an advisory Plan Review axis does not grant plan-change authority,
alter start authority, replace assurance or acceptance, or authorize
implementation. Two internal contradictions require an owner decision before
acceptance. Two further matters remain contract-level unknowns.

The candidate was not edited during this review.

## Findings

### IR-21-001 — Contradiction — High

Section 4 says that resolving a request clears the project-wide
`review_required` advisory. Section 5 instead derives `review_required`
whenever at least one request is open, and the acceptance criteria require
multiple-open-request coverage.

Resolving one request cannot clear the advisory if another request remains
open. This contradiction originates in Candidate 1.0 authoring. A revision
must make clearance conditional on there being no remaining open request.

### IR-21-002 — Contradiction — High

Sections 2 and 6 propose `Perttool.NextResult.v9` as the replacement Next
identity for CLI Contract 11. Section 9 says that Grammar 1 through 9 inputs
retain their exact current result identities, which includes
`Perttool.NextResult.v8`.

The candidate must select one compatible rule: either Contract 11 dispatches
v8 for legacy inputs and v9 for the new boundary, or Contract 11 returns v9
while preserving legacy behavior and semantics rather than the exact envelope
identity. The current text requires both outcomes.

### IR-21-003 — Evidence gap or unresolved unknown — Medium

The candidate permits outcome `plan_changed` without performing or
authorizing a plan mutation and binds only the reviewed pre-resolution source
digest. It does not yet say whether `plan_changed` means a review decision that
the plan should change or evidence that a separately governed change has
already occurred.

The later contract must fix that meaning and its evidence binding. This is not
an additional feature or acceptance blocker beyond making the selected outcome
unambiguous.

### IR-21-004 — Evidence gap or unresolved unknown — Medium

Current governance derives goal and DAG scopes from the candidate's actual
plan changes. Candidate 1.0 instead introduces operation-specific resolution
authority while deliberately not classifying resolution as a DAG mutation.

This separation is not a contradiction with the current authority because it
is proposed as an additive boundary. The later contract must define the exact
authority-result shape, candidate-bound owner assertion, denial diagnostics,
and interaction with current `PTGOV-*` warnings without granting DAG mutation
authority.

## Optional or future candidates

No optional or future item became an acceptance blocker. Severity, hard
blocking, automatic observation capture, locator retrieval, LSP, VSIX, MCP
mutation, notifications, external Issue synchronization, and multi-document
propagation remain outside Candidate 1.0.

## Out of scope

Implementation, specification, ADR, delivery-plan mutation, commit, push, PR,
release, publication, Issue mutation, dist-tag changes, runtime activation,
and plan advance remain unauthorized.

## Compatibility and authority checks

- Request creation does not grant goal or DAG authority.
- Resolution does not perform or authorize the plan change it records.
- Open requests cannot be silently orphaned by Task removal or advance.
- Resolved-record removal is explicit and subject to destructive history
  proof.
- Plan Review remains independent from Plan Assurance and Milestone Outcome
  Acceptance.
- Free text and locators cannot trigger file, Git, network, shell, or tool
  access.
- The current Grammar 9, CLI Contract 10, and perttool 0.11.1 implementation
  remain unchanged.

## Second-owner route

The selected `REVIEW_THEN_DECIDE` route now proceeds to lifecycle step 4. The
owner must choose exactly one of:

- `REVISE`: return to step 1 and create a new candidate revision;
- `REREVIEW`: keep the candidate digest unchanged, add or change a review
  question, and repeat independent review; or
- `ACCEPT`: accept these exact candidate bytes despite the reported findings.

The review recommendation is `REVISE` because IR-21-001 and IR-21-002 are
contradictions in the normative candidate text. Any edit creates a new digest
and restarts lifecycle step 1.
