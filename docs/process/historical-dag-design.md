# Historical DAG Reconstruction and Git-Ancestry Design Proposal

- Document status: Backlog design proposal 0.1; non-normative and not selected
- Recorded: 2026-08-06
- Baseline HEAD: `2fa8b53622f564d63a5c03621aa06b2e33455adc`
- Backlog: [`HIST-DAG-001`](../backlog.md#hist-dag-001-reconstruct-and-visualize-historical-dags)
- Related current contracts: [Project Actuals and Git History](../specs/project-actuals.md),
  [Graph Semantics](../specs/graph-semantics.md),
  [Analysis](../specs/analysis.md),
  [Editor Protocol](../specs/editor-protocol.md), and
  [Conditional Plan Assurance](../specs/plan-assurance.md)
- Related future proposal: [Semantic Diff, Patch, and Three-Way Merge](semantic-diff-merge-design.md)
- Active source boundary: Grammar 6 and CLI Contract 7
- Proposed implementation: none
- External side effects authorized by this proposal: none

## 1. Purpose

The current `.pert` source represents the present and future. Canonical
`dag advance` therefore removes completed historical topology after an exact
pre-advance snapshot has been committed. A current-document DAG can correctly
contain one milestone even though Git contains the complete progression that
led to that frontier.

This proposal defines a read-only historical DAG model that can reconstruct
that progression without treating one selected Git blob as the complete
history. It separates:

- the requested Git revision that bounds the query;
- the ordered semantic checkpoints reachable through a declared ancestry
  profile;
- explicit actual evidence frozen while each task still exists;
- topology retired by a proven canonical advance;
- invalid or ambiguous continuity gaps; and
- a current snapshot, a proven cumulative lineage DAG, and a timeline of graph
  epochs.

The first implementation slice should support a deterministic first-parent
fold. A later three-way profile may reconcile both merge parents only through
the shared semantic source-control model proposed by `SCM-001`. This document
does not activate either slice, change the current history result, extend the
current editor request, or select a release.

## 2. Confirmed current boundary

The repository already has three intentionally different read-only surfaces.

1. `project history --rev <revision>` resolves one endpoint commit and walks
   path-changing snapshots in first-parent commit order. It reconstructs work
   events and qualified legacy transitions, not historical topology.
2. `dag render` and `Perttool.GraphViewResult.v1` analyze one complete current
   source. The editor request accepts no path, Git ref, commit, or source text.
3. `SCM-001` proposes whole-document semantic diff, patch, and conservative
   base/ours/theirs merge. It explicitly must not repurpose the first-parent
   actuals reducer as a merge engine.

These boundaries remain correct. Historical DAG reconstruction should reuse
their lower-level parser, validator, analysis, Git-port, actuals-reduction, and
future semantic-delta capabilities while owning a distinct result and
continuity model.

## 3. Goals and non-goals

### 3.1 Goals

The selected design must eventually support:

1. one repository-relative `.pert` path and one exact resolved endpoint
   commit;
2. deterministic chronological inspection of every relevant snapshot in the
   selected ancestry profile;
3. independent classification of raw-source, grammar, semantic, assurance,
   evidence, and topology validity;
4. stable actual-event deduplication and conflict handling identical to the
   accepted actuals contract;
5. proof that a removal is the result of one canonical advance before
   rehydrating removed topology into cumulative lineage;
6. explicit continuity gaps rather than inferred changes across invalid or
   unavailable snapshots;
7. separate snapshot, lineage, and timeline views;
8. exact Git/blob/source bindings for every navigable declaration;
9. four analysis modes that remain orthogonal to the selected historical view;
10. first-parent mainline reconstruction without implying branch-union
    completeness; and
11. a later three-way profile that compares unique-base, ours, theirs, and the
    recorded merge result without guessing across conflicts.

### 3.2 Non-goals

The first design does not aim to:

- keep an unbounded historical ledger in the current `.pert` source;
- interpret commit author or committer time as actual occurrence time;
- repair, format, or write an invalid historical blob;
- infer task, milestone, event, or declaration renames;
- treat a syntactically valid source as semantically or assurance-valid;
- silently skip an invalid snapshot and claim exact transition continuity;
- flatten every graph epoch into one graph and then claim that its cycles or
  paths existed at one time;
- search reflogs, unreachable objects, arbitrary renames, every repository
  path, or every branch by default;
- stage, commit, checkout, reset, merge, rebase, update a ref, alter the index,
  install a merge driver, or change Git configuration;
- add Git access to the active `perttool/graphView` request;
- make historical reconstruction a governance assertion, plan-assurance
  acceptance, start authority, or safe-write proof; or
- select a CLI spelling, public result identity, package export, Grammar/CLI
  version, implementation plan, release, or publication operation.

## 4. Query and ancestry terminology

The design uses explicit terms to avoid overloading "start", "end", and
"ancestor".

| Term | Meaning |
| --- | --- |
| requested endpoint | The caller's opaque Git revision spelling, defaulting to `HEAD` |
| resolved endpoint | The exact commit object produced from the requested endpoint |
| lower boundary | An optional exact ancestor commit at which inspection begins |
| traversal origin | The oldest relevant path snapshot selected by the ancestry profile and lower boundary |
| semantic checkpoint | One inspected commit whose blob is completely decoded, parsed, and semantically validated |
| effective checkpoint | The newest semantic checkpoint at or before the requested endpoint |
| continuity segment | A maximal ordered sequence of checkpoints with no invalid, missing, or ambiguous boundary between them |
| graph epoch | One interval during which a semantic entity or topology relation has one exact identity and meaning |
| frozen evidence | Immutable explicit actual evidence or proven retired topology retained by the historical fold |

The requested endpoint is the newer, inclusive `as-of` bound. It is not
automatically replaced by the repository root, merge base, or nearest valid
ancestor. The result always reports both requested and resolved endpoint
identity.

When no lower boundary is supplied, the first-parent profile inspects from the
oldest path-changing commit reachable from the resolved endpoint. A future
interface may accept an explicit lower boundary, but it must prove that the
boundary is an ancestor under the selected profile. A branch name, tag, SHA,
`<commit>~N`, `<merge>^1`, or `<merge>^2` may identify the endpoint when Git
resolves it to exactly one commit. A revision spelling that expands to zero or
multiple commits is unavailable rather than heuristically reduced.

If the endpoint blob is invalid but an earlier valid checkpoint exists, the
result may expose that checkpoint as the effective display anchor. It must
remain `incomplete`, retain the exact invalid endpoint, and never label the
older graph as the endpoint graph.

## 5. Immutable Git evidence

### 5.1 First-parent profile

The proposed linear profile resolves the endpoint once and uses the equivalent
of:

```text
git rev-list --first-parent --reverse <resolved-endpoint> -- <path>
```

with an additional lower-boundary restriction when selected. For every
returned commit, the adapter captures:

- Git object format and repository identity;
- repository-relative path;
- commit ID and every direct parent ID;
- exact blob identity or absence;
- exact source bytes and SHA-256 source digest; and
- committer time only as `recorded_at` provenance.

The adapter must preserve the existing linked-worktree, shallow-boundary,
rename, process-failure, malformed-output, source-binding, and race behavior.
Resolving a mutable ref to a commit freezes the object-side query; any current
worktree comparison remains a separately bound input and must not change the
historical result silently.

### 5.2 Path absence

The initial profile may retain the current rule that the selected path must
exist at the endpoint. Supporting a query after the plan was deleted would
require a separately specified tombstone lookup because the caller's path can
no longer prove one unambiguous historical identity. It must not be enabled by
searching similar paths or renames automatically.

### 5.3 Merge commits under first-parent

A merge commit remains one inspected checkpoint on the first-parent lane. The
fold compares its resulting blob with the preceding first-parent checkpoint.
It records all direct parent IDs but does not inspect commits reachable only
through a non-first parent.

Consequently, `complete` under this profile means complete for the declared
`first_parent` scope. It does not mean that the complete development history
of every merged branch was inspected. Explicit event records that survive in
the merge result are usable under the ordinary event contract, but the profile
does not invent their side-branch commit provenance or intermediate ordering.

## 6. Snapshot validity and continuity

Every inspected snapshot is classified in a fixed pipeline.

```text
raw bytes or absence
  -> supported byte encoding
  -> supported declared Grammar
  -> complete parse
  -> semantic validation
  -> assurance evaluation
  -> actual-evidence consistency
  -> topology-transition classification
```

The classifications are independent:

- `source_invalid`: bytes cannot be decoded or the blob is unavailable;
- `grammar_unsupported`: the installed reader cannot interpret the declared
  Grammar;
- `syntax_invalid`: parsing is incomplete or has errors;
- `semantic_invalid`: parsing succeeded but document validation failed;
- `semantic_valid`: the document provides one trustworthy semantic snapshot;
- `assurance_withheld`: semantic topology is valid, but current assurance
  policy would not grant normal start authority;
- `evidence_conflict`: stable actual identity has incompatible payloads; and
- `topology_conflict`: the snapshot is valid alone but cannot be joined to the
  accumulated lineage without changing already frozen meaning.

Only `semantic_valid` snapshots become semantic checkpoints. Assurance status
is projected beside a checkpoint; it does not make valid topology disappear,
and historical reconstruction never accepts a seal or basis merely because it
was committed.

An invalid or unavailable snapshot closes the current continuity segment. The
next valid snapshot starts a new segment. Frozen evidence established before
the gap remains available, but the reducer must not infer:

- a lifecycle transition across the gap;
- the exact commit that introduced or removed an entity;
- a canonical advance across the gap;
- a task rename or identity continuation;
- an actual start or finish time; or
- a topology delta whose intermediate state is unknown.

Even when the semantic digests before and after a gap are equal, the gap is
retained. Equality of its visible endpoints does not prove that no transient
actual event or topology existed inside invalid commits.

## 7. Ordered semantic fold

### 7.1 Fold state

The pure fold consumes checkpoints in commit order and owns immutable state:

```ts
interface HistoricalFoldStateV1 {
  readonly endpointBinding: EndpointBindingV1;
  readonly checkpoints: readonly HistoricalCheckpointV1[];
  readonly continuitySegments: readonly ContinuitySegmentV1[];
  readonly entityEpochs: readonly HistoricalEntityEpochV1[];
  readonly topologyEpochs: readonly HistoricalTopologyEpochV1[];
  readonly actualEvidence: readonly HistoricalActualEvidenceV1[];
  readonly advanceTransitions: readonly HistoricalAdvanceTransitionV1[];
  readonly causes: readonly HistoricalCauseV1[];
}
```

These names are proposal-only. The Core receives captured bytes and Git
identity as dependencies and performs no repository or filesystem operation.

### 7.2 Entity occurrence identity

Source IDs remain the primary semantic identity within one checkpoint. The
historical projection adds an occurrence key consisting conceptually of:

```text
project identity + entity kind + source ID + introduction checkpoint
```

The introduction commit is provenance, not a new source ID. Disappearance and
later reuse of the same source ID is not assumed to be the same occurrence.
The initial model either proves continuity through every intervening
checkpoint or reports `identity_reused`/`identity_ambiguous` and starts no
cumulative lineage across that boundary.

A field change creates a new value epoch for that occurrence. Changes to task
or gate endpoints, kind, evidence ownership, or another identity-defining
field require a topology epoch boundary and may invalidate cumulative lineage
after the task has acquired frozen evidence.

### 7.3 Actual-evidence freezing

The fold reuses the accepted actuals rules rather than defining a second event
ledger.

- An event is identified by stable event ID and complete payload.
- Repetition in later snapshots is deduplicated.
- A changed payload under the same ID is a conflict.
- The last committed identical payload before canonical removal is retained
  with its removal commit.
- Commit timestamps remain recording provenance only.
- Qualified status-only transitions remain distinct from declared actuals.
- Planned-value baselines use the accepted start-or-finish snapshot rules.

An event becomes frozen when first observed in one valid continuity segment.
Later identical observations confirm it; disappearance is accepted only when
the removal transition is understood. A gap before disappearance makes the
removal provenance incomplete.

### 7.4 Canonical advance proof

The fold must not classify every deletion as `dag advance`. For two adjacent
valid checkpoints `A` and `B`, a proven advance requires:

1. `A` is a valid input to the active compatible canonical advance planner;
2. the planner produces one complete candidate without force, governance, or
   persistence assumptions;
3. the candidate semantic model is exactly equal to `B`;
4. the removed entity, work-event, relation, assurance-receipt, and retained
   frontier records agree with the planner result; and
5. no unrelated semantic change is hidden in the same transition.

When all conditions hold, the fold retires the removed subgraph at `B`, freezes
its last valid topology and actual evidence, and retains the residual frontier
connection. Raw-byte equality is not required, but source-only differences
are reported separately.

When the semantic candidate differs, the transition is an ordinary edit,
ambiguous removal, or conflict. The reducer does not partially classify the
matching subset as advance merely to produce a fuller graph.

### 7.5 Other transition classes

Adjacent valid checkpoints have one closed transition class:

- `initial`: first valid snapshot;
- `representation_only`: semantic digest unchanged;
- `evidence_extension`: topology unchanged and immutable explicit evidence
  added consistently;
- `lifecycle_projection`: lifecycle state changed consistently with evidence;
- `future_plan_edit`: only not-yet-frozen future meaning changed;
- `canonical_advance`: exact contraction proved by Section 7.4;
- `merge_snapshot`: first-parent comparison at a multi-parent commit;
- `ambiguous_edit`: valid standalone snapshots with no trustworthy historical
  continuity classification; or
- `conflict`: the new snapshot contradicts frozen identity or evidence.

An `ambiguous_edit` may start a new timeline epoch but cannot mutate already
frozen lineage. This permits useful read-only inspection without presenting a
speculative cumulative DAG.

## 8. Historical graph views

Historical view and analysis mode are separate axes.

```text
view:     snapshot | lineage | timeline
analysis: none | precedence | resource | both
```

The four accepted current GraphView analysis meanings remain unchanged. A
future historical adapter must not present the three historical views as four
new analysis modes or reuse `Perttool.GraphViewResult.v1` with changed fields.

### 8.1 Snapshot view

`snapshot` presents one exact semantic checkpoint. By default it uses the
resolved endpoint when that endpoint is valid; otherwise it may present the
effective earlier checkpoint with an explicit incomplete banner and both
commit identities.

Standard precedence and resource analysis may run against this one graph.
Source ranges bind to the selected historical blob, not to the current
worktree document.

### 8.2 Lineage view

`lineage` is the desired cumulative project picture: it retains topology
retired by proven advances and connects it to the current frontier. It is not
a blind set union of every observed node and edge.

A complete lineage graph exists only when the fold proves all of these:

- one continuous project identity;
- no unresolved invalid or ambiguous transition affecting included topology;
- every retired component was removed by a proven canonical advance;
- no historical source ID was ambiguously reused;
- no frozen task or gate changed an identity-defining endpoint;
- all event identities and payloads are consistent;
- frontier connections remain closed; and
- the reconstructed cumulative topology is acyclic.

If any condition fails, `lineage` is null or limited to the last complete
continuity segment, with typed causes. The renderer must not drop conflicting
edges merely to make the output look clean.

Retired and current entities are visually distinct. Retired tasks expose
their frozen actual evidence and last valid planned-value context. Current
entities expose endpoint analysis. Precedence or resource fields computed for
the endpoint are attached only to entities present in that endpoint graph;
they are null on retired entities unless a separately selected checkpoint
analysis provides historical values. Standard CPM is never run over a mixture
of epochs and then labeled as an analysis that existed historically.

### 8.3 Timeline view

`timeline` is the safe fallback when no single cumulative lineage can be
proved. It presents ordered checkpoints, continuity gaps, graph epochs, exact
transition classes, and selected per-checkpoint summaries. Each graph remains
independently valid at its own checkpoint.

Timeline presentation may animate or compare checkpoints, but layout code may
not infer missing semantic transitions. A topology cycle that appears only in
the union of different epochs is not a document cycle and must not be reported
as one.

## 9. Branch and merge reconstruction

### 9.1 First-parent delivery profile

The initial implementable profile should be `first_parent`. It provides one
deterministic mainline ledger and matches the accepted actuals history scope.
At a merge commit it records:

- the merge commit and all parent IDs;
- the first-parent predecessor checkpoint;
- the exact merged result snapshot; and
- one transition from first parent to merged result.

It does not claim that side-branch checkpoints were inspected. A result must
project `ancestry_profile: "first_parent"` prominently so a consumer cannot
mistake mainline completeness for repository-wide completeness.

### 9.2 Three-way profile

A future `three_way` profile requires the semantic model and conflict rules of
`SCM-001`. For one merge with a unique accepted base, it performs:

```text
common history -> base checkpoint
                   |-> base .. ours   -> ours fold
                   |-> base .. theirs -> theirs fold

base + ours + theirs
  -> semantic and evidence reconciliation
  -> expected merged semantic candidate or typed conflicts
  -> comparison with the recorded merge-result checkpoint
```

The common prefix is folded once. Each parent lane is folded independently.
Only after both folds are complete may the three-way Core reconcile their
semantic deltas and frozen evidence.

The initial conservative rules should include:

- identical changes and identical event IDs/payloads deduplicate;
- one branch that is a strict immutable-evidence extension of the other may
  select the extension when the complete lifecycle validates;
- divergent payloads under one event ID conflict;
- concurrent disjoint lifecycle additions that could represent separate
  executions conflict unless a later normative rule proves one serial event
  history without inventing occurrence intent;
- independent future-plan changes merge only when their semantic union is
  valid and does not alter frozen meaning;
- delete/modify, endpoint rewrite, task-ID reuse, outcome, receipt, seal,
  governance, and assurance differences use `SCM-001` conflict rules; and
- the actual recorded merge snapshot must equal the expected semantic merge
  before the history result calls the merge reconciled.

Multiple merge bases, criss-cross merges, replace refs, grafts, recursive
nested branch unions, or an absent recorded merge result are unavailable in
the first three-way profile unless the caller supplies an explicit virtual
ancestor with its own provenance contract. No merge base is chosen by commit
date or enumeration order.

### 9.3 Index stages

Unmerged stage 1/base, stage 2/ours, and stage 3/theirs blobs are valid primary
inputs to the future semantic merge adapter, but they are not ancestry
endpoints. A historical viewer may show the three independently bound snapshot
graphs. It must not claim a recorded timeline or merge-result checkpoint until
one exists.

## 10. Candidate result boundary

The proposal uses a distinct result identity, tentatively
`Perttool.HistoricalGraphResult.v1`. It must not be added to the current schema
catalog or public package without a later interface decision.

Conceptually, the request contains:

```ts
interface HistoricalGraphRequestV1 {
  readonly targetPath: string;
  readonly requestedEndpoint?: string;
  readonly lowerBoundary?: string;
  readonly ancestryProfile: "first_parent" | "three_way";
  readonly view: "snapshot" | "lineage" | "timeline";
  readonly checkpointRevision?: string;
  readonly analysisMode: "none" | "precedence" | "resource" | "both";
}
```

The result must contain at least:

- schema and model versions;
- `complete`, `incomplete`, or `unavailable` status;
- object format, repository/path identity, requested and resolved endpoint,
  optional lower boundary, ancestry profile, and inspected commit IDs;
- every snapshot's commit, parents, blob/source digest, Grammar version,
  validity class, semantic digest when available, and recorded time;
- continuity segments, gaps, and typed causes;
- transition classes and canonical-advance proof records;
- stable actual-event records reused from the accepted actuals projection;
- graph epochs and occurrence identities;
- one selected snapshot graph, proven lineage graph, or ordered timeline;
- exact analysis-mode and checkpoint binding;
- diagnostics and truncation state; and
- immutable historical source bindings for navigation.

`complete` is always qualified by the explicit ancestry profile and view. A
complete snapshot does not imply complete lineage. A complete first-parent
lineage does not imply three-way branch-union inspection.

Hard limits are required for commit count, source bytes per snapshot, total
bytes, entity epochs, transition records, and rendered graph size. Exceeding a
limit produces an incomplete or unavailable closed result, never a silently
truncated graph presented as complete.

## 11. Candidate CLI and adapter integration

No spelling is selected, but a future CLI could resemble:

```text
perttool dag history <file> --rev <endpoint> \
  [--base <lower-boundary>] \
  [--history first-parent|three-way] \
  [--view snapshot|lineage|timeline] \
  [--analysis none|precedence|resource|both]
```

The file path and revision remain separate arguments. A compact `REV:path`
syntax is not selected because Git revision parsing, repository-relative path
identity, colon-containing platform paths, index stages, and error attribution
need independent validation.

The editor requires a new versioned request and result. The current
`perttool/graphView` remains bound to an open URI/version and continues to
reject Git refs. A historical request would use Node-host Git ports and exact
repository/path/commit bindings, then return a historical result whose source
ranges identify immutable blobs.

The later VSIX design must decide how to open those bindings as read-only
virtual documents. It must never navigate a historical range in current
worktree bytes merely because the path is equal. Current untrusted and virtual
document support remains available for current GraphView; a Git-subprocess-
backed historical command may fail closed in an untrusted or non-repository
workspace without regressing current-document behavior.

The accepted MCP adapter excludes Git refs and workspace lookup. Historical
Git DAG access requires a separate registered-source capability and must not
be smuggled into an existing inline-source tool.

## 12. Relationship to semantic diff and merge

Historical reconstruction and `SCM-001` should share one closed normalized
whole-document semantic model and field-specific delta rules.

- The linear fold consumes deltas in chronological order and assigns history
  transition classes.
- Semantic diff compares any two valid endpoints without claiming ancestry.
- Three-way merge reconciles base/ours/theirs deltas and returns a candidate or
  typed conflicts.
- Historical three-way reconstruction additionally compares that candidate
  with the recorded merge-result checkpoint and preserves parent-lane evidence
  provenance.

The first-parent historical slice may be implemented before a public semantic
patch format, but it must use one internal transition projection that can later
be proven identical to the accepted semantic model. It must not create a
second incompatible field-identity or exact-value system.

## 13. Authority and safety boundaries

Historical DAG reconstruction is observation only.

- A committed snapshot is not owner acceptance or governance authority.
- A semantically clean merge is not permission to write it.
- A reconstructed task outcome, seal, or receipt is not accepted unless the
  active assurance evaluator accepts the exact source records under its own
  contract.
- Git-recorded lifecycle state is not an actual event.
- A historical lineage graph is not current start authority.
- A result does not weaken expected-digest, history-safety, warning,
  authorization-before-write, safe-persistence, or repository-race gates.

The implementation and acceptance harness must prove that repository refs,
index, worktree, source files, configuration, and external state remain
unchanged.

## 14. Acceptance cases for a later contract

| ID | Required case |
| --- | --- |
| `HDG-001` | One valid commit produces identical current snapshot topology and no invented history. |
| `HDG-002` | A branch, tag, SHA, `~N`, `^1`, or `^2` resolving to one commit binds the exact endpoint. |
| `HDG-003` | An omitted lower boundary reaches the oldest relevant first-parent path snapshot; an explicit valid ancestor narrows the fold. |
| `HDG-004` | An invalid endpoint retains endpoint identity, selects only an explicit effective checkpoint, and remains incomplete. |
| `HDG-005` | An invalid middle snapshot splits continuity and no lifecycle or topology transition crosses the gap. |
| `HDG-006` | Stable events repeat across snapshots once, freeze before removal, and retain exact occurrence/removal provenance. |
| `HDG-007` | A changed payload under one event ID returns a conflict and no selected event payload. |
| `HDG-008` | A byte-only formatting change is representation-only and does not create a graph epoch. |
| `HDG-009` | A valid future-only plan edit creates deterministic value/topology epochs without changing frozen actuals. |
| `HDG-010` | An exact canonical advance rehydrates retired topology, so a one-node current source can have a multi-node lineage DAG. |
| `HDG-011` | A deletion that is not the exact canonical advance candidate is not partially rehydrated as advance. |
| `HDG-012` | Disappearance and reuse of one source ID fails cumulative lineage unless continuity is proved. |
| `HDG-013` | A union-only cycle across separately valid epochs leaves timeline available and lineage unavailable; it is not reported as a source cycle. |
| `HDG-014` | A first-parent merge includes the merge result and excludes side-only commits while reporting its explicit scope. |
| `HDG-015` | A unique-base three-way merge deduplicates identical evidence and merges independent valid future changes. |
| `HDG-016` | Divergent actual payloads, concurrent ambiguous execution, delete/modify, or invalid semantic union return typed conflicts. |
| `HDG-017` | Multiple merge bases or unsupported nested branch union fail closed without selecting one by order or time. |
| `HDG-018` | Snapshot, lineage, and timeline remain orthogonal to all four existing analysis modes. |
| `HDG-019` | Historical navigation binds commit/blob/digest/range and never applies that range to mismatched current bytes. |
| `HDG-020` | SHA-1/SHA-256, linked worktrees, shallow history, rename, ref/source races, hard limits, and no-write proof retain typed outcomes. |

## 15. Staged delivery boundary

A later workstream should retain this dependency order:

1. accept a normative historical-DAG contract and machine-readable cases;
2. factor or version the shared whole-document semantic transition model;
3. implement the pure first-parent checkpoint and lineage fold;
4. expose one read-only Node/CLI result with isolated-repository acceptance;
5. add a distinct editor protocol and VSIX history presentation;
6. accept the `SCM-001` semantic three-way Core; and
7. add the optional three-way history profile and merge-result verification.

The first-parent fold and current-document VSIX stabilization do not need to
wait for Git merge-driver installation or write-capable SCM integration.

## 16. Decisions still required before implementation

- the normative requirement and result/model names;
- whether endpoint-path deletion is unsupported or uses an explicit tombstone
  locator;
- the exact optional lower-boundary inclusion rule;
- the canonical entity-occurrence and topology-epoch encoding;
- whether a lineage result may expose only the last complete continuity
  segment or must return no lineage after any affecting gap;
- hard-limit values and caching rules;
- the exact relationship between current analysis values and retired-epoch
  presentation;
- unique-base versus explicit-virtual-base behavior for complex merges;
- the editor trust, repository selection, and historical virtual-document
  contract;
- public CLI, Core, schema, Help, Guide, package, and diagnostic versions; and
- the independent implementation, release, and compatibility plan.

Until those decisions are accepted, current `project history`, `dag render`,
`Perttool.GraphViewResult.v1`, Grammar 6, CLI Contract 7, and every read/write
authority boundary remain unchanged.
