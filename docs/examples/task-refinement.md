# Task Refinement Normative Design Cases

- Contract: [Task Refinement and Assurance Boundary](../specs/task-refinement.md)
- Refinement model: 1
- Runtime status: semantic design only

These cases define the intended future semantics. They are not accepted
Grammar 6 source examples and do not introduce an active CLI spelling.

## TRF-001: Independent macro and detail plans

Macro document `MACRO` contains task `A`. Detail document `DETAIL_A` contains
tasks `A1`, `A2`, and `A3`. Both documents remain independently valid and
analyzable.

Expected:

- no combined execution or resource schedule is created;
- the macro schedule counts `A` and never also counts `A1` through `A3`;
- the detail schedule counts its own tasks and never also counts `A`; and
- no include/import behavior is implied.

## TRF-002: One declared partition

One semantic relation identifies `A` as parent and the closed child set
`[A1, A2, A3]` as `partition`.

Expected:

- the relation is one n-ary record rather than seven separate set claims;
- each reference resolves to a task;
- the child references are distinct and deterministically ordered in machine
  output;
- the relation state is `declared_partition`; and
- relation wording does not claim machine-proven MECE.

## TRF-003: Invalid refinement forest

Variants duplicate a child, give one child two direct parents, make a parent
its own child, create a refinement cycle, use fewer than two children, or mix
direct children from multiple detail documents.

Expected:

- the refinement view is invalid with a deterministic cause and witness;
- neither source document's independent check or analysis result is replaced;
- no task, gate, planning dependency, or seal is synthesized; and
- no best-effort partition is returned.

## TRF-004: Semantic proof boundary

The titles and descriptions appear to overlap or omit work, but all structural
references are valid.

Expected:

- the tool reports the declared partition without claiming semantic proof;
- it does not use an LLM or text heuristic to infer containment, exclusion, or
  coverage;
- it does not rename the state to `verified_mece`; and
- human acceptance, including a future signature, remains an assertion rather
  than mathematical proof over task prose.

## TRF-005: Detail change remains below the macro boundary

The detail plan changes `A2` and then changes the child list while macro task
`A` and its assurance data remain byte-identical.

Expected:

- detail and relation source identities change;
- the macro task contract and basis do not change;
- macro descendants do not require replanning; and
- no explicit or implicit `no_recheck` authority is recorded.

## TRF-006: Parent change follows ordinary assurance

Macro task `A` changes while its partition remains present.

Expected:

- the existing task-plan hash and planning-basis rules apply to `A`;
- affected macro descendants require ordinary replanning and resealing;
- the partition does not waive, suppress, or repair the mismatch; and
- detail status and completion are not treated as conformance evidence.

## TRF-007: Atomic expansion to detail assurance

An explicit candidate replaces `A` at the upper assurance boundary with
selected detail tasks and explicit incoming and outgoing planning relations.

Expected:

- the partition alone does not generate the relation mapping;
- every removed and added relation is previewed;
- target child commitments are complete and known;
- the resulting planning graph is valid and the affected closure is resealed;
- no half-expanded persistent state exists; and
- the macro container is not counted together with its details.

## TRF-008: Exact contraction to macro assurance

An explicit candidate replaces individually participating detail tasks with
parent `A`. The detail boundary has common normalized external planning
relations and no residual relation.

Expected:

- the parent contract is explicitly reviewed rather than synthesized;
- transferable relations retain their modes;
- children remain in the detail plan but leave the upper assurance boundary;
- the partition remains available for navigation; and
- the affected macro closure is resealed atomically.

## TRF-009: Residual and historical contraction refusal

Variant 1 leaves a child-only external relation that cannot be transferred
without generalizing it to the whole parent. Variant 2 has active work,
outcomes, work events, or frontier receipts owned by a transition task.

Expected:

- Variant 1 reports the exact residual and refuses exact contraction;
- an explicit changed abstraction is a separate reviewed relation candidate;
- Variant 2 is unavailable under refinement model 1; and
- no actual or historical evidence is reassigned or discarded.

## TRF-010: Runtime and round-trip boundary

An exact partition is expanded, contracted without intervening changes, and
expanded again.

Expected:

- both expansions produce the same normalized upper relation mapping;
- fresh candidate-bound seals are still required;
- no active Grammar 6, CLI Contract 7, package, or schema surface changes;
- storage, document locator, multi-file transaction, interface, migration,
  and release decisions remain separate; and
- implementation cannot begin from this semantic draft alone.
