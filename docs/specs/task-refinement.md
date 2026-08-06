# Task Refinement and Assurance Boundary Contract

- Status: Draft 0.1
- Refinement model: 1
- Runtime status: semantic design only; no active DSL, CLI, library, result,
  schema, or persistence surface
- Requirements: [../requirements.md](../requirements.md)
- Existing assurance contract: [plan-assurance.md](plan-assurance.md)
- Backlog: [`MULTI-001`](../backlog.md#multi-001-design-backlog-hierarchy-and-multi-plan-composition)
- Normative design cases: [../examples/task-refinement.md](../examples/task-refinement.md)

## 1. Purpose

This contract defines the smallest honest relationship between one macro task
and a set of detail tasks. It allows a plan to state that the detail tasks are
a declared partition of the macro task without claiming that task prose makes
set membership, exclusion, or coverage mechanically provable.

The default assurance boundary remains at the macro task. Detail tasks describe
how that task is refined, but they do not enter the macro task's plan contract,
planning-basis hash, downstream assurance closure, lifecycle, or schedule.

If a user later wants the detail tasks to participate individually in the
upper assurance graph, that is an explicit assurance-boundary expansion. The
inverse operation contracts an individually assured detail boundary back to
the macro task. Neither transition is implied by the refinement relation.

## 2. Fixed separations

Task refinement is distinct from all of the following:

- the Activity-on-Arrow execution graph;
- the plan-assurance planning-dependency DAG;
- lifecycle and actuals;
- resource requirements and capacity;
- precedence and resource schedules;
- recommendation and start authority; and
- governance and persistent-write authority.

A refinement relation MUST NOT synthesize a task, gate, milestone, execution
edge, planning dependency, seal, outcome, status transition, schedule value,
resource value, recommendation, or authorization decision.

Macro and detail documents remain independently parseable, validatable, and
analyzable. Model 1 does not create a combined schedule and never counts both
the macro task and its details in one schedule. It does not sum child duration,
estimates, resources, effort, or completion into the parent.

## 3. Semantic record

The model contains one n-ary partition relation rather than separate binary
containment, pairwise-disjointness, and coverage records.

```ts
interface TaskReferenceV1 {
  readonly documentRef: string;
  readonly taskId: string;
}

interface TaskRefinementPartitionV1 {
  readonly model: "Perttool.TaskRefinementPartition.v1";
  readonly parent: TaskReferenceV1;
  readonly children: readonly TaskReferenceV1[];
  readonly relation: "partition";
}
```

`documentRef` above is an abstract resolved-document identity. Model 1 does
not select whether a future source interface spells it as a relative path,
URI, project ID plus locator, manifest-local alias, or another form. Project
IDs alone are not assumed to be globally unique.

One partition is identified by its parent reference and has at least two
distinct children. The parent belongs to one macro document, and all direct
children belong to the same detail document, different from the macro
document. Nested refinement uses another partition whose parent is one of
those children; it does not add more documents to the original partition.

Within one resolved composition:

- a parent has at most one active partition;
- a child has at most one direct refinement parent;
- parent and child references resolve to tasks;
- parent and child references are distinct;
- the refinement graph is acyclic; and
- children are a closed, unordered set with deterministic reference ordering
  in machine projections.

These restrictions make model 1 a forest of n-ary partitions. Multiple
parents, overlapping detail views, partial refinement, and arbitrary set
algebra require a later model.

## 4. Partition meaning and proof boundary

For a parent task `A` and children `A1` through `An`, `partition` declares:

```text
scope(A) = disjoint_union(scope(A1), ..., scope(An))
```

This single declaration means all three of the following:

1. every child scope is contained in the parent scope;
2. every pair of child scopes is disjoint; and
3. the child scopes jointly cover the parent scope.

Equivalently, coverage is:

```text
scope(A) - union(scope(A1), ..., scope(An)) = empty
```

The inverse expression, the intersection of the union with the complement of
`A`, proves only that children do not extend outside `A`; it does not prove
that they cover `A`.

Task scope remains an uninterpreted product meaning. The tool can validate the
closed references and forest invariants, but it cannot derive semantic
containment, disjointness, or coverage from task titles or descriptions.
Therefore the relation state is `declared_partition`, not `verified_mece`.
Future authenticated approval could attest to the declaration, but a
signature would still not make semantic MECE mechanically proven.

## 5. Default macro assurance boundary

The default composed view uses only the parent task as the upper assurance
node. The refinement record, child list, child task contracts, detail-source
digest, and detail assurance state do not enter the parent's
`Perttool.TaskPlanContract.v1`, computed basis, accepted basis, or exported
assurance commitment.

Consequently:

- editing a detail task or the partition changes its own source identity but
  does not invalidate the parent or the parent's assurance descendants;
- editing the parent task remains an ordinary plan-contract change and follows
  the existing downstream replan and reseal rules;
- an unavailable detail document or broken refinement reference makes the
  refinement view unavailable but does not suppress or replace the macro
  plan's independent result; and
- no `skip_review`, `no_recheck`, waiver, or equivalent authority bit exists.

The refinement relation may be protected by ordinary source digests,
optimistic locking, governance, and safe-write controls once an interface is
selected. Those protections do not make it an assurance input.

A detail document may use local plan assurance for its own work. That local
assurance remains independent and has no effect on the macro graph until an
explicit boundary expansion is accepted.

## 6. Assurance-boundary expansion

Expansion replaces the parent as an upper assurance node with explicitly
selected child assurance nodes. It is not inferred from `partition`.

An expansion candidate MUST:

1. bind the exact current parent, partition, child set, and source identities;
2. explicitly state every removed and added upper planning relation;
3. remove the parent from the upper assurance boundary without deleting its
   refinement-container identity;
4. add only children with complete, known target assurance commitments;
5. validate the resulting planning-dependency DAG and affected closure;
6. preview all semantic relation and seal changes;
7. reseal the complete affected closure under fresh authority; and
8. persist no intermediate state in which the old boundary is removed but the
   new boundary is incomplete.

The partition does not automatically fan an incoming or outgoing relation out
to every child. The user selects the exact new relation mapping because
different details may depend on different planning inputs.

Refinement model 1 limits expansion to a parent and children that are not
started and have no work events, outcomes, frontier receipts, or other actual
history requiring reassignment. Migration of active or historical evidence is
a separate future contract.

## 7. Assurance-boundary contraction

Contraction replaces individually participating child assurance nodes with
their parent. It retains the partition and the detail plan for navigation and
independent analysis.

A contraction candidate MUST:

1. bind the exact current parent, partition, child set, and source identities;
2. require an explicitly reviewed parent task contract rather than deriving
   parent duration, resources, completion, or plan text from children;
3. identify normalized external planning relations that can be transferred to
   the parent without dropping or inventing a relation;
4. preserve relation mode when transferring a relation;
5. report every residual or conflicting child relation;
6. refuse exact contraction while an unhandled residual exists;
7. remove the children from the upper assurance boundary without deleting
   them from the detail plan;
8. add the parent and the explicit transferred relations;
9. validate and reseal the complete affected closure; and
10. persist the transition atomically.

An implementation may propose structurally common relations, but it MUST NOT
silently generalize a child-only dependency to the whole parent. A user may
choose an explicit changed abstraction in a separate candidate; that candidate
is an ordinary planning-relation change and requires the corresponding review
and reseal.

Model 1 applies the same unstarted and no-historical-evidence restriction as
expansion. Contraction of active or completed details is unavailable rather
than guessed.

## 8. Determinism and round-trip condition

Reference resolution, child ordering, cycle witnesses, normalized relation
sets, residual relation sets, and affected task IDs are deterministic.

For an exact partition transition with no intervening task or relation change,
expansion, contraction, and a second expansion MUST reproduce the same
normalized upper relation mapping. This condition does not require accepted
hash bytes to remain equal across different node boundaries; every transition
still creates fresh, candidate-bound seals.

## 9. Runtime and persistence boundary

This draft selects semantic meaning only. It does not select:

- active `.pert` syntax;
- a composition manifest or relation storage location;
- cross-document locator spelling and relocation behavior;
- a multi-file transaction protocol;
- CLI command names or options;
- public Core, text, JSON, schema, help, or Guide identities;
- a grammar or CLI contract version;
- a migration from current Grammar 6 documents;
- a release version; or
- implementation or publication authority.

Current Grammar 6 and CLI Contract 7 behavior remains unchanged. The existing
plan-assurance contract continues to treat cross-project and macro/detail
assurance composition as a non-goal until a later interface contract and
implementation plan are separately accepted.

## 10. Acceptance cases

The normative examples define `TRF-001` through `TRF-010`. Design acceptance
requires the requirements, this contract, basic design, examples, and
machine-readable case fixture to agree. Runtime acceptance additionally
requires a separately selected source/interface contract, persistence model,
implementation plan, public surface, migration, and installed-package gate.
