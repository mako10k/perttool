# Conditional Plan Assurance Examples

- Status: Normative 1.0 examples
- Contract: [Conditional Plan Assurance](../specs/plan-assurance.md)
- Interface: [Grammar 6 and CLI Contract 7](../specs/plan-assurance-interface.md)
- Initial runtime boundary: Grammar 6 and CLI Contract 7 in `0.7.0`
- Current runtime status: these assurance examples remain valid under the
  Grammar 7 and CLI Contract 8 source successor
- Case fixture: [`plan-assurance-contract-v1.json`](../../test/fixtures/plan-assurance-contract-v1.json)

The snippets below use the retained Grammar 6 assurance source contract. Grammar 1 through
5 and exact CLI Contract 6 package pins do not accept these assurance records;
`0.7.0` is the first public package that does.
`A -> B` in an execution diagram means the projected AoA task dependency
described by the contract; it is not a replacement for task-as-edge source
notation.

The three source forms are:

```pert
task_relation REL_BOTH A -> B:
  mode both

task_relation REL_EXECUTION A -> B:
  mode execution_only
  reason "B waits for A, but its plan is independently fixed"

task_relation REL_PLANNING A -> B:
  mode planning_only
  reason "B uses A's findings but may start before A finishes"
```

Their selected CLI modes are `both`, `execution-only`, and `planning-only` under
`plan-dependency add|set|remove`. `=>`, `.>`, and other arrow spellings are not
aliases; the `mode` field carries the distinction.

The selected machine-managed records have these shapes:

```pert
project ASSURED:
  version 6
  plan_assurance_model 1
  plan_assurance_hash_model 1

plan_seal B:
  accepted_contract sha256:ccafd4ffb6985b1d11cbb4c91a40e1d634027f73bab5e195d2d63e1179f1aacf
  accepted_basis sha256:17d1c255bdf3d1f913eb12264c16d64b1abaae4d17e88a224229f550a0830fb9
  accepted_inputs:
    A both sha256:3923becd976daeca7047a65206633ed3b8210b426f1bf969107728f5261cd489
  reason "Initial plan assurance seal"

task_outcome OUT_A:
  model 1
  task A
  against_basis sha256:3923becd976daeca7047a65206633ed3b8210b426f1bf969107728f5261cd489
  status changed
  summary "The delivered API returns a different normalized record"
  reason "Acceptance found a deliberate contract difference"

assurance_receipt AR_A:
  model 1
  receipt_hash sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  producer A
  producer_contract_hash sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
  producer_assurance_hash sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
  outcome conformant
  source_milestone M1
  consumers:
    B both
```

Inspection and acceptance use `plan-assurance show|hash|seal|reseal`; dependency
and outcome evidence use `plan-dependency add|set|remove` and
`task-outcome add|set|remove`. Callers do not supply accepted basis hashes.

## PAS-001: Assurance-disabled compatibility

Input:

```text
Grammar 5 document
assurance model absent
A -> B
```

Expected:

- coverage is `not_enabled`;
- task assurance is `not_applicable`;
- no hash is required or written;
- current Grammar 5 check, analysis, Next, mutation, and advance behavior is
  unchanged; and
- no repeated per-task warning is emitted merely because the feature is absent.

## PAS-002: Enabled but unsealed plan

Input:

```text
assurance model 1 enabled
A -> B -> C
no accepted basis hashes
```

Expected:

- coverage is `unsealed`;
- A, B, and C are `unsealed`;
- analysis remains available for planning;
- affected task IDs are absent from normal new-start authority; and
- the required action is an atomic initial seal, not an automatic write.

## PAS-003: Atomic initial seal with default dependencies

The plan author previews and accepts the current `A -> B -> C` plan.

Expected:

- projected execution relations `A -> B` and `B -> C` each have effective mode
  `both`;
- no `task_relation` declaration is required for the default, while an explicit
  `mode both` pin is source-preserved and hash-equivalent;
- the initial seal computes A, B, and C in stable topological order;
- all accepted basis hashes are written in one validated candidate;
- B and C are `conditional` while their predecessors remain unfinished; and
- a partial initial candidate is rejected.

## PAS-004: Lifecycle and formatting changes preserve plan hashes

Starting A changes `status` and appends its work event. A later source format
operation changes spacing and line endings without changing semantic task
fields.

Expected:

- the whole-document source digest changes;
- an old Next result is stale and must be regenerated;
- A's task plan contract hash and computed basis do not change;
- B and C do not require resealing; and
- work-event `planned_value`, times, effort, and reason are not hash inputs.

## PAS-005: Default both-mode propagation

A's description or estimate changes after the `A -> B -> C` plan was sealed.

Expected:

- A has a direct task-plan contract mismatch;
- B is `review_required` through its default `both` dependency on A;
- C is `review_required` through B;
- the cause path for C is `A -> B -> C`;
- B and C are withheld from new-start authority; and
- an unrelated verified branch remains eligible.

## PAS-006: Planning-only dependency

Execution graph:

```text
A    B
```

Explicit assurance relation:

```pert
task_relation REL_A_B A -> B:
  mode planning_only
  reason "B uses A's findings but may start before A finishes"
```

Expected:

- A does not affect B's structural readiness, CPM, or resource schedule;
- B may be ready while A is unfinished;
- B is `conditional` while the accepted A commitment remains unchanged;
- changing A makes B `review_required`; and
- no gate or AoA edge is synthesized;
- `plan-dependency add plan.pert REL_A_B A B --mode planning-only --reason ...`
  plans this exact source record; and
- removing the relation removes the planning edge.

## PAS-007: Execution-only dependency

Execution graph:

```text
A -> B
```

Explicit assurance relation:

```pert
task_relation REL_A_B A -> B:
  mode execution_only
  reason "B waits for A, but its plan is independently fixed"
```

Expected:

- A must still complete before B is structurally ready;
- A is excluded from B's planning inputs;
- changing A does not change B's computed basis through this relation;
- B retains its own source-digest reanalysis and normal execution checks; and
- the relation reason explains why ordering does not imply plan coupling;
- removing the explicit relation falls back to default `both`; and
- removing the execution dependency while this relation remains is invalid.

## PAS-008: Planning-cycle rejection

Execution graph:

```text
A -> B
```

Explicit assurance relation:

```pert
task_relation REL_B_A B -> A:
  mode planning_only
  reason "A's plan is also declared conditional on B"
```

Expected:

- the AoA graph remains structurally acyclic;
- the effective planning graph contains `A -> B -> A`;
- assurance hashing does not begin;
- a deterministic cycle witness is returned; and
- no seal candidate is available.

## PAS-009: Conformant completion preserves the commitment

A finishes with explicit outcome evidence declaring conformance against the
exact assurance basis under which it ran.

Expected:

- lifecycle status and finish-event fields remain excluded from A's plan hash;
- the conformant outcome exports the same A assurance commitment;
- B's computed basis remains equal to its accepted basis; and
- no replan action is introduced by the ordinary completion.

## PAS-010: Changed or unavailable completion invalidates descendants

Variant 1 records that A's delivered outcome differs from its accepted plan.
Variant 2 finishes A without assurance-compatible outcome evidence.

Expected:

- Variant 1 makes B and its planning descendants `review_required` with direct
  cause `changed_outcome` at A;
- Variant 1 exports a versioned commitment over A's basis and canonical changed
  outcome rather than one generic status value;
- Variant 2 makes the same closure `unavailable` rather than guessing
  conformance from `done`, event time, or Git time;
- an outcome assessment bound to an old basis after the completed producer plan
  is edited is also unavailable until reviewed correction;
- neither variant rewrites the plan automatically; and
- an already active descendant is reported as `active_attention_required`, not
  automatically suspended or cancelled.

## PAS-011: Replan and reseal the affected closure

After PAS-005, the author revises B, determines that C remains valid without a
content edit, and supplies a human reason for C's hash-only reacceptance.

Expected:

- the reseal preview names A as root cause and B/C as the affected closure;
- B's changed semantic fields and C's hash-only reacceptance are distinct;
- accepted bases are rebuilt in topological order in one candidate;
- a known changed-outcome commitment from PAS-010 becomes an accepted planning
  input after this reseal and does not keep B/C permanently invalid;
- persistent reseal uses fresh authority for that exact candidate;
- an assertion or decision from the prior task edit is not reused; and
- a fresh verification and Next result succeed after the write.

## PAS-012: Partially unsealed added branch

A sealed plan gains a new task X and a planning-dependent successor Y while an
independent branch E remains unchanged.

Expected:

- coverage is `partial`;
- X and Y are `unsealed` and withheld;
- E retains its verified state and start authority;
- the tool does not silently fill X or Y hashes; and
- resealing may target the exact new affected closure.

## PAS-013: Assurance-preserving advance

Before advance, completed A supplies a known planning commitment to retained B.
It may be conformant, or it may have a changed-outcome commitment that B has
already accepted through PAS-011. Advance removes A from the current AoA graph.

Expected:

- the candidate creates a frontier receipt for A because B still consumes its
  commitment;
- the receipt self-hash matches its canonical semantic content;
- the receipt retains B's effective pre-advance planning mode, whether it came
  from default `both` or explicit `planning_only`;
- a known changed outcome may cross the frontier only after B has accepted that
  exact commitment;
- B's computed basis is byte-identical before and after contraction;
- the receipt is retained only while a current/future consumer needs it;
- the destructive bytes still pass the independent history-safety guard; and
- `--force-history-loss` cannot bypass assurance verification.

## PAS-014: Broken receipt and editable-hash boundary

Variant 1 removes or changes a required frontier receipt. Variant 2 directly
edits a task and its accepted hash together outside the tool-mediated workflow.

Expected:

- Variant 1 makes affected tasks `unavailable` and withholds new starts;
- Variant 1 includes a missing or mismatched receipt self-hash as well as a
  changed required commitment;
- an unknown hash-model identity also returns `unavailable`;
- Variant 2 is not claimed to be malicious-tamper detection because both source
  and commitment share one editable trust boundary;
- tool-mediated reseal remains governed and preview-first; and
- digital signatures or an external root of trust remain separate future
  security work.
