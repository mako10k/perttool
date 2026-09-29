# Plan Review lifecycle and history implementation review

Date: 2026-09-29

## Review boundary

The subject is the private `PLAN_REVIEW_LIFECYCLE_HISTORY` implementation on the
Issue #21 branch. The governing input is section 9 of
`docs/specs/plan-review-request.md`, within the accepted requirement and ADR
chain. This review asks whether the private candidate and history proof preserve
every request when a Task identity is removed. The current threshold is a
validated complete candidate, declaration-order blocking IDs, exact removed
declaration ranges, and fail-closed HEAD and stage-0 correspondence. Public CLI,
schema, Help, Guide, and package activation belong to
`PLAN_REVIEW_PUBLIC_CONTRACT`. For example, the private candidate must reject an
open request orphaned by a Task rename now; spelling its public JSON field is
part of the next task.

## Implementation

- The ordinary Grammar 10 batch composition lifts the existing Contract 10
  batch candidate and inspects the complete final source. An open request
  referencing a removed or renamed Task must be resolved as `plan_changed` in
  that candidate. `PTREV-108` carries blocking IDs in declaration order.
- The Plan Review resolution planner makes the same check before basis
  evaluation, so a simultaneous Task removal cannot hide another open request
  behind a generic candidate error. Ordinary later mutations preserve resolved
  declaration bytes and historical references.
- Canonical advance cleanup selects only input-pre-resolved requests whose
  Tasks are removed. It emits one deletion edit and one exact destructive
  record for each complete request declaration. The final candidate check
  retains any request opened in the input and resolved in the same candidate;
  a still-open orphan blocks the candidate.
- The existing canonical history comparator accepts an additional lexical
  scanner from the Plan Review layer. It compares the selected full declaration
  bytes in current source, HEAD, and stage-0 index. It retains BOM bytes during
  UTF-8 decoding. The existing baseline capture and race recheck remain the
  persistence gate; this private helper neither writes nor introduces a delete
  command, external receipt, or public API.

## Review findings

- `INSIDE`, fixed: the initial history comparator imported the Plan Review
  scanner into the Planning Pool layer. The final implementation injects that
  scanner from the Plan Review layer and preserves the Core dependency
  direction. The adapter dependency test and static gate check the boundary.
- `INSIDE`, fixed: default UTF-8 decoding discarded a leading BOM and could
  reject an otherwise exact destructive history baseline. The comparator now
  preserves BOM, with a focused BOM/CRLF case.
- `OUTSIDE`: wiring the private advance composition and removed request IDs
  into Contract 11 CLI output, schema, Help, and installed-package surfaces is
  assigned to `PLAN_REVIEW_PUBLIC_CONTRACT`. No public command or package
  export is changed here.
- `BOUNDARY_DISPUTE`: none identified.

## Verification

The focused lifecycle suite covers open removal, remove-and-add rename,
same-candidate `plan_changed`, multiple open requests, resolved historical
retention, pre-resolved advance cleanup, same-candidate advance retention,
HEAD/index overlap, force disposition, and BOM/CRLF correspondence. Its eight
cases and the adapter dependency test passed. The existing Plan Review source
and mutation tests and advance history tests passed in a 58-test focused run.
The complete `node --test --test-concurrency=4 --test-reporter=dot
test/*.test.mjs` gate exited 0. The TypeScript build, `check:static`,
`check:docs`, `check:english`, and `git diff --check` passed. The first
unbounded full-suite attempt overloaded host tests and was interrupted; the
bounded run is the conformance result.

The implementation is private and provides no direct beneficiary use yet. Its
evidenced contribution is a candidate and history seam for the planned public
Contract 11 activation. Realized public value remains zero until that gate and
subsequent release and access decisions are completed.
