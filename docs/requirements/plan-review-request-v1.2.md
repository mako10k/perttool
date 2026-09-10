# Plan Review Request Requirements v1

- Status: Candidate 1.2
- Date: 2026-09-10
- Authority source: GitHub Issue #21, the owner's instruction to address it,
  the completed Candidate 1.1 independent review, and the owner's
  `REVISE` decision
- Prior candidate: Candidate 1.1 remains unchanged as the reviewed historical
  snapshot
- Current compatibility baseline: Grammar 9, CLI Contract 10, perttool 0.11.1
- Proposed target boundary: Grammar 10 and CLI Contract 11

## Revision from Candidate 1.1

Candidate 1.2 changes only the three findings from the completed independent
review:

- `plan_changed` atomically composes request resolution with a separately
  governed plan mutation in one complete candidate;
- deterministic before and after Plan Review plan-basis digests establish
  that plan content changed without hashing Plan Review records; and
- a resolved Task reference remains a valid historical reference after an
  ordinary governed Task removal, while every open reference must be resolved
  in the same candidate that removes or remove-and-add renames its Task.

No other Candidate 1.1 behavior, acceptance criterion, or scope changes.

## 1. Objective

Add one persistent, machine-readable Plan Review Request axis that lets an
executor record that an execution-time observation makes a current planning
assumption questionable. The request asks for review before new downstream
work; it does not assert that replanning is required and does not change the
plan by itself.

Outcome Acceptance continues to answer whether delivered work satisfies its
accepted outcome. Plan Review instead answers whether the current plan should
be retained or changed in light of a new observation. The two axes MUST remain
independent.

## 2. Authority and compatibility disposition

Issue #21 is the product source for this candidate, but its example syntax and
result shapes are non-normative until this candidate is accepted and a
subsequent contract fixes their exact form.

Grammar 9, CLI Contract 10, `Perttool.NextResult.v8`, governance semantics,
Plan Assurance, Milestone Outcome Acceptance, Planning Pool, and existing
mutation and history behavior remain authoritative for the current release.
They MUST NOT change in place.

The proposed implementation boundary is additive Grammar 10 and CLI Contract
11. It proposes these new public identities for contract review:

- source declaration `plan_review_request` model 1;
- read result `Perttool.PlanReviewResult.v1`;
- mutation result `Perttool.PlanReviewMutationResult.v1`; and
- replacement Next result `Perttool.NextResult.v9`.

The subsequent contract MUST fix exact command, schema, diagnostic, Help,
Guide, export, and catalog identities before implementation. Acceptance of
this requirement candidate does not activate or publish any identity.

## 3. Persistent source model

Each request has one stable explicit ID and is owned by the project document.
An open request records:

- model version 1;
- the referenced Task ID;
- a non-empty reason describing why a planning assumption is questionable;
- an explicit numeric-offset `created_at` date-time;
- the caller-asserted actor that created it; and
- an optional opaque locator for rechecking the observation.

The Core MUST NOT read a clock, generate an ID, fetch a locator, or claim that
the locator proves the observation. Creation requires the referenced Task to
exist in the valid pre-change document.

A resolved request preserves every original field and additionally records:

- outcome `plan_retained` or `plan_changed`;
- an explicit numeric-offset `resolved_at` date-time;
- the caller-asserted resolving actor;
- a non-empty resolution reason; and
- the exact pre-resolution source digest that was reviewed.

`plan_retained` means that the completed review selected the current plan
without a plan mutation in the complete resolution candidate.

`plan_changed` means that the same complete final candidate both resolves the
request and contains at least one validated plan-content change. The plan
change is not a future intention or an earlier unbound change. The resolving
actor asserts that the change addresses the observation; the record does not
prove that assertion or that the changed plan is correct.

A `plan_changed` record additionally stores the deterministic Plan Review
plan-basis digests before and after the complete candidate. The two digests
MUST differ. The Plan Review plan basis covers the plan outcome, tasks,
dependencies, estimates, constraints, and declared planning assumptions. It
excludes every Plan Review record, execution actuals and lifecycle-only
changes, assurance and acceptance evidence, and governance authority
evidence. This exclusion avoids digest self-reference and prevents an
unrelated request, work event, status update, receipt, or authority assertion
from satisfying `plan_changed`. The subsequent contract MUST fix the exact
closed projection and digest identity before implementation.

A request remains open until the selected disposition is true in one complete
candidate.

Status is exactly `open` or `resolved`. Version 1 has no reopen, severity,
waiver, supersede, automatic expiry, or hidden deletion.

## 4. Mutation and authority behavior

Create and resolve are preview-first, source-preserving mutations. They MUST
reuse candidate validation, normalized edits, unified diff, raw-byte source
and candidate digests, expected-digest checking, symlink and race rejection,
atomic replacement, separate output, and post-write validation.

Creating a request requires an explicit valid actor but no goal-owner or
DAG-owner authorization. Creation does not grant the actor any permission to
change or accept the plan.

Resolving the last open request clears the project-wide review-required
advisory. Resolving one request while another remains open MUST preserve
`review_required`. Every resolution therefore requires one of:

- the current effective DAG owner as actor;
- a current effective DAG delegate as actor; or
- a fresh candidate-bound assertion for the current effective DAG owner.

This operation-specific review authority does not classify the resolution
record as a DAG mutation, grant plan-change authority, or make an asserted
identity authenticated. A `plan_changed` candidate separately classifies and
authorizes its actual non-Plan-Review changes under existing governance,
assurance, validation, acceptance, history, and safe-write boundaries. Both
the Plan Review resolution decision and every applicable existing decision
MUST succeed before the one atomic write.

The resolution result MUST expose a distinct Plan Review authority decision.
It MUST derive the effective DAG owner and delegates from the exact
pre-resolution source and bind any owner assertion to the complete resolution
candidate. It MUST NOT add an existing governance `affected_scope`, reuse a
DAG-mutation authorization result as though the plan changed, or emit a
`PTGOV-*` warning merely because Plan Review authority applies. The
subsequent contract MUST fix the closed result shape and stable denial
diagnostics.

`plan_retained` MUST NOT be combined with a Plan Review plan-basis change.
`plan_changed` MUST be combined with one, and its before and after basis
digests MUST bind the same original and complete final candidate used by the
mutation and authority results. The resolution operation never supplies or
waives authority for that plan change. Exact command or batch composition
syntax remains subsequent contract work.

Creating the same ID with the same complete payload is an idempotent no-op.
The same ID with a different payload is an error. Repeating the same complete
resolution is an idempotent no-op; changing a resolved request or resolving it
again with different evidence is an error.

## 5. Derived project-control state

The project state is `review_required` exactly when at least one request is
open; otherwise it is `clear`. The derived projection contains all open
request IDs in explicit deterministic order and the stable action
`review_before_new_downstream_work` when review is required.

`dag next` MUST expose this projection before its task recommendation in both
text and JSON. The projection is a strong advisory only. It MUST NOT by itself:

- make the document invalid;
- assert `replan_required`;
- change task eligibility, readiness, `runnable_now`, ranking, recommendation,
  resource scheduling, or start authority;
- stop continuation of already active work or a bounded local safety action;
- change Plan Assurance or Milestone Outcome Acceptance state; or
- create an override, acceptance, or authority record.

The Guide MUST distinguish continuing active work, taking a bounded local
safety action, starting new downstream work, reviewing the plan, retaining the
plan, and changing the plan.

## 6. Inspection and command surface

The contract MUST provide file-first create, list, show, and resolve commands
with text and JSON parity. The candidate command direction is:

- `plan review-request`;
- `plan review-list`;
- `plan review-show`; and
- `plan review-resolve`.

Exact operands and options remain contract work. The final surface MUST
include explicit actor and date-time inputs, optional locator input, outcome
and resolution evidence, preview/diff, separate output, in-place safe write,
expected digest, closed schemas, stable diagnostics, Help, and Guide material.

The read result MUST distinguish open and resolved records and expose the
derived project state without relying on prose. The mutation result MUST bind
the exact original, candidate, Plan Review authority decision, every
applicable existing plan-mutation decision, Plan Review plan-basis digests,
request identity, and write outcome. Under CLI Contract 11,
`Perttool.NextResult.v9` MUST retain every v8 meaning for supported legacy
inputs and add only the Plan Review projection selected here.

## 7. Lifecycle, removal, and history

An open request remains valid when its Task becomes active, blocked,
suspended, or done. A candidate that removes, remove-and-add renames, or
canonically advances away a Task with an open request MUST also resolve every
open request that references that Task as `plan_changed` in the same complete
candidate. The complete candidate must independently satisfy the Plan Review
resolution decision and every existing plan-change, acceptance, assurance,
governance, history, and safe-write boundary. Otherwise the candidate fails
and identifies the blocking request IDs deterministically.

After resolution, the original Task ID is an explicit historical reference.
It remains valid if a later ordinary governed mutation removes or
remove-and-add renames that Task. That later mutation retains the resolved
request byte-for-byte and MUST NOT treat the historical reference as an
invalid or orphaned current-Task reference.

When canonical advance removes a Task whose requests are all resolved, it MAY
remove those resolved request declarations in the same complete preview. The
advance result MUST list their IDs, destructive history proof MUST cover their
exact bytes, and the committed pre-advance Git snapshot remains the durable
record. No ordinary mutation or advance may silently delete a request or leave
an open request as a historical reference.

Plan Review source records are excluded from Task Plan Assurance commitment
hashes and Milestone Outcome Acceptance. Their state is independently visible
and MUST survive unrelated reseal, outcome, receipt, Planning Pool, temporal,
and governance mutations byte-for-byte.

## 8. Determinism, limits, and failure closure

The contract MUST select exact limits for record count and free-text fields.
Unknown fields, invalid IDs, duplicate IDs, invalid date-times, empty reasons,
invalid Task references, illegal transitions, stale digests, unauthorized
resolution, candidate invalidity, and any safe-write failure fail closed with
stable diagnostics and no partial candidate or write.

Ordering, formatting, JSON field order, text sections, diagnostics, edits,
digests, and idempotent retries MUST be byte-deterministic for the same source,
request, options, and tool version. Free text and locators MUST be documented
as untrusted content and MUST NOT trigger file, Git, network, shell, or tool
access.

## 9. Compatibility and migration

The existing CLI Contract 10 continues to return
`Perttool.NextResult.v8` and retain its exact current behavior and result
identities. Under the proposed CLI Contract 11, supported Grammar 1 through 9
inputs without Plan Review records remain valid and retain their current
planning, validation, analysis, recommendation, temporal, assurance,
acceptance, and start-authority meanings, but commands returning the active
Next envelope use `Perttool.NextResult.v9`. Contract 11 does not
version-dispatch v8 versus v9 by input grammar.

Explicit Grammar 9 to 10 migration changes only the grammar version unless
another separately requested migration is included. It MUST NOT synthesize a
request from prose, diagnostics, unexpected recommendations, failed
acceptance, or assurance state.

Version 1 is CLI and public-library scope. LSP, VSIX, MCP mutation, external
Issue synchronization, notifications, automatic observation capture, and
multi-document propagation remain outside this candidate.

## 10. Acceptance criteria

- A valid actor can preview and persist one request without goal or DAG change
  authority and cannot gain such authority from the request.
- Open requests deterministically derive `review_required` and appear before
  task recommendation in text and JSON.
- The advisory does not alter validity, ranking, scheduling, eligibility, or
  start authority.
- The effective DAG owner, delegate, or fresh owner assertion can resolve a
  request as `plan_retained` or `plan_changed`; other actors fail closed.
- Resolving one request preserves `review_required` while any other request
  remains open, and resolving the last open request derives `clear`.
- Resolution authority never authorizes the plan change composed with it.
- `plan_changed` requires a non-empty Plan Review plan-basis change in the
  same complete candidate, records unequal before and after basis digests,
  and separately satisfies every applicable existing plan-change boundary.
- `plan_retained` has no Plan Review plan-basis change, and an intended future
  or earlier unbound change leaves the request open.
- Resolution authority has its own closed projection and diagnostics and
  neither creates a governance affected scope nor changes current
  `PTGOV-*` behavior.
- Create, list, show, resolve, and Next projections have closed schemas,
  stable diagnostics, Help, Guide, and text/JSON parity.
- Preview, separate output, and in-place write share one byte-identical
  candidate and retain optimistic-lock and safe-write behavior.
- Duplicate, replay, unknown-ID, already-resolved, stale, invalid-reference,
  cancellation, and race cases are deterministic.
- Removing, remove-and-add renaming, or advancing away a Task with open
  requests requires atomic `plan_changed` resolution of every affected
  request; otherwise the candidate fails without a write.
- Resolved Task references remain valid historical references after ordinary
  governed Task removal and retain their records byte-for-byte.
- Resolved-record advance removal is explicit, history-protected, and visible
  in the result.
- Existing documents and CLI Contract 10 remain unchanged until one separately
  accepted atomic activation. Contract 11 uses NextResult v9 for every
  supported input grammar while preserving the legacy meanings stated above.
- Normative cases cover `plan_retained`, atomic `plan_changed`, equal and
  unequal plan-basis digests, multiple open requests, missing locator, done
  Task, blocked and atomic Task removal or rename, ordinary post-resolution
  Task removal, advance, wrong actor, stale digest, invalid Task reference,
  and unchanged legacy input.

## 11. Out of scope

- automatic replanning or plan mutation;
- automatic creation from diagnostics, logs, tests, or model inference;
- a generic observation store, bug tracker, incident manager, or severity
  workflow;
- implicit hard blocking or autonomous suspension;
- proof that reason or locator content is true;
- replacement of governance, Plan Assurance, Milestone Outcome Acceptance, or
  recommendation authority;
- external synchronization, editor or MCP writes, release selection,
  publication, Issue mutation, and plan advance authorization.
