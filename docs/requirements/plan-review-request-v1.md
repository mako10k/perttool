# Plan Review Request Requirements v1

- Status: Candidate 1.0
- Date: 2026-09-10
- Authority source: GitHub Issue #21 and the owner's instruction to address it
- Current compatibility baseline: Grammar 9, CLI Contract 10, perttool 0.11.1
- Proposed target boundary: Grammar 10 and CLI Contract 11

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

Resolving a request clears the project-wide review-required advisory and
therefore requires one of:

- the current effective DAG owner as actor;
- a current effective DAG delegate as actor; or
- a fresh candidate-bound assertion for the current effective DAG owner.

This operation-specific review authority does not classify the candidate as a
DAG mutation, grant DAG change authority, or make an asserted identity
authenticated. Any actual plan change still passes its existing governance,
assurance, validation, acceptance, and safe-write boundaries independently.

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
the exact original, candidate, authority decision, request identity, and write
outcome. `Perttool.NextResult.v9` MUST retain every v8 meaning and add only the
Plan Review projection selected here.

## 7. Lifecycle, removal, and history

An open request remains valid when its Task becomes active, blocked,
suspended, or done. A Task with an open request MUST NOT be removed, renamed by
remove-and-add, or removed by canonical advance until the request is resolved.
The failed candidate MUST identify the blocking request IDs deterministically.

When canonical advance removes a Task whose requests are all resolved, it MAY
remove those resolved request declarations in the same complete preview. The
advance result MUST list their IDs, destructive history proof MUST cover their
exact bytes, and the committed pre-advance Git snapshot remains the durable
record. No ordinary mutation or advance may silently orphan a request.

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

Grammar 1 through 9 inputs without Plan Review records retain their exact
current behavior and result identities. Explicit Grammar 9 to 10 migration
changes only the grammar version unless another separately requested migration
is included. It MUST NOT synthesize a request from prose, diagnostics,
unexpected recommendations, failed acceptance, or assurance state.

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
- Resolution never performs or authorizes the plan change it records.
- Create, list, show, resolve, and Next projections have closed schemas,
  stable diagnostics, Help, Guide, and text/JSON parity.
- Preview, separate output, and in-place write share one byte-identical
  candidate and retain optimistic-lock and safe-write behavior.
- Duplicate, replay, unknown-ID, already-resolved, stale, invalid-reference,
  cancellation, and race cases are deterministic.
- Open requests cannot be silently removed or orphaned by Task lifecycle,
  direct mutation, replan, or canonical advance.
- Resolved-record advance removal is explicit, history-protected, and visible
  in the result.
- Existing documents and current public contracts remain unchanged until one
  separately accepted atomic activation.
- Normative cases cover `plan_retained`, `plan_changed`, multiple open
  requests, missing locator, done Task, attempted Task removal, advance,
  wrong actor, stale digest, invalid Task reference, and unchanged legacy
  input.

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
