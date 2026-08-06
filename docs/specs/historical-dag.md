# Historical DAG Reconstruction Contract

- Status: Normative 1.0
- Historical DAG model version: 1
- Historical transition model version: 1
- Ancestry profile: `first_parent`
- Compatible source inputs: Grammar 1 through 6
- Active runtime during contract acceptance: Grammar 6 and CLI Contract 7
- Requirements: [../requirements.md](../requirements.md)
- Backlog: [`HIST-DAG-001`](../backlog.md#hist-dag-001-reconstruct-and-visualize-historical-dags)
- Design input: [Historical DAG Reconstruction and Git-Ancestry Design Proposal](../process/historical-dag-design.md)

## 1. Purpose

The current `.pert` document represents the present and future. Canonical
`dag advance` removes completed topology only after the exact pre-advance
snapshot is recoverable from Git. A current graph may therefore contain one
residual milestone even though the first-parent history contains the complete
progression that led to that frontier.

Historical DAG model 1 defines a separate read-only reconstruction. It binds
one repository-relative path, an inclusive endpoint commit, and an optional
inclusive lower-boundary commit; classifies every inspected source; freezes
explicit actual evidence; and rehydrates retired topology only when an exact
canonical-advance transition is proved. It exposes three different views:

- one exact semantic `snapshot`;
- one proved cumulative `lineage`; and
- one ordered `timeline` of independently valid graph epochs and gaps.

The first model is deliberately linear. It inspects only the declared
`first_parent` lane and never represents that scope as a union of every branch.
Three-way ancestry remains unavailable until `SCM-001` accepts the shared
base/ours/theirs semantic merge model.

## 2. Normative precedence and unchanged surfaces

The applicable order is:

1. requirements in `docs/requirements.md`;
2. this contract;
3. actual-event and existing first-parent history semantics in
   [Project Actuals and Git History](project-actuals.md);
4. canonical advance semantics in [Graph Semantics](graph-semantics.md),
   [Mutation Semantics](mutation.md), and
   [Conditional Plan Assurance](plan-assurance.md);
5. snapshot analysis in [Analysis](analysis.md);
6. the current-document [Editor Protocol](editor-protocol.md); and
7. process guidance under `docs/process/`.

This contract fixes a target model and implementation boundary. It does not
activate a command, package export, schema artifact, LSP request, VSIX feature,
or release. Current `Perttool.ProjectHistoryResult.v1`,
`Perttool.GraphViewResult.v1`, all 44 Contract 7 commands, all 20 root schemas,
Grammar 6 source, and every read/write authority remain unchanged.

Historical reconstruction observes committed objects only. It never stages,
commits, checks out, resets, merges, rebases, updates a ref or the index,
changes Git configuration, writes a source, repairs an invalid blob, or grants
governance, assurance, recommendation, lifecycle, or persistence authority.

## 3. Model and ownership identities

The first implementation targets these closed identities:

```text
historical DAG model       Perttool.HistoricalDagModel.v1
transition model           Perttool.HistoricalTransitionModel.v1
ancestry profile           first_parent
future result              Perttool.HistoricalGraphResult.v1
diagnostics                PTHDG-101 through PTHDG-106
```

The Domain owns semantic snapshot normalization, occurrence identity,
transition classification, frozen evidence, graph epochs, and lineage proof.
The Application layer owns request validation, result status, analysis
composition, and fail-closed cause projection. Inward-owned Git ports own only
captured immutable evidence. A Node Host owns repository discovery, object
reads, linked-worktree resolution, process bounds, and race capture. Future
CLI, LSP, and VSIX adapters own only their protocol envelopes and
presentation.

`Perttool.HistoricalGraphResult.v1` is reserved for the later public-interface
task. It must be a new closed result rather than an extension of either current
history or GraphView results. This contract does not add that identity to the
active schema catalog.

## 4. Closed request semantics

The model request is conceptually:

```ts
interface HistoricalGraphRequestV1 {
  readonly targetPath: string;
  readonly requestedEndpoint?: string;
  readonly lowerBoundary?: string;
  readonly ancestryProfile: "first_parent";
  readonly view: "snapshot" | "lineage" | "timeline";
  readonly snapshotRevision?: string;
  readonly analysisMode: "none" | "precedence" | "resource" | "both";
}
```

The file path and Git revision are separate values. Model 1 does not accept a
compact `REV:path` value, an index stage, an arbitrary blob ID without commit
provenance, or more than one path.

The omitted endpoint spelling is `HEAD`. The Host resolves an opaque branch,
tag, full or abbreviated object ID, `~N`, `^1`, or `^2` spelling to exactly one
commit and immediately freezes that full object ID. A spelling that resolves
to zero objects, multiple objects, or a non-commit is unavailable. Commit time
does not select or reorder revisions.

`snapshotRevision` is optional and valid only for `view="snapshot"`. It must
resolve to an inspected commit between the inclusive boundaries. Without it,
the selected snapshot is the resolved endpoint. An invalid endpoint is never
silently replaced by an older valid graph. The result may report the newest
earlier semantic checkpoint as `effective_checkpoint_id`, but a consumer must
make that exact commit an explicit `snapshotRevision` in a new request before
displaying it as the selected graph.

## 5. Endpoint, lower boundary, and traversal

### 5.1 Endpoint and path

The resolved endpoint is the inclusive newer bound. The selected path must
exist as a regular blob at that commit. A deleted endpoint path is unavailable
with cause `endpoint_path_missing`; model 1 does not search tombstones,
similar paths, committed renames, reflogs, unreachable objects, or other
branches to guess its identity.

The repository-relative path is resolved once from the supplied filesystem
path and repository identity. Absolute and worktree paths are not included in
the portable result. Linked worktrees are supported through their common
object database and exact worktree-relative target binding.

### 5.2 Inclusive lower boundary

An explicit lower boundary resolves to exactly one commit and must be the
resolved endpoint or a first-parent ancestor of it. Its target blob must
exist. The boundary blob is included as the first inspection input even when
that commit did not change the path relative to its own first parent. Later
inspection inputs are every first-parent commit that changes the target blob,
plus the resolved endpoint even when it repeats the preceding blob.

When the boundary is omitted, traversal begins with the oldest reachable
first-parent commit at which the selected path exists, followed by the same
path-changing sequence and the endpoint. A shallow boundary that prevents
proof of the true origin makes the result incomplete. An explicit boundary
inside the available shallow history is complete only when Git can prove its
first-parent ancestry to the endpoint without relying on omitted parents.

`lowerBoundary === requestedEndpoint` produces one inspection input. A lower
commit outside the first-parent lane, newer than the endpoint, missing the
path, or unprovable because of shallow history is unavailable; enumeration
order or commit time never repairs it.

### 5.3 Merge commits

A relevant merge commit is an ordinary inspection input on the first-parent
lane. The result records every direct parent ID, compares the merge-result
blob only with the preceding first-parent input, and marks the transition with
`is_merge_commit=true`. Commits reachable only through another parent are not
inspected. `complete` therefore always means complete for the explicit
`first_parent` scope, never complete repository-wide history.

## 6. Immutable Git evidence

Every inspection input captures:

- Git object format, limited to SHA-1 or SHA-256;
- stable repository identity without an absolute path;
- repository-relative target path;
- full commit ID and all direct parent IDs;
- exact target blob ID or typed absence;
- exact raw bytes and SHA-256 source digest;
- Git-recorded committer time as provenance only; and
- the Host read-snapshot binding used for the complete query.

The Host resolves mutable refs before enumeration. It then reads only objects
reachable from that frozen commit. A changed ref cannot alter the result. A
current-worktree comparison, when a later adapter requests one, is a separate
binding and cannot replace a committed blob.

Malformed Git output, unsupported object formats, object read failures,
replace refs or graft behavior that prevents stable evidence, ambiguous path
identity, and a repository/read-snapshot race fail closed. The public result
must not expose command stderr, environment values, credentials, absolute
paths, or temporary paths.

## 7. Snapshot validity and continuity

Each input follows this fixed classification pipeline:

```text
raw bytes or absence
  -> supported encoding
  -> supported declared Grammar
  -> complete parse
  -> semantic validation
  -> assurance observation
  -> actual-evidence consistency
  -> historical transition classification
```

One snapshot has exactly one source-validity class:

```text
source_missing
source_invalid
grammar_unsupported
syntax_invalid
semantic_invalid
semantic_valid
```

Assurance is a separate observation: `verified`, `withheld`, `not_enabled`, or
`unavailable`. A committed seal is not accepted merely because it appears in
Git. Only `semantic_valid` inputs become semantic checkpoints.

An invalid or unavailable input closes the current continuity segment. The
next valid checkpoint begins another segment. The fold retains the gap and
must not infer across it:

- lifecycle state or occurrence continuity;
- task, milestone, gate, resource, event, or project renames;
- the commit that introduced or removed meaning;
- canonical advance;
- source-only or semantic deltas; or
- actual dates, effort, outcome, seal, or receipt acceptance.

Equal semantic digests on both sides do not erase a gap. Frozen evidence from
before the gap remains observable, but any lineage whose included topology
would cross that gap is unavailable. Model 1 returns `lineage=null`; it does
not relabel the newest continuity segment as the complete project lineage.
Timeline remains available for every independently valid segment.

## 8. Normalized semantic transition model

`Perttool.HistoricalTransitionModel.v1` is one closed whole-document
projection designed for later reuse by `SCM-001`. It normalizes exact Rational
values, project identity, milestones, tasks, gates, resources, temporal
fields, lifecycle state, work events, governance metadata, assurance records,
outcomes, and receipts. It separates semantic meaning from source trivia and
never uses binary floating point as identity.

The first-parent fold consumes adjacent valid checkpoints. Semantic diff and
three-way merge may later consume the same projection, but this task exposes
no patch or merge operation. A second incompatible field-identity or
exact-value system is forbidden.

Each adjacent pair has exactly one semantic class:

```text
initial
representation_only
evidence_extension
lifecycle_projection
future_plan_edit
canonical_advance
ambiguous_edit
conflict
```

Merge provenance is the separate boolean `is_merge_commit`; it does not hide
the semantic class. `representation_only` requires equal complete normalized
semantics. `future_plan_edit` cannot change already frozen meaning.
`ambiguous_edit` permits independently valid timeline checkpoints but cannot
extend cumulative lineage. `conflict` records contradictory identity,
evidence, assurance, or topology and selects no winning value.

## 9. Occurrences, epochs, and frozen evidence

### 9.1 Occurrence identity

Source IDs remain semantic identity inside one checkpoint. Historical
occurrence identity is the structured tuple:

```ts
interface HistoricalOccurrenceKeyV1 {
  readonly projectId: string;
  readonly entityKind: "milestone" | "task" | "gate" | "resource";
  readonly sourceId: string;
  readonly introducedCommitId: string;
}
```

The tuple, not a display string, is authoritative. Its portable
`occurrence_id` is `HDGE-` followed by the lowercase 64-hex SHA-256 of the
Grammar-6 canonical JSON encoding of that tuple. Occurrences sort by entity
kind in the order shown above, then source ID by Unicode code point, then full
introduction commit ID.

An entity value epoch is `(occurrence_id, ordinal)`, with one-based consecutive
ordinals in checkpoint order. A topology epoch is the canonical ordered set
of task/gate occurrence endpoints and has identity `HDGT-` plus the full
SHA-256 of its canonical transition-model JSON. Formatting-only changes do not
create either epoch. Disappearance and later reuse of one source ID creates a
new occurrence only when every intervening transition is known; otherwise it
is `identity_ambiguous` and cumulative lineage is unavailable.

### 9.2 Actual evidence

Actual-event identity, payload equality, deduplication, qualified legacy
transitions, planned-value baselines, and exact rates reuse the Project
Actuals contract. An explicit event first observed in a valid segment becomes
frozen. Later identical observations confirm it. A changed payload under the
same event ID is `event_payload_changed`, selects no payload, and makes
lineage unavailable.

Disappearance of frozen evidence is accepted only as part of a proved
canonical advance. Otherwise the transition is ambiguous or conflicting.
Commit time is only `recorded_at` provenance and never substitutes for the
event's fixed-offset date-time.

## 10. Canonical-advance proof

For adjacent valid checkpoints `A` and `B`, `canonical_advance` requires all
of these conditions:

1. `A` is a valid input to the compatible active canonical advance planner;
2. the planner produces one complete candidate without force, owner assertion,
   repository proof, or persistence assumptions;
3. the candidate's complete normalized transition-model semantics equal `B`;
4. removed declarations, work events, relations, assurance receipts, retained
   frontier records, and state changes equal the planner summary; and
5. no unrelated semantic change is present in `B`.

Raw source bytes may differ only by representation that the normalized model
classifies separately. The proof record binds the `A` and `B` commit/blob/
source digests, active compatible planner version, candidate semantic digest,
and exact removed/retained occurrence IDs.

Only a proved transition retires removed topology into lineage and freezes its
last valid planned and actual context. A partial match, manual deletion,
simultaneous future edit, gap, unsupported planner version, forced historical
write, or unavailable candidate is not partially accepted as advance.

## 11. Views and analysis

Historical view and analysis mode are orthogonal:

```text
view:     snapshot | lineage | timeline
analysis: none | precedence | resource | both
```

### 11.1 Snapshot

`snapshot` is exactly one selected semantic checkpoint. The graph is null
when that input is not semantic-valid. Source navigation binds to that
checkpoint's immutable commit, blob, digest, and UTF-16 source range.

### 11.2 Lineage

`lineage` retains current topology plus topology retired by proved canonical
advance. It is never the set union of every snapshot. A lineage graph exists
only when the included range has one continuous project identity, no affecting
gap or ambiguous transition, no ambiguous source-ID reuse, no contradictory
frozen evidence, closed frontier connections, and an acyclic cumulative AoA
topology. If any condition fails, `lineage=null` with typed causes; an adapter
must not drop an edge to make a graph renderable.

Current and retired occurrences are explicit. Retired tasks carry their last
valid planned context and frozen actual evidence. They carry no current CPM or
resource fields.

### 11.3 Timeline

`timeline` retains ordered checkpoints, transition classes, merge provenance,
continuity segments, gaps, graph/topology epochs, and bounded summaries. Each
checkpoint graph is valid only at its own commit. A cycle that exists only in
the union of multiple epochs is not a source cycle; it makes lineage
unavailable while timeline remains usable.

### 11.4 Analysis binding

The four analysis modes retain the exact current GraphView meanings and run
against one complete selected checkpoint only. For `snapshot`, that is the
explicit snapshot checkpoint. For `lineage` and `timeline`, it is the resolved
endpoint when semantic-valid; otherwise analysis is unavailable. Analysis is
never run over the cumulative lineage or a mixture of epochs. An endpoint
overlay may be attached only to endpoint occurrences; retired occurrences
have null analysis fields.

## 12. Status, causes, and diagnostics

The future result status is one of:

- `complete`: the requested view is completely proved for the explicit
  first-parent bounds;
- `incomplete`: immutable evidence exists, but a gap, conflict, shallow
  origin, output limit, or unavailable requested view prevents completeness;
  or
- `unavailable`: the repository/path/revision request or bounded evidence
  cannot be established safely.

Stable causes include:

```text
no_repository
no_head
unknown_revision
ambiguous_revision
non_commit_revision
endpoint_path_missing
lower_path_missing
lower_not_first_parent_ancestor
shallow_origin
unsupported_object_format
git_unavailable
object_read_failed
repository_race
source_missing
source_invalid
grammar_unsupported
syntax_invalid
semantic_invalid
assurance_withheld
event_payload_changed
identity_ambiguous
ambiguous_edit
noncanonical_removal
topology_conflict
lineage_cycle
hard_limit
unsupported_ancestry_profile
```

Diagnostics own these categories:

| Code | Category |
| --- | --- |
| `PTHDG-101` | Repository, path, endpoint, or lower-boundary request unavailable |
| `PTHDG-102` | Incomplete source validity, shallow origin, or continuity gap |
| `PTHDG-103` | Evidence, occurrence, transition, or topology conflict |
| `PTHDG-104` | A fixed input or output hard limit was exceeded |
| `PTHDG-105` | Repository, ref, blob, or source binding became stale or raced |
| `PTHDG-106` | The requested ancestry profile is unsupported; model 1 supports only `first_parent` |

No code is active until the later interface task registers the closed result,
schema, help, and Guide projection.

## 13. Hard limits and caching

Model 1 fixes these defaults:

| Limit | Exact value |
| --- | ---: |
| Inspected commits | 2,048 |
| Raw bytes per snapshot | 8,388,608 |
| Aggregate raw snapshot bytes | 134,217,728 |
| Entity value epochs | 100,000 |
| Transition records | 2,047 |
| Rendered graph occurrences | 20,000 |
| Historical source bindings | 100,000 |

Commit, per-snapshot, or aggregate-byte overflow makes bounded input
unavailable and returns no graph. Epoch, transition, rendered-graph, or
binding overflow makes the result incomplete and returns no silently
truncated lineage or timeline. A fully captured selected snapshot may still
be returned only when its graph and bindings are independently inside every
applicable limit. Limits are checked before allocating the next record.

Caching is optional and in-memory by default. A snapshot cache key contains
repository identity, path, commit ID, blob ID, source digest, Grammar reader,
and transition-model version. A fold cache key additionally contains the
complete ordered snapshot-binding sequence, bounds, ancestry profile, view,
analysis mode, and all model/algorithm versions. Cache hits must be
byte-identical to complete recomputation. Persisted caches and invalidation
formats require a separate contract.

## 14. Historical source bindings and editor boundary

A navigable range is exactly:

```ts
interface HistoricalSourceBindingV1 {
  readonly repositoryId: string;
  readonly repositoryRelativePath: string;
  readonly commitId: string;
  readonly blobId: string;
  readonly sourceDigest: string;
  readonly range: Utf16Range;
}
```

Navigation may open a later read-only virtual document only after the adapter
loads the exact blob and verifies every binding. It must never apply a
historical range to current worktree bytes because the path or URI happens to
match. Current `perttool/graphView` remains URI/generation/version-bound and
accepts no Git revision.

The later editor contract owns trusted local-repository selection,
cancellation, staleness, virtual documents, CSP, accessibility, and
presentation. Until then, untrusted, virtual, non-file, or non-repository Git
requests are unavailable without regressing current-document GraphView.

The current MCP adapter accepts neither client paths nor Git refs and remains
unchanged. Historical MCP access would require a separate registered-source
capability and contract.

## 15. Three-way deferral and SCM compatibility

Model 1 accepts only `first_parent`. A `three_way` request returns unavailable
with `unsupported_ancestry_profile` and `PTHDG-106`. It does not inspect the
side lanes, choose a merge base, use index stages, or produce a candidate.

`SCM-001` must first accept one shared normalized semantic delta and
base/ours/theirs conflict model. Only a later version may fold the common
prefix once, inspect both unique parent lanes, reconcile identical evidence
and independent future changes, reject divergent actuals and delete/modify or
assurance conflicts, and compare the expected candidate with the recorded
merge-result snapshot. Multiple merge bases and virtual ancestors remain
unselected. No behavior described here activates semantic diff, patch, merge,
merge-driver installation, Git mutation, or branch-union history.

## 16. Acceptance cases

The normative machine-readable matrix is
[`test/fixtures/historical-dag-contract-v1.json`](../../test/fixtures/historical-dag-contract-v1.json).
Its IDs are dependency ordered.

| ID | Required boundary |
| --- | --- |
| `HDG-001` | One valid endpoint produces one exact snapshot and no invented history. |
| `HDG-002` | Opaque branch, tag, SHA, `~N`, `^1`, and `^2` spellings bind exactly one endpoint commit. |
| `HDG-003` | Omitted and explicit inclusive lower boundaries produce the exact first-parent inspection sequence. |
| `HDG-004` | An invalid endpoint remains selected and incomplete; an earlier effective checkpoint is metadata until explicitly requested. |
| `HDG-005` | An invalid middle input splits continuity and no transition crosses the gap. |
| `HDG-006` | Identical work events deduplicate and freeze before proved removal. |
| `HDG-007` | A changed payload under one event ID is a conflict with no selected payload. |
| `HDG-008` | Representation-only source changes create no semantic or topology epoch. |
| `HDG-009` | Future-only edits create deterministic epochs without changing frozen actuals. |
| `HDG-010` | Exact canonical advance rehydrates retired topology behind a one-node current frontier. |
| `HDG-011` | Noncanonical deletion is never partially accepted as advance. |
| `HDG-012` | Ambiguous source-ID reuse makes cumulative lineage unavailable. |
| `HDG-013` | A union-only cycle leaves timeline available and lineage unavailable without a source-cycle claim. |
| `HDG-014` | A first-parent merge records all parents and the result while excluding side-only commits. |
| `HDG-015` | A three-way request fails closed without side-lane inspection. |
| `HDG-016` | Divergent side evidence is not reconciled by the first-parent model. |
| `HDG-017` | Multiple merge bases or virtual ancestors are not selected by order or time. |
| `HDG-018` | Three views remain orthogonal to four analysis modes, with analysis bound to one checkpoint. |
| `HDG-019` | Navigation verifies commit, blob, digest, and UTF-16 range before opening historical bytes. |
| `HDG-020` | Object formats, linked worktrees, shallow history, path/ref races, hard limits, and no-write behavior remain typed and fail closed. |

## 17. Delivery boundary

The dependency order is:

1. this normative contract and its cases;
2. the shared internal transition projection;
3. bounded immutable first-parent Git evidence;
4. the pure checkpoint, lineage, and timeline fold;
5. one separate read-only Node/CLI result and isolated acceptance;
6. a distinct historical editor contract and VSIX presentation; and
7. only after `SCM-001`, a separately versioned optional three-way profile.

Runtime implementation, current-plan task completion, `dag advance`, public
version selection, release, publication, remote writes, Issue mutation, and
any Git/editor mutation require their own authority and acceptance.
