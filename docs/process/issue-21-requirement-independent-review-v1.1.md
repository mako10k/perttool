# Issue #21 Candidate 1.1 Independent Requirement Review

- Status: Completed
- Date: 2026-09-10
- First-owner route: `REVIEW_THEN_DECIDE`
- Reviewed candidate: `docs/requirements/plan-review-request-v1.1.md`
- Candidate revision: Candidate 1.1
- Candidate SHA-256: `197b14fd7eed8178f1abae725fe168f9bb8e3da64ccef79ba744867740a4640f`
- Review input: `docs/process/issue-21-requirement-review-input-v1.1.md`
- Review-input SHA-256: `2e9793b2adee87e728b2f69248c0c00691d7c3f321a73937121f28c02944483b`
- Audited reasoning: `docs/process/issue-21-requirement-independent-review-v1.1.think`
- LLMThink audit: `fatal=0 error=0 warning=0`

## Review conclusion

Candidate 1.1 is reviewable. It resolves the Candidate 1.0 contradictions
about multiple open requests and the Contract 11 Next-result identity, and it
keeps current governance, assurance, acceptance, recommendation, history, and
external-effect boundaries intact.

The revised `plan_changed` rule creates one new ordering contradiction and
leaves one material evidence gap. Ordinary post-resolution Task removal also
remains a lifecycle unknown. Revision is recommended before acceptance.

The candidate was not edited during this review.

## Findings

### IR-21-101 — Contradiction — High

Section 3 requires a separately authorized and persisted plan mutation to
exist before a request can be resolved as `plan_changed`. Section 7 forbids
removing or remove-and-add renaming the referenced Task while the request is
open. Section 4 separately says that resolution neither performs nor
authorizes the plan mutation.

A legitimate reviewed change that removes or remove-and-add renames the
referenced Task therefore has no permitted ordering:

- change first is forbidden because the request is open; and
- resolve first is forbidden because the changed plan does not yet exist.

This contradiction originates in the Candidate 1.1 revision of
`plan_changed` combined with the retained open-request lifecycle rule. The
next revision must select an ordering or atomic composition that preserves the
separate plan-change authority boundary.

### IR-21-102 — Evidence gap or unresolved unknown — High

Candidate 1.1 requires `plan_changed` to mean that a separately governed,
validated, and persisted relevant plan mutation already exists. The selected
source model does not retain a creation-time plan digest or semantic basis,
the identity of the reviewed change, or a change receipt. The resolved record
adds only the current pre-resolution source digest.

Those fields cannot distinguish:

- a relevant plan change completed after the request;
- an unrelated plan change; or
- an unchanged plan labeled `plan_changed` by the caller.

The requirement must decide whether this is a caller-asserted review outcome
or a mechanically verifiable fact. If it is verifiable, the requirement must
identify sufficient evidence before the subsequent contract can define a
deterministic acceptance case. This is not authority to invent a new evidence
model during contract design.

### IR-21-103 — Evidence gap or unresolved unknown — Medium

Candidate 1.1 defines explicit removal of a resolved request together with
canonical advance, but does not fix the result of an ordinary governed Task
removal after the request is resolved. The current text requires that no
request be silently orphaned, yet it does not choose among retaining a valid
historical Task reference, atomically removing the resolved record, or
rejecting that ordinary Task removal.

The requirement should select this lifecycle meaning. The subsequent contract
must not infer it silently.

## Prior findings now resolved

- Candidate 1.0 finding IR-21-001 is resolved: `review_required` remains until
  the last open request is resolved.
- Candidate 1.0 finding IR-21-002 is resolved: Contract 10 keeps NextResult v8,
  while Contract 11 uses NextResult v9 for every supported input grammar and
  preserves legacy meanings rather than the v8 envelope identity.
- Candidate 1.0 finding IR-21-004 is resolved at requirement level: resolution
  has a distinct Plan Review authority projection and does not fabricate a DAG
  governance affected scope or alter current `PTGOV-*` behavior. Exact closed
  shape and diagnostics remain subsequent contract work as stated.
- Candidate 1.0 finding IR-21-003 is only partially resolved: Candidate 1.1
  selects completed persistence rather than a future decision, but does not
  yet supply the evidence or ordering needed to make that meaning operable.

## Owner questions reviewed

1. Last-open clearance is internally consistent and matches the derived
   project state.
2. One Contract 11 NextResult v9 envelope is compatible with keeping Contract
   10 unchanged, provided legacy meanings remain as stated.
3. Completed persistence gives `plan_changed` a clearer intended meaning, but
   the current ordering and evidence model do not support every required case.
4. A distinct Plan Review authority result is consistent with the existing
   governance boundary.
5. The Candidate 1.0 scope is otherwise preserved.

## Optional or future candidates

No optional or future feature became an acceptance blocker. Severity, hard
blocking, automatic observation capture, locator retrieval, LSP, VSIX,
MCP mutation, notification, external Issue synchronization, and multi-document
propagation remain outside Candidate 1.1.

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
- `ACCEPT`: accept these exact candidate bytes.

The review recommendation is `REVISE` because IR-21-101 is a requirement
contradiction and IR-21-102 leaves the selected `plan_changed` acceptance
meaning unsupported by the declared record model.
