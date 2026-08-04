# Conditional Plan Assurance Contract

- Status: Normative target 1.0
- Plan-assurance model target: 1
- Hash model target: 1
- Runtime status: Internal hash/state, Grammar 6 source, governed mutation,
  and assurance-authority Cores implemented; public runtime not activated
- Current compatibility boundary: Grammar 1 through 5 and CLI Contract 6 remain
  unchanged
- Source and public interface target: [Grammar 6 and CLI Contract 7](plan-assurance-interface.md)
- Requirements: [../requirements.md](../requirements.md)
- Active DSL grammar: [dsl-grammar.md](dsl-grammar.md)
- Backlog: [`ASSURE-001`](../backlog.md#assure-001-add-conditional-plan-assurance)
- Normative examples: [../examples/plan-assurance.md](../examples/plan-assurance.md)

## 1. Purpose

This contract defines a deterministic, local plan-assurance model for detecting
when a task plan no longer has the planning basis against which it was last
reviewed. It adds a planning-dependency DAG alongside the existing
Activity-on-Arrow execution DAG without replacing readiness, lifecycle,
resource, recommendation, governance, or actuals semantics.

The model uses versioned SHA-256 commitments over canonical semantic task-plan
records and their planning predecessors. A changed upstream plan propagates a
different computed basis through its planning descendants. A task whose
computed basis differs from its last explicitly accepted basis requires
replanning and resealing before it can regain normal new-start authority.

This is a content-integrity and freshness mechanism. It is not a blockchain,
digital signature, authenticated approval, proof that a plan is correct, or
proof that completed work met its requirements.

## 2. Normative precedence and boundaries

Resolve conflicts in this order:

1. Must requirements in `docs/requirements.md`;
2. this contract;
3. the [Plan Assurance Interface Contract](plan-assurance-interface.md) for
   Grammar 6 source, CLI Contract 7, result, diagnostic, and governance shape;
4. [DSL Grammar](dsl-grammar.md) for the active Grammar 1 through 5 lexical,
   syntax, source-span, and compatibility boundary;
5. [Graph Semantics](graph-semantics.md) for AoA execution dependencies,
   reachability, and advance;
6. [Recommendation Semantics](recommendation.md) for lifecycle,
   recommendation tiers, and reanalysis;
7. [Project Actuals and Git History](project-actuals.md) for work events and
   actual evidence;
8. [Advance History Safety](advance-history-safety.md) for destructive Git
   proof;
9. [Governance Authority](governance-authority.md) and the
   [Governance Interface](governance-interface.md) for persistent authority;
10. [Mutation Semantics](mutation.md) and safe-write contracts; and
11. `docs/basic-design.md`, examples, tests, help, and implementation.

Plan assurance is a fourth decision axis. It MUST NOT be represented as task
`status`, `blocked_reason`, structural readiness, resource feasibility, or a
recommendation tier. A task may be structurally ready and recommended while
its plan assurance withholds new-start authority.

Recommendation ranking version 1 remains a raw priority decision. A future
versioned authority projection may filter its startable set using assurance,
as temporal authority already filters a raw recommendation without silently
reranking it.

## 3. Terms

### 3.1 Execution dependency

An **execution dependency**, also called a task dependency in user-facing
planning discussion, is derived from the AoA graph. For tasks `a` and `b`,
`a` is a direct projected execution predecessor of `b` when a directed path
from `dst(a)` to `src(b)` contains only zero-duration gates. A path containing
another task is not direct; transitivity follows through that task.

This projection does not add task-to-task edges to the authoritative AoA DAG.
It is a view used to establish the default planning-dependency relation.

### 3.2 Planning dependency

A **planning dependency** from task `a` to task `b` means that the reviewed plan
for `b` is conditional on the versioned plan assurance exported by `a`.
Planning dependencies affect plan assurance but do not by themselves affect
milestone reachability, structural readiness, PERT/CPM, resource scheduling,
or task status.

### 3.3 Plan contract

A **task plan contract** is the closed, versioned semantic projection of one
task used as the task's own plan commitment. It excludes lifecycle and actual
evidence so ordinary execution does not change the commitment.

### 3.4 Computed and accepted basis

The **computed basis hash** is derived from the current task plan contract and
the current assurance commitments of the task's effective planning
predecessors. The **accepted basis hash** is the value explicitly accepted at
initial sealing or after replanning.

The accepted seal also retains the accepted task contract hash and ordered
planning-input commitments. This component snapshot is the minimum evidence
needed to distinguish a direct task-contract change, a direct relation change,
and an inherited predecessor change without retaining old task prose.

Recomputation is read-only. Updating an accepted basis is a separate governed
mutation and MUST NOT happen implicitly because a computed value changed.

### 3.5 Seal and reseal

An **initial seal** atomically establishes accepted bases for an enabled but
unsealed plan. A **reseal** explicitly accepts newly computed bases after the
affected plan closure has been reviewed or changed. These operations create
hash commitments; they are not cryptographic signatures.

### 3.6 Frontier receipt

A **frontier assurance receipt** is the smallest retained semantic record that
preserves the assurance commitment of a removed predecessor across
`dag advance`. It supports the current and future plan and is not a general
historical ledger.

## 4. Three dependency modes

Every effective pair of related tasks has exactly one of the following modes.

| Mode | Execution dependency | Planning dependency | Meaning |
| --- | --- | --- | --- |
| `both` | yes | yes | Default: execution order and plan assurance both depend on the predecessor |
| `planning_only` | no | yes | The predecessor affects planning confidence without delaying structural readiness |
| `execution_only` | yes | no | Execution order is required, but the successor plan is declared independent of predecessor plan changes |

Absence of both relations means no dependency and has no declaration mode.

### 4.1 Default derivation

For every direct projected execution predecessor pair, the effective mode is
`both` unless an explicit assurance relation changes it to
`execution_only`. This makes the planning-dependency DAG equal to the projected
task-dependency DAG by default.

An explicit `planning_only` relation adds a planning edge where no projected
execution edge exists. It does not synthesize a gate, milestone, or task edge.

An explicit `both` record pins the default meaning for source clarity. Its
effective graph and hash semantics are the same as omission, but
source-preserving formatting and mutation MUST retain the explicit record. If a
later candidate removes the projected execution dependency while the pin
remains, that candidate is invalid until the relation is atomically changed to
`planning_only` or removed. Removing the explicit pin while the projected
execution dependency remains falls back to implicit `both` and does not change
the computed basis.

### 4.2 Relation record

The semantic source model for an explicit relation is:

```ts
interface PlanDependencyRelationV1 {
  readonly id: string;
  readonly predecessorTaskId: string;
  readonly successorTaskId: string;
  readonly mode: "both" | "planning_only" | "execution_only";
  readonly reason: string | null;
}
```

The DSL declaration and its maintenance command mapping are fixed in Sections
4.4 and 4.5. The interface contract selects Grammar 6, model, seal, outcome,
receipt, result, and activation boundaries. `task_relation` MUST NOT be added
to Grammar 5 or CLI Contract 6 outside that atomic cutover.

Validation rules:

- both endpoints refer to distinct tasks in the same project;
- relation IDs share the global document ID namespace;
- `planning_only` requires no direct projected execution dependency;
- `execution_only` requires a direct projected execution dependency;
- explicit `both` requires a direct projected execution dependency;
- duplicate semantic pairs are invalid;
- the effective planning-dependency graph is acyclic; and
- a relation `reason` is required for `planning_only` and `execution_only`.

The reason is a human explanation. It is excluded from the hash projection so
wording changes do not invalidate plans. Mode and endpoints are hash inputs.

### 4.3 Planning cycles

AoA acyclicity does not prove planning-dependency acyclicity. For example, an
execution path `A -> B` combined with a `planning_only` relation `B -> A`
creates an invalid assurance cycle even though the AoA graph itself remains a
DAG. Assurance analysis MUST fail before hashing when its effective planning
graph is cyclic and MUST return a deterministic cycle witness.

### 4.4 Target source declaration

The accepted source target uses one top-level `task_relation` declaration with
a stable relation ID and task-ID endpoints:

```pert
task_relation REL_A_B A -> B:
  mode planning_only
  reason "B uses A's findings but may start before A finishes"
```

The target grammar fragment is:

```ebnf
TaskRelationDecl = "task_relation", HSPACE, Identifier,
                   HSPACE, Identifier, HSPACE, "->", HSPACE, Identifier,
                   ":", NEWLINE,
                   INDENT, TaskRelationField,
                   { NEWLINE, TaskRelationField }, DEDENT ;

TaskRelationField = TaskRelationModeField | TaskRelationReasonField ;
TaskRelationModeField = "mode", HSPACE,
                        ( "both" | "execution_only" | "planning_only" ) ;
TaskRelationReasonField = "reason", HSPACE, String ;
```

The header fields are relation ID, predecessor task ID, and successor task ID
in that order. The body contains exactly one `mode` and zero or one `reason`.
`reason` is required and must decode to a nonempty string for
`execution_only` and `planning_only`; it is optional for `both`. Unknown or
duplicate fields are invalid. The ordinary indentation, string, comment,
UTF-16 span, recovery, and leading-comment ownership rules apply.

`task_relation`, `mode`, `both`, `execution_only`, and `planning_only` are
contextual only in the future grammar positions above. They MUST NOT expand the
Grammar 1 through 5 global reserved-ID set. The selected future grammar must
share the relation ID with the existing global document ID namespace and
resolve both endpoints only to tasks.

Canonical field order is `mode`, then `reason`. Source-preserving formatting
retains a user's explicit `both` declaration and declaration location.
Canonical insertion places a new relation after task/gate declarations and
before the first `work_event`; when no work event exists, it follows the last
task/gate or prior `task_relation`. Multiple relations created by one request
use relation-ID order. The interface contract places seal, outcome, and receipt
records after relations and before work events.

Arrow spelling does not encode the mode. `->` always gives the declared
predecessor-to-successor orientation inside `task_relation`; the required
`mode` field carries the semantic distinction. `=>`, `.>`, and other arrow
aliases are not accepted by this target.

### 4.5 Target maintenance command mapping

The Grammar 6 and CLI Contract 7 cutover exposes relation maintenance through the
user-facing `plan-dependency` resource:

```text
perttool plan-dependency add <file> <id> <predecessor-task> <successor-task>
  --mode both|execution-only|planning-only [--reason <text>]

perttool plan-dependency set <file> <id>
  [--predecessor <task-id>] [--successor <task-id>]
  [--mode both|execution-only|planning-only]
  [--reason <text> | --clear reason]

perttool plan-dependency remove <file> <id>
```

The explicit mapping is:

| Concern | Source / JSON | CLI |
| --- | --- | --- |
| declaration keyword | `task_relation` | resource `plan-dependency` |
| operation | `plan_dependency.add|set|remove` | action `add|set|remove` |
| default mode | `both` | `both` |
| execution-only mode | `execution_only` | `execution-only` |
| planning-only mode | `planning_only` | `planning-only` |

These are typed preview-first mutations with the existing diff, separate
output, expected-digest, governance, warning, and safe-write controls. They
validate only the complete candidate. Atomic batch accepts the same three
request kinds so a task/gate edit and relation-mode conversion do not need to
produce an invalid intermediate graph.

The commands never synthesize, remove, or reconnect an AoA task, gate, or
milestone. Converting `both` to `planning_only` requires removal of the
projected execution dependency in the same final candidate; converting
`planning_only` to `both` or `execution_only` requires adding that dependency.
Removing explicit `execution_only` falls back to implicit `both` while the
execution dependency remains. Removing explicit `planning_only` removes that
planning edge. Removing explicit `both` retains implicit `both` while the
execution dependency remains.

The interface contract fixes exact result identities, diagnostics, help
projection, batch request envelopes, and CLI Contract 7. Current command
discovery MUST NOT advertise `plan-dependency` before the atomic activation
gate.

## 5. Task plan contract hash

### 5.1 Algorithm identity

Hash model 1 uses:

```text
algorithm       = SHA-256
encoding        = UTF-8
digest spelling = sha256:<64 lowercase hexadecimal digits>
contract domain = Perttool.TaskPlanContract.v1
basis domain    = Perttool.TaskPlanBasis.v1
outcome domain  = Perttool.TaskOutcomeCommitment.v1
changed outcome = Perttool.ChangedTaskOutcomeContract.v1
receipt domain  = Perttool.FrontierAssuranceReceipt.v1
```

Each domain identifier is part of the hashed payload. A different field set,
canonicalization rule, dependency recurrence, outcome rule, or hash algorithm
requires a new model identity. Unknown identities are unavailable, never
best-effort compatible.

### 5.2 Canonical semantic projection

`TaskPlanContract.v1` is a closed object with fields in this order:

```text
model
task_id
from_milestone_id
to_milestone_id
title
description
duration_or_estimate
not_before
deadline
priority
requirements
owner
tags
source
```

Rules:

- absent optional scalar fields project as `null`;
- Duration and Estimate components project as exact reduced numerator,
  denominator, and unit records rather than display decimals;
- requirements are sorted by resource ID and contain exact integer units;
- tags are sorted by decoded Unicode scalar sequence because they are a set;
- strings use their decoded values without Unicode normalization;
- object keys follow the closed order above, arrays follow their stated
  semantic order, and canonical JSON has no insignificant whitespace; and
- source offsets, comments, declaration order, line endings, BOM, quoting,
  and formatter trivia are absent.

Canonical JSON uses RFC 8259 object, array, string, number, boolean, and null
syntax with the fixed object-key order above. It emits decoded non-control
Unicode scalar values directly as UTF-8, escapes quotation mark and reverse
solidus, uses `\b`, `\t`, `\n`, `\f`, and `\r` for those controls, uses
lowercase `\u00xx` for every other U+0000 through U+001F value, emits no solidus
escape or insignificant whitespace, and rejects lone surrogates. Exact
Rational components are canonical base-10 strings with no leading plus or zero
padding; zero is `"0"` and denominators are positive. Scalar integer fields
such as priority and resource units are safe JSON integers in ordinary
base-10 form.

The task contract hash is exactly:

```text
C(t) = SHA256(UTF8(canonical_json(TaskPlanContract.v1(t))))
```

Hash model 1 deliberately treats changes to the listed plan fields as plan
changes, including exact duration/estimate, owner, priority, and tags. A later
aspect-specific model may narrow dependencies, but MUST NOT silently change
model 1.

Project snapshot fields, milestone metadata other than the task endpoint IDs,
and referenced resource capacity are not ambient inputs to model 1. Their
existing temporal, deadline, resource, and recommendation projections still
recompute and may independently withhold start authority. A future assurance
model that commits to those facts requires a new field set and model identity.

### 5.3 Excluded lifecycle and derived data

The following MUST NOT enter `TaskPlanContract.v1` or the task's own basis
payload:

- task `status`;
- `blocked_reason`;
- milestone stored/effective state;
- work events, event IDs, times, `planned_value`, active time, effort, and
  suspension reasons;
- `ready`, active, blocked, upcoming, runnable, critical, float, schedule,
  recommendation, or start-authority projections;
- source/candidate whole-document digests;
- accepted or computed assurance hashes and derived assurance status; and
- caller assertions, governance decisions, Git revisions, or wall-clock time.

Consequently, a lifecycle mutation changes the complete source digest and
makes an old Next result stale, but does not by itself change the plan contract
or assurance chain.

## 6. Hash recurrence and verification

Let `P(t)` be the sorted effective planning predecessors of task `t`. Sort by
predecessor task ID; duplicate semantic pairs are already invalid. Let `C(t)` be the task plan contract
hash. Let `A(p)` be the current exported assurance commitment of predecessor
`p`, or a retained frontier receipt commitment after `p` is advanced away.

```text
computed_basis(t) = SHA256(canonical_json({
  model: "Perttool.TaskPlanBasis.v1",
  task_contract_hash: C(t),
  planning_inputs: [
    { predecessor_task_id, relation_mode, assurance_hash: A(p) }, ...
  ]
}))
```

Because the planning graph is a DAG, compute all bases once in stable
topological order. Full recomputation is `O(T + R)`, where `T` is the number of
tasks and `R` the number of effective planning relations, excluding hash input
byte length. Incremental descendant-closure caching is optional and MUST return
the same values as a full pass.

The exported assurance commitment of a task is its computed basis while the
task is unfinished. A completion assessment is usable only when its
`against_basis_hash` equals both the task's accepted basis and current computed
basis. If a completed task plan is later edited without a matching reviewed
outcome correction, the task is `review_required` and exports no trustworthy
completion commitment to consumers. On a usable completion assessment:

- a conformant outcome bound to that exact basis exports the same commitment;
- a changed outcome with a known canonical outcome-contract hash exports:

  ```text
  SHA256(canonical_json({
    model: "Perttool.TaskOutcomeCommitment.v1",
    task_id,
    against_basis_hash,
    changed_outcome_contract_hash
  }))
  ```

  Hash model 1 defines that nested contract as the closed object
  `{ model: "Perttool.ChangedTaskOutcomeContract.v1", summary }`, using the
  decoded nonempty summary and the same canonical JSON rules. The resulting
  commitment initially requires replanning downstream;
- missing or unavailable conformance evidence exports no trustworthy
  commitment and makes affected downstream assurance unavailable; and
- status alone MUST NOT be treated as conformance evidence.

The interface contract defines the closed changed-outcome summary commitment,
basis-bound source record, correction behavior, and caller authority for
`conformant`, `changed`, and unavailable outcome evidence. The current Grammar
5 finish event does not provide it. A changed commitment invalidates
existing consumer bases once; after those consumers are replanned and resealed
against that exact known commitment, it is an accepted planning input and MUST
NOT keep them permanently `review_required`.

## 7. Assurance states and start authority

### 7.1 Project coverage

| Coverage | Meaning |
| --- | --- |
| `not_enabled` | No assurance-model declaration; current Grammar 1 through 5 behavior remains unchanged |
| `unsealed` | Model enabled, but no complete initial accepted baseline exists |
| `partial` | Some current/future tasks lack accepted bases or required receipts |
| `complete` | Every assurance-applicable current/future task has a known accepted basis |

Initial sealing MUST be atomic. A new task with no accepted basis is
`unsealed`. Existing planning descendants retain their prior accepted bases and
become `review_required` when the new task or relation changes their computed
bases; their hashes are not deleted or silently replaced. New descendant tasks
without accepted bases are also `unsealed`, and unaffected branches retain
their prior assurance.

### 7.2 Task state

| State | Meaning | Normal new-start authority |
| --- | --- | --- |
| `not_applicable` | Assurance not enabled | unchanged compatibility behavior |
| `unsealed` | No accepted basis | withheld |
| `conditional` | Hashes match; at least one planning predecessor remains unfinished | permitted subject to existing authority |
| `verified` | Hashes match and every required predecessor outcome commitment or frontier receipt is known | permitted subject to existing authority |
| `review_required` | Direct or inherited computed/accepted mismatch, including a consumer mismatch caused by a changed outcome | withheld |
| `unavailable` | Unknown model, missing receipt, or insufficient conformance evidence | withheld |

Outcome assessment is a separate projection with `unfinished`, `conformant`,
`changed`, and `unavailable` values. A completed producer with a known
`changed` outcome exports its changed-outcome commitment; the producer outcome
is not itself relabeled as task-assurance `review_required`. Existing consumers
become `review_required` because their computed bases no longer equal their
accepted bases. After reseal, those consumers may again become `verified` while
the producer outcome remains truthfully `changed`.

`conditional` does not create an execution dependency. Therefore a
`planning_only` successor may remain structurally ready and startable while
its plan is explicitly conditional on an unfinished predecessor. A `both`
relation already delays structural readiness through the execution DAG.

An active task that becomes `review_required` or `unavailable` is reported as
`active_attention_required`. The tool does not automatically suspend, cancel,
undo, or rewrite active work.

### 7.3 Cause chains

Every non-verified result returns:

- direct cause kind;
- first changed or unavailable predecessor/task/receipt;
- direct versus inherited classification;
- at least one complete stable path from the direct cause to the affected
  task;
- accepted and computed full hashes in JSON; and
- short hashes only as supplemental human-readable identity.

Direct-versus-inherited classification compares the current task contract and
ordered planning inputs with the accepted seal components. It MUST NOT guess a
semantic cause from the opaque accepted basis alone. A stored accepted basis
that does not reproduce from those accepted components is unavailable.

Human output MUST lead with changed semantic fields, relation changes,
affected tasks, and required action. It MUST NOT ask a human to approve an
opaque hash alone.

### 7.4 Required actions

The closed action vocabulary is:

| Kind | Root task IDs | Affected task IDs | Meaning |
| --- | --- | --- | --- |
| `initial_seal` | empty | complete current/future task set | Establish the first atomic accepted baseline |
| `replan_and_reseal` | stable direct mismatch or newly unsealed roots | complete affected planning closure | Review or revise the affected plans, then explicitly accept their new bases |
| `restore_assurance_evidence` | first unavailable model, task, outcome, or receipt roots | unavailable closure | Repair or supply required evidence before a later reseal can succeed |

Every action record contains `kind`, `root_task_ids`, and
`affected_task_ids`. IDs are unique and lexicographically ordered. These
records are emitted in the table order when more than one action applies;
`initial_seal` excludes `replan_and_reseal`. Actions are read-only
control-plane projections. They do not create AoA tasks, edit lifecycle state,
accept a computed hash, or confer persistent mutation authority.

## 8. Replanning and resealing

Hash verification is read-only and automatic in assurance-aware check,
analysis, next, mutation-impact, and advance planning. It never updates an
accepted hash.

A mismatch produces a control-plane action rather than inventing a new AoA
task:

```text
required_action = replan_and_reseal
root_causes     = stable direct mismatch IDs
affected_tasks = stable planning-descendant closure
```

Replanning may change task plans and relations, or may conclude with a stated
reason that a downstream plan remains valid without content changes. Resealing
then:

1. revalidates both execution and planning DAGs;
2. recomputes the complete affected closure in topological order;
3. refuses unknown algorithms, missing receipts, cycles, or unresolved outcome
   evidence, while permitting an explicitly known changed-outcome commitment
   to be accepted by the affected downstream closure;
4. previews exact old/new accepted hashes, changed semantic fields, dependency
   modes, direct causes, affected tasks, byte sizes, diff counts, and source
   and candidate digests;
5. creates one source-preserving, candidate-validated mutation;
6. requires fresh persistent authority for the exact candidate; and
7. after writing, reruns assurance verification and obtains a fresh Next
   result.

A reseal with no task-plan edit requires a nonempty human reason because it is
an explicit judgment that the new upstream basis does not require a downstream
content change.

Changing enablement, dependency mode, accepted basis, receipt, outcome
conformance, or seal model changes task-start authority. Governance interface
2 classifies it in the distinct `plan_assurance` affected scope governed by the
effective pre-change DAG owner. It is not ordinary status maintenance. Existing
single-candidate preview, owner-assertion, expected-digest, race, and safe-write
rules remain applicable.

Direct source editing can replace both a task and its accepted hash. Therefore
model 1 prevents accidental or unreviewed tool-mediated continuation but does
not claim malicious-tamper resistance. Authenticated signatures or an external
root of trust belong to the separate strict-governance design.

## 9. Next-task UX

Assurance-aware Next retains raw recommendation facts and adds a versioned
assurance authority projection. A raw recommended task that is `unsealed`,
`review_required`, or `unavailable` remains visible as the project's current
priority but is absent from startable authority.

The result includes at least:

```text
assurance.model_version
assurance.hash_model_version
assurance.coverage
assurance.task_results
assurance.direct_mismatch_task_ids
assurance.inherited_mismatch_task_ids
assurance.replan_required_task_ids
assurance.active_attention_required_task_ids
assurance.required_actions
authority.startable_recommended_task_ids
```

Unrelated verified branches remain eligible. The producer does not promote a
lower-ranked task merely because a recommended task requires replanning unless
a separately versioned recommendation policy explicitly does so.

The existing `Perttool.NextResult.v5` schema and temporal authority policy do
not gain these fields. Public activation requires a new closed result identity,
known policy identity, complete schema, complete trace, help, Guide, package,
and safe-stop migration.

## 10. Advance as assurance-preserving contraction

Assurance-disabled documents retain current `dag advance` behavior.

For an enabled plan, advance computes assurance over the original graph, plans
normal graph removal, and materializes frontier receipts for every removed task
commitment still required by a retained planning descendant. A receipt contains
at least:

```ts
interface FrontierAssuranceReceiptV1 {
  readonly model: "Perttool.FrontierAssuranceReceipt.v1";
  readonly receiptHash: string;
  readonly producerTaskId: string;
  readonly producerTaskContractHash: string;
  readonly producerAssuranceHash: string;
  readonly outcome: "conformant" | "changed";
  readonly consumers: readonly {
    readonly consumerTaskId: string;
    readonly relationMode: "both" | "planning_only";
  }[];
  readonly sourceMilestoneId: string | null;
}
```

`receiptHash` is SHA-256 over the canonical receipt object in the displayed
field order with `receiptHash` omitted. Consumers are sorted by consumer task
ID and have no duplicates. A receipt whose stored hash does not match its
canonical semantic content is unavailable. The receipt self-hash detects
accidental record damage; it does not add an external root of trust.

Grammar 6 encodes receipts as top-level machine-managed `assurance_receipt`
records. Receipts are retained only while a
current/future task consumes them and are removed with that last dependency.
Each consumer entry retains the effective pre-advance planning mode because a
removed projected `both` edge and a removed explicit `planning_only` edge can
otherwise become indistinguishable after the producer leaves the AoA graph.
`execution_only` has no planning input and therefore creates no receipt.

For every retained task `t`, a normal assurance-aware advance MUST prove:

```text
computed_basis_before_advance(t) == computed_basis_after_advance(t)
```

The candidate is blocked when a required cross-frontier commitment is
unsealed, review-required, unavailable, missing, or changed by the contraction.
A known changed-outcome commitment may cross the frontier only when every
retained consumer has already accepted that exact commitment, which is proved
by the retained-task basis equality check. A mismatch wholly contained in
removed past work and consumed by no retained task does not block advance.

Receipt insertion and removed-source edits are one candidate. The existing
advance history guard still proves destructive raw bytes; assurance proves
future planning-basis preservation. `--force-history-loss` bypasses neither
assurance verification nor reseal authority. A future assurance force option,
if any, requires a separate requirement and MUST NOT reuse the history-loss
spelling.

Git remains optional for assurance verification. The exact pre-advance source
remains durable in Git under the existing procedure, but normal current-plan
verification consumes the retained receipt rather than reconstructing removed
tasks from Git.

## 11. Compatibility and activation

- Grammar 1 through 5 documents with no assurance model remain byte-compatible
  and retain their current results and start authority.
- Enabling assurance is an explicit, preview-first, atomic initial-seal
  mutation; omission never silently enables it.
- An enabled but unsealed or partially sealed plan is analyzable for replanning
  but fails closed for affected new starts.
- Unknown assurance/hash versions and incomplete projections are unavailable.
- The selected Grammar 6 and CLI Contract 7 interface remains unavailable in
  the active CLI, help, Guide, package exports, schemas, and installed behavior
  until the coordinated runtime cutover.
- Publication, plan advance, Issue mutation, and release-channel changes remain
  separate authorization boundaries.

## 12. Non-goals for model 1

- probability scores or statistical confidence;
- proof that a plan is correct, complete, optimal, or commercially suitable;
- digital signatures, distributed consensus, proof of work/stake, replicated
  ledgers, or cryptocurrency semantics;
- malicious-edit prevention when all source and hashes are editable together;
- automatic creation of replacement tasks, dependencies, estimates, or plans;
- automatic cancellation, suspension, rollback, or rework of active tasks;
- storing complete historical plans or work events in the current document;
- cross-project or macro/detail assurance composition;
- aspect-specific dependency hashes; model 1 hashes the complete closed task
  plan contract; and
- a release version, release plan, publication, or channel change; the public
  Grammar 6 and CLI Contract 7 interface is selected independently of release.

## 13. Acceptance cases

The normative examples define dependency-ordered cases `PAS-001` through
`PAS-014`. The complete implementation is not accepted until those cases have one
machine-readable fixture and complete Core, CLI, schema, help, temporary-link,
package, installed-package, advance, governance, and compatibility evidence.

At minimum, acceptance proves:

1. assurance-disabled compatibility;
2. atomic initial sealing and unsealed fail-closed behavior;
3. default `both`, explicit `planning_only`, and explicit `execution_only`;
4. planning-cycle rejection;
5. status/event/format changes do not change task plan hashes;
6. task plan changes invalidate the exact planning-descendant closure;
7. conformant versus changed/unavailable outcomes, including successful
   downstream reseal against a known changed-outcome commitment;
8. explicit replanning and governed reseal without automatic acceptance;
9. unrelated-branch start authority remains available;
10. advance receipts preserve retained-task bases exactly; and
11. unknown models, missing receipts, direct hash edits, and history-force
    non-bypass fail within their declared boundaries.
