# Owner-Aware Mutation Governance Semantics Specification

- Document status: Normative 1.0
- Governance semantics version: 1
- Created: 2026-07-26
- Requirements: [../requirements.md](../requirements.md)
- Mutation semantics: [mutation.md](mutation.md)
- Governance source: [governance-source.md](governance-source.md)
- Governance interface: [governance-interface.md](governance-interface.md)
- Normative governance examples: [../examples/governance.md](../examples/governance.md)
- Design acceptance: [../process/governance-design-acceptance.md](../process/governance-design-acceptance.md)
- Graph semantics: [graph-semantics.md](graph-semantics.md)
- Mermaid profile: [mermaid-profile.md](mermaid-profile.md)
- Unit migration semantics: [unit-migration.md](unit-migration.md)
- Related issue: [Issue #4](https://github.com/mako10k/perttool/issues/4)

## 1. Purpose and scope

This specification defines the deterministic authority decision for a
tool-mediated write that changes a project goal or DAG. It prevents an
otherwise valid source-preserving mutation from being persisted merely because
the executor was able to construct it.

The protected threat boundary is accidental authority overreach or goal
substitution by a non-malicious executor. A principal ID, actor, delegate, and
owner-confirmation value are caller assertions. They are not authenticated or
verified identities.

This contract fixes:

- the `goal` and `dag` authority scopes;
- classification of actual candidate changes;
- owner, delegate, and owner-confirmation decisions;
- preview and persistent-write behavior;
- authorization against the pre-change document;
- atomic mixed-scope behavior;
- the stable domain diagnostic for a denied write; and
- the boundary with direct editing and existing safeguards.

DSL spelling, field order, omission defaults, and the pre-change source
snapshot belong to the accepted governance source contract. This contract does
not fix a public Core request or result schema, CLI option multiplicity, text
rendering, JSON field layout, or exit codes. Those belong to the governance
[interface contract](governance-interface.md). It also does not activate
runtime enforcement.

## 2. Normative position

Resolve semantic conflicts in the following order:

1. Must requirements in `docs/requirements.md`
2. source syntax and effective-metadata rules in the
   [Governance Source specification](governance-source.md) and DSL Grammar
   specification
3. mutation, graph, import, and unit-migration candidate semantics
4. authority classification and decisions in this specification
5. interface, basic-design, process, example, test, and implementation text

The governance source contract determines how governance values are declared,
how omission produces an effective governance snapshot, and how that snapshot
is bound to the source digest. This specification consumes that snapshot and
does not reinterpret source tokens.

The mutation, advance, and import planners determine whether a candidate is
valid and what changed. This specification classifies that accepted change set
and does not reimplement source editing or graph validation.

## 3. Authority model

### 3.1 Principal assertions

A `PrincipalId` is the opaque, case-sensitive ASCII Identifier form accepted
by the governance source and interface contracts. The initial domain supports
at least `user`, `llm`, and `codex`.

Comparing two principals means exact identifier equality. The Core does not
read an operating-system account, environment variable, Git identity, network
identity, clock, or external approval service.

### 3.2 Effective pre-change snapshot

Authority evaluation receives one valid, immutable pre-change snapshot:

```ts
interface EffectiveGovernance {
  goalOwner: PrincipalId;
  goalDelegates: ReadonlySet<PrincipalId>;
  dagOwner: PrincipalId;
  dagDelegates: ReadonlySet<PrincipalId>;
}
```

When governance fields are omitted, the effective snapshot has `user` as both
owners and empty delegate sets. The Governance Source specification owns the
exact derivation and validation of this value.

The snapshot is bound to the original document digest. A later retry against
different bytes creates a new snapshot and a new authority decision.

### 3.3 Caller assertions

Authority evaluation can receive:

- zero or one caller-asserted `actor`; and
- a set of caller-asserted owner IDs said to have accepted the write.

This specification calls the second value `acceptedOwners`. It is an abstract
semantic set, not the final CLI or JSON shape. Duplicate and syntactically
invalid assertions are request/interface errors and do not create authority.

An owner-confirmation assertion records that the caller says the named owner was
consulted for the affected scopes of the current final candidate. It is not
proof of consultation, workstream authority, session authority, or authority
for another candidate. The loose interface does not encode this conversational
scope; bundled caller guidance therefore starts from an assertion-free preview
and prohibits carrying an assertion to a later command.

### 3.4 Authority scopes

Governance semantics version 1 has exactly two scopes, in canonical order:

1. `goal`
2. `dag`

An implementation MUST NOT silently add ordinary maintenance to either scope.
A later scope requires a requirements and governance-semantics version change.

## 4. Change classification

### 4.1 Classification input

Classify the actual accepted change between a valid original document and its
valid final candidate. Do not classify an invalid candidate, an invalid
original, or an intermediate state of an atomic batch.

A request that produces byte-identical source has no affected authority
scope. A source-only formatter change has no affected authority scope.
Inserting, removing, or changing a declared governance field is governed even
when its resulting effective value equals the omitted default.

### 4.2 `goal` changes

The following actual changes affect `goal`:

- changing `project.finish`;
- inserting, changing, or removing `goal_owner`; and
- inserting, changing, or removing `goal_delegates`.

Changing the title, description, ID, version, `as_of`, duration unit, velocity,
critical epsilon, or target duration does not affect `goal`.

### 4.3 `dag` changes

The following actual changes affect `dag`:

- adding or removing a task declaration;
- adding or removing a gate declaration;
- adding or removing a milestone declaration;
- changing a task `from` or `to` endpoint;
- changing a gate `from` or `to` endpoint;
- inserting, changing, or removing `dag_owner`;
- inserting, changing, or removing `dag_delegates`;
- replacing an existing plan from an imported graph when any task, gate,
  milestone, or task/gate endpoint changes; and
- applying `dag advance` when it removes any task, gate, or milestone.

An advance candidate that changes only milestone state does not affect `dag`.
Graph equivalence and candidate validity do not waive authority for an actual
structural change.

### 4.4 Ordinary maintenance

The following changes do not affect `goal` or `dag` in governance semantics
version 1:

- task title, description, duration, estimate, status, priority, resource
  requirements, task owner, tags, block reason, source, `not_before`, or
  deadline;
- `task finish`;
- gate reason;
- milestone title, description, state, tags, or deadline;
- adding, removing, or changing a resource declaration, including capacity;
- project fields other than `finish` and the four governance fields;
- document formatting; and
- exact unit migration, including a grammar-version change required by that
  migration.

Ordinary maintenance still passes every existing request, parse, semantic,
candidate, optimistic-lock, and safe-write check.

### 4.5 Atomic and mixed changes

The affected scope set for an atomic batch is the union of the scopes of all
actual final-candidate changes. A batch cannot hide a governed change inside
ordinary maintenance.

A batch that changes both `project.finish` and task endpoints affects both
`goal` and `dag`. A batch that changes both owner sets also affects both
scopes. The authority decision is atomic: either every affected scope is
authorized against the original snapshot or no persistent write occurs.

## 5. Decision semantics

### 5.1 Per-scope facts

For each affected scope `s`, derive:

```text
owner(s)     = the effective pre-change owner for s
delegates(s) = the effective pre-change delegate set for s
actor_direct(s) =
  actor is present and
  (actor == owner(s) or actor is in delegates(s))
confirmation_required(s) = not actor_direct(s)
confirmation_satisfied(s) =
  confirmation_required(s) and owner(s) is in acceptedOwners
scope_authorized(s) =
  actor is present and
  (actor_direct(s) or confirmation_satisfied(s))
```

An owner-confirmation assertion never substitutes for the required actor. An
assertion naming a delegate, a future owner, or another scope's owner does not
satisfy `owner(s)` unless the identifiers are exactly equal.

The same accepted owner ID can satisfy both scopes when the effective owners
are equal. When the owners differ, `acceptedOwners` must contain each required
owner that the actor does not directly represent.

### 5.2 Preview

Preview, diff, and JSON preview evaluate and report the authority facts but do
not require authority to be established.

- No actor is required for preview.
- With no actor, `confirmation_required` is true for every affected scope.
- With an owner or delegate actor, it is false for that scope.
- With another actor, it is true and the preview reports whether the matching
  owner assertion is present.
- Missing or mismatched owner confirmation does not make a valid preview fail.
- An ordinary or byte-identical candidate has no affected scopes and an
  authority decision of not applicable.

A preview MUST NOT invent an actor, owner confirmation, or approval event.
The normal loose caller workflow starts each candidate without an accepted
owner assertion. A not-applicable candidate is persisted without one. If a
non-direct governed write needs confirmation, the caller first presents the
operation, affected scopes, required owners, source and candidate digests, and
the concrete structural or goal-change summary. This workflow requirement does
not change the pure version 1 evaluator.

### 5.3 Persistent write

`--write`, an existing-document mutation written through `--out`, and any
future adapter operation that persists an existing document's changed
candidate use the same rule:

1. If no scope is affected, governance authority is not applicable and the
   existing write contract remains unchanged.
2. If one or more scopes are affected, an actor is required.
3. Every affected scope must satisfy `scope_authorized(s)`.
4. If any affected scope is unauthorized, reject the whole write without
   filesystem mutation.

Owner and delegate actors do not need an owner-confirmation assertion for their
scope. Another actor can proceed only when the matching effective pre-change
owner is present in `acceptedOwners`.

### 5.4 Pre-change authority and self-authorization

Every fact in Section 5.1 comes only from the original document snapshot.
Never use an owner or delegate introduced by the candidate to authorize that
same candidate.

For example, with pre-change `dag_owner=user` and no DAG delegates, a batch
that adds `codex` as a DAG delegate and adds a task is a DAG change. Actor
`codex` is not directly authorized by the new delegate value. The write still
requires caller-asserted acceptance by `user`.

After a successful write, any later command re-reads the document and can use
the newly effective owner or delegates in a new decision.

## 6. Planner and write-path composition

The common processing order is:

1. read and validate the original document;
2. bind its effective governance snapshot to its source digest;
3. validate the request and construct the final candidate;
4. parse and semantically validate the final candidate;
5. classify its actual change set;
6. evaluate authority against the pre-change snapshot;
7. return the candidate and authority facts for preview; or
8. for a persistent write, require every scope to be authorized and then enter
   the existing safe-write path.

Authority evaluation does not make an invalid candidate valid and does not
replace optimistic locking. If the source changes before commit, the write
fails under the existing digest/race rule. A retry re-reads, replans,
reclassifies, and reauthorizes; it MUST NOT reuse the stale decision.

Direct entity commands, atomic batch, existing-document graph replacement,
and advance use the same classifier and evaluator. Adapters MUST NOT maintain
independent command-name allowlists that can drift from the Core change
classification.

`project init --out` and the current `dag import --out` create new documents
and cannot overwrite a pre-change `.pert` plan. They therefore have no
pre-change governance snapshot. New-document creation does not require a
fictional actor or owner confirmation; the created document receives the
governance values and direct-edit warning defined by the accepted source
contract and later interface contract.

This contract does not misrepresent new-document creation as authorization to
replace an existing plan. Any future import route that replaces or derives a
persistent candidate from an existing plan MUST provide that original plan
and evaluate the structural delta as `dag`.

## 7. Stable governance denial

An attempted persistent write that fails Section 5 emits `PTGOV-101` with
severity `error` and performs no filesystem write.

The domain meaning is:

> Required owner-aware write authority was not established against the
> pre-change document.

For each denied scope, the authority result supplies these semantic facts in
canonical scope order:

- `scope`: `goal` or `dag`;
- `required_owner`: the effective pre-change owner;
- `cause`: `actor_required`, `owner_confirmation_required`, or
  `owner_confirmation_mismatch`; and
- the caller-asserted actor, when present.

Use `actor_required` when no actor was supplied. For a non-owner,
non-delegate actor, use `owner_confirmation_required` when no owner assertions
were supplied and `owner_confirmation_mismatch` when assertions were supplied
but omitted the required owner.

The Governance Interface contract fixes one diagnostic with ordered denied
scopes, the exact data and text projections, and exit 1. That projection
retains the facts above and the `PTGOV-101` meaning.

Do not describe `PTGOV-101` as an authentication, identity-verification,
signature, or RBAC failure. Existing `PTDSL-*`, `PTSEM-*`, `PTDAG-*`,
`PTMUT-*`, `PTCNV-*`, and `PTIO-*` causes retain their meanings and are not
wrapped as governance errors.

## 8. Decision examples

Assume this pre-change snapshot:

```text
goal owner: user
goal delegates: [llm]
dag owner: user
dag delegates: [codex]
```

| Change | Mode and assertions | Decision |
| --- | --- | --- |
| `project.finish` | preview, no actor | preview succeeds; goal acceptance is required for a write |
| `project.finish` | write, actor `user` | authorized as goal owner |
| `project.finish` | write, actor `llm` | authorized as goal delegate |
| `project.finish` | write, actor `codex` | denied with `PTGOV-101` |
| `project.finish` | write, actor `codex`, accepted owner `user` | authorized by caller-asserted owner confirmation |
| add a task | write, actor `codex` | authorized as DAG delegate |
| add a task | write, actor `llm` | denied with `PTGOV-101` |
| change finish and add a task | write, actor `codex` | DAG authorized; goal denied |
| change finish and add a task | write, actor `codex`, accepted owner `user` | both scopes authorized |
| update task estimate | write, no actor | governance not applicable |

If the goal owner is `user` and DAG owner is `llm`, actor `codex` changing
both scopes must carry accepted owners `user` and `llm`. A single assertion
cannot be ambiguously treated as both different owners.

## 9. Direct editing boundary

This contract governs only tool-mediated persistence that invokes the common
authority evaluator. A text editor, shell redirection, or another program can
change `.pert` bytes without invoking it.

After a direct edit, perttool treats the valid current document as the source
of truth. It does not infer a prior actor, reconstruct an owner confirmation,
or retroactively claim that the edit was authorized. Git history and human
review remain the mechanisms for inspecting such changes.

Documentation and generated-file comments warn that direct DSL editing
bypasses owner-confirmation checks. The warning is guidance, not technical
enforcement.

## 10. Separation from other authority and scheduling

Owner-aware mutation governance:

- does not alter recommendation ranking, tiers, resource feasibility, temporal
  eligibility, or `startable_recommended_task_ids`;
- is not a recommendation human override and does not implement MIG-08;
- does not add dependency edges, gates, resource requirements, or duration;
- does not create a durable approval or audit ledger;
- does not call Git or an external service; and
- does not weaken parse, semantic, candidate, digest, symlink, race, atomic
  replacement, fsync, or post-write verification rules.

## 11. Acceptance invariants

Implementations and later normative examples MUST establish at least:

1. omitted governance resolves to `user` owners and empty delegates before
   authority evaluation;
2. every operation and field in Section 4 has exactly the stated scope;
3. ordinary maintenance and byte-identical candidates require no actor;
4. governed previews succeed without assertions and report the pre-change
   owner and required acceptance;
5. owner and delegate writes succeed without owner confirmation;
6. another actor is denied without the exact effective owner assertion and
   succeeds with it;
7. goal delegation does not grant DAG authority and DAG delegation does not
   grant goal authority;
8. candidate owner/delegate changes cannot authorize themselves;
9. mixed-scope and atomic-batch decisions use the union of actual changes and
   authorize all scopes or none;
10. advance and existing-document graph replacement cannot bypass DAG
    classification;
11. stale source bytes invalidate the complete decision before persistence;
12. direct editing receives no enforcement claim; and
13. the same original digest, final candidate, mode, actor, accepted-owner set,
    and semantics version produce the same ordered decision; and
14. bundled caller guidance starts each candidate without a loose owner
    assertion, identifies the affected scopes before confirmation, and does
    not reuse that confirmation for another candidate.
