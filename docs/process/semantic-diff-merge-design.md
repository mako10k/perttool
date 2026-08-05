# Semantic Diff, Patch, and Three-Way Merge Design Proposal

- Document status: Backlog design proposal 0.1; non-normative and not selected
- Recorded: 2026-08-05
- Baseline HEAD: `d21681d82cbdedb3917e6ac44aeb1b723e71f7aa`
- Backlog: [`SCM-001`](../backlog.md#scm-001-add-semantic-diff-patch-and-three-way-merge)
- Related current contracts: [DSL Grammar](../specs/dsl-grammar.md),
  [Mutation Semantics](../specs/mutation.md),
  [Project Actuals and Git History](../specs/project-actuals.md),
  [Conditional Plan Assurance](../specs/plan-assurance.md),
  [Advance History Safety](../specs/advance-history-safety.md), and
  [Mermaid Profile](../specs/mermaid-profile.md)
- Active source boundary: Grammar 6 and CLI Contract 7
- Proposed implementation: none
- External side effects authorized by this proposal: none

## 1. Purpose

This document records an initial design for semantic diff, patch application,
and conservative three-way merge of `.pert` documents. The motivating workflow
is Git branch integration: two branches may execute or revise the same plan,
and a line-oriented merge cannot distinguish a harmless independent state
change from a combined graph, lifecycle, resource, temporal, or assurance
violation.

The proposal treats Git revisions and index stages as primary immutable inputs,
while keeping ordinary files and stdin as adapters to the same pure Core. It
does not change the current requirements, Grammar, CLI contract, package
surface, repository configuration, or release state. Every name and version in
this document is a candidate for later normative review.

## 2. Confirmed current boundary

The current repository already provides the lower-level capabilities on which
this proposal can build.

- The active parser and validator produce a complete Grammar 1 through 6
  document with source spans for project, resource, milestone, task, gate,
  work-event, task-relation, plan-seal, task-outcome, and assurance-receipt
  declarations.
- Exact durations and measurements use Rational-compatible values rather than
  binary floating point.
- Mutation and formatter paths construct source-preserving UTF-16 `TextEdit`
  values, apply them to one final candidate, and expose output only after the
  candidate is reparsed and revalidated.
- Mutation results already expose a deterministic unified diff, although the
  current emitter represents the changed middle as one hunk rather than a
  general multi-hunk semantic edit script.
- Mermaid conversion defines normalized semantic-model equivalence separately
  from byte identity and explicitly excludes comments, trivia, source order,
  spelling, BOM, and line endings from that semantic equivalence.
- The project-actuals Git adapter binds repository, path, revision, object
  format, raw source, and races, but its history result intentionally uses
  first-parent traversal and does not reconstruct a branch union.
- Advance history safety reads exact `HEAD` and stage-0 blobs for one path and
  proves destructive-range recoverability without mutating Git.
- Governance, assurance, actuals, advance, expected-digest, and safe-write
  decisions remain independent authority boundaries.

The proposed feature therefore needs a new closed whole-document semantic
projection, a new delta model, and a new three-way decision Core. It must not
repurpose the first-parent history reducer as a merge engine.

## 3. Goals and non-goals

### 3.1 Goals

The selected design must eventually support:

1. a deterministic semantic diff between two complete valid DSL documents;
2. a versioned native patch artifact that is independently validatable and
   invertible;
3. exact application to the source from which a patch was created;
4. contextual application to a semantically equivalent or independently
   changed source through explicit three-way behavior;
5. conservative three-way merge of base, ours, and theirs;
6. Git revision, blob, worktree, and index-stage input identities;
7. source-preserving candidate generation and complete post-merge validation;
8. a typed conflict result that identifies semantic and source-fidelity causes;
9. explicit conversion boundaries to and from unified diff; and
10. an optional Git merge-driver adapter after the standalone Core is accepted.

### 3.2 Non-goals

The first design does not aim to:

- infer entity renames from textual or semantic similarity;
- merge invalid or partially parsed DSL documents as though their meaning were
  known;
- use last-writer-wins for task state, evidence, governance, or assurance;
- insert `<<<<<<<`, `=======`, or `>>>>>>>` markers into a candidate claimed to
  be a valid `.pert` document;
- infer an actual event, owner approval, outcome conformance, plan seal, or
  advance recoverability fact from Git topology or commit time;
- stage, commit, stash, reset, checkout, rebase, update a ref, push, or alter a
  Git configuration or attributes file;
- reconstruct arbitrary rename history, submodule content, binary patches, or
  multi-file transactions in version 1;
- promise optimal conflict minimization or automatic resolution of every
  semantically valid union; or
- select a release, public CLI spelling, result schema, or contract version.

## 4. Proposed architecture

```text
Git blob / index stage / worktree / file / stdin
  -> raw-byte capture and provenance
  -> Grammar 1..6 parse and complete validation
  -> Perttool.DocumentSemanticModel.v1
  -> semantic diff or three-way merge
  -> source-fidelity merge against an explicit source anchor
  -> source-preserving TextEdit planning
  -> complete candidate parse and validation
  -> lifecycle, assurance, governance, and protected-change classification
  -> candidate, native patch, unified projection, or typed conflicts
```

The semantic Core must remain pure. Repository discovery, Git subprocesses,
filesystem reads, optimistic locks, writes, and merge-driver adaptation belong
to separate application and I/O layers.

## 5. Whole-document semantic model

### 5.1 Candidate identity

The candidate closed model is named `Perttool.DocumentSemanticModel.v1` in
this proposal. It contains every modeled value of the selected Grammar version
and excludes only source representation facts that the Grammar declares
non-semantic.

The model includes:

- the project ID, declared Grammar version, every project field, and declared
  governance and assurance-model metadata;
- every resource, milestone, task, and gate identity and field;
- task and gate endpoints;
- exact durations, estimates, velocity, measurements, and capacity values;
- temporal values and their contract-defined declared meaning;
- task requirements, tags, owners, states, reasons, and source metadata;
- every work event and its complete payload;
- every explicit planning relation;
- every accepted seal component and reason;
- every task outcome and reason; and
- every assurance receipt and its complete payload.

The model does not include source spans, comments, blank lines, indentation,
BOM, line endings, final-newline state, declaration order, field order, or
equivalent lexical spelling. Those values belong to the source-fidelity lane.

### 5.2 Canonicalization

The later normative contract must define one canonical JSON representation
with at least these rules:

- UTF-8 without Unicode normalization;
- closed objects with fixed key order and no unknown fields;
- exact Rational values as reduced numerator and denominator strings plus a
  contract unit;
- safe integers only as JSON numbers;
- entities ordered by declaration kind and stable Unicode-scalar ID order;
- keyed child collections ordered by their semantic key; and
- field-specific rules that explicitly distinguish an ordered sequence from a
  set or map.

Until those field-specific rules are accepted, the conservative proposal is
to preserve a collection's normalized sequence unless an existing normative
contract already defines it as unordered or keyed. The implementation must not
silently sort a semantically ordered list merely to make merging easier.

### 5.3 Digests

Three identities remain distinct.

| Identity | Includes | Purpose |
| --- | --- | --- |
| `source_digest` | exact raw DSL bytes | exact-source locking and provenance |
| `semantic_digest` | canonical whole-document semantic model | semantic equality and patch preconditions |
| plan-assurance hashes | only the accepted planning contracts and bases defined by assurance model 1 | trust and start-authority evaluation |

The whole-document semantic digest intentionally changes for lifecycle state,
work events, reasons, and other semantic evidence. It must never be substituted
for a task plan contract hash, accepted basis hash, approval, or signature.

## 6. Native patch artifact

### 6.1 Candidate artifact

The candidate artifact identity is `Perttool.SemanticPatch.v1`. Canonical JSON
is preferred for the first version because it can use the existing closed
schema and canonical-hash practices without introducing a second hand-written
patch language.

Conceptual shape:

```json
{
  "schema_version": "Perttool.SemanticPatch.v1",
  "semantic_model_version": 1,
  "base": {
    "semantic_digest": "sha256:...",
    "source_digest": "sha256:...",
    "provenance": {
      "kind": "git_blob",
      "object_format": "sha1",
      "resolved_commit_id": "...",
      "blob_id": "...",
      "repository_relative_path": "plans/example.pert"
    }
  },
  "target": {
    "semantic_digest": "sha256:...",
    "source_digest": "sha256:..."
  },
  "changes": [
    {
      "operation": "replace",
      "subject": { "kind": "task", "id": "BUILD" },
      "path": ["status"],
      "before": "planned",
      "after": "done"
    }
  ],
  "source_delta": {
    "base_source_digest": "sha256:...",
    "target_source_digest": "sha256:...",
    "edits": []
  }
}
```

The exact key names, provenance variants, and source-delta representation are
not selected by this proposal.

### 6.2 Semantic operations

Every operation carries enough old and new information for validation,
contextual merge, and inversion.

- `add`: `before` is absent and `after` is one complete closed record.
- `remove`: `before` is one complete closed record and `after` is absent.
- `replace`: both values are present at one stable semantic path.

The project is a singleton subject. Globally keyed declarations use kind and
ID. A plan seal uses its task reference as its semantic key. Nested keyed
collections use paths such as a resource ID in `requires`, a predecessor task
ID in `accepted_inputs`, or a consumer task ID in receipt consumers.

An ID change is represented as remove plus add in version 1. A future explicit
rename operation requires its own identity and reference-rewrite contract; the
diff engine must not infer one from similarity.

Operations are canonically ordered only for artifact identity and review.
Application constructs one final model and does not expose or validate
intermediate operation states.

### 6.3 Source-fidelity lane

The native artifact may carry an exact-source delta bound to the base raw-byte
digest. It exists to retain comments, trivia, order, lexical spelling, BOM,
line endings, and final-newline state. It is not used to determine semantic
conflicts.

When the exact raw base matches, applying both lanes should reproduce the
target bytes. When only the semantic base matches, the semantic delta can be
rendered into the receiver's source style, but an exact source overlay must not
be relocated heuristically without reporting its loss or conflict.

The artifact must distinguish:

- `byte_exact`: semantic and source lanes both reproduced the target;
- `semantic_exact`: target semantics reproduced in receiver representation;
- `source_loss`: one or more source-only changes could not be transferred; and
- `conflict`: no trustworthy complete candidate exists.

## 7. Semantic diff

Both inputs must parse and validate completely under their declared Grammar
versions. Diff then:

1. captures raw-byte source identities and optional provenance;
2. projects both documents to the whole-document semantic model;
3. compares subjects by stable semantic identity;
4. compares matching records by contract field and keyed child;
5. emits complete add/remove records and field-level replacements;
6. records whether the raw sources differ outside the semantic delta;
7. computes base, target, patch, and artifact identities; and
8. validates that applying the semantic delta to the base model produces the
   target model exactly.

Formatting-only changes therefore produce an empty semantic change list and a
nonempty source-fidelity change. Exact Rational spellings that denote the same
contract value do not produce a semantic value change. A changed declared
field that affects compatibility or meaning remains semantic even when the
derived graph happens to be equivalent.

## 8. Patch application

### 8.1 Exact semantic application

Exact semantic application requires the receiver's semantic digest to equal
the patch base semantic digest. The receiver's formatting may differ. The
application:

1. verifies the artifact and operation preconditions;
2. constructs the complete target semantic model atomically;
3. plans source-preserving edits against the receiver;
4. reparses and revalidates the complete candidate;
5. reprojects the candidate and verifies the expected target semantic digest;
6. applies the exact source lane only when its base source digest matches; and
7. returns the candidate, edits, digests, fidelity, effects, and diagnostics.

### 8.2 Contextual three-way application

Contextual application is explicit; it is not a silent fallback after a stale
base. Each operation compares its `before` value with the current semantic
value.

- unchanged from base: apply the patch value;
- already equal to the patch value: deduplicate as a no-op;
- independently changed at a disjoint path: retain both changes;
- changed incompatibly at the same or enclosing path: return a conflict; and
- removed or replaced identity needed by another operation: return an identity
  or reference conflict.

A contextual result normally has a new semantic digest rather than the
patch's original target digest because it retains independent receiver
changes. The result must nevertheless prove that every accepted patch
postcondition holds and that the complete union validates.

## 9. Three-way merge

Given valid `BASE`, `OURS`, and `THEIRS` documents:

```text
ours_delta   = semantic_diff(BASE, OURS)
theirs_delta = semantic_diff(BASE, THEIRS)
merged_model = merge(ours_delta, theirs_delta)
```

The initial rules are conservative.

| Base/ours/theirs relationship | Decision |
| --- | --- |
| one side unchanged | take the changed side |
| both sides produce the same semantic value | deduplicate and take it |
| matching entity, disjoint fields | combine, then validate the union |
| same keyed collection, distinct child keys | combine, then validate the union |
| same field or child, different values | value conflict |
| delete versus modify | delete/modify conflict |
| add same global ID with different kind or payload | identity conflict |
| individually valid changes create an invalid union | domain conflict |

Domain conflicts include at least cycles, disconnected or unreachable finish,
dangling references, invalid joins, resource-capacity failure, incompatible
temporal fields, invalid task state, lifecycle-sequence failure, stale
assurance evidence, and receipt or advance-contraction inconsistency.

Conflict records need stable IDs and must contain:

- conflict kind and cause;
- subject and semantic path;
- base, ours, and theirs values when available;
- affected and related entity IDs;
- source provenance and spans when trustworthy;
- whether the conflict is semantic, source-only, authority-related, or caused
  by complete-candidate validation; and
- the required next action, without inventing an automatic resolution.

No authoritative `.pert` candidate is returned while unresolved conflicts
remain. A structured partial model may be useful internally, but it must not be
published as a valid merge result or written with ordinary conflict markers.

## 10. Lifecycle and actuals rules

Lifecycle data requires stricter rules than an ordinary scalar field.

### 10.1 Independent tasks

Progress on different task IDs should merge when the resulting document and
event reductions validate. The motivating clean case is one branch completing
task A while another branch completes task B.

### 10.2 Same task

The proposed first-version rules are:

- identical event ID and semantic payload: deduplicate;
- identical event ID and different payload: evidence-identity conflict;
- identical legacy status result: deduplicate;
- divergent legacy status results: lifecycle-state conflict;
- one branch's event sequence is a proven prefix of the other's sequence: the
  longer sequence may be selected after complete validation;
- independently appended, non-prefix transitions for the same task: concurrent
  lifecycle conflict even if a timestamp sort could form a valid sequence;
- two distinct finish events: conflict under actuals model 1; and
- a task-plan change concurrent with a start or completion based on the old
  plan: conflict when planned-value, lifecycle, or assurance postconditions do
  not prove compatibility.

This proposal deliberately does not treat state names as a monotonic lattice.
`active`, `blocked`, `suspended`, and `done` carry different resource and
evidence meaning, so lexical or apparent progress order is insufficient.

### 10.3 Semantic event order

When a union is otherwise permitted, work events retain the actuals contract's
semantic order by instant, event-kind order, and event ID. Source order remains
a representation concern. Stored task status and the reduced event sequence
must agree in the final candidate.

## 11. Plan-assurance and protected records

Plan-assurance evidence is not ordinary merge decoration.

1. Merge current plan contracts and relations first.
2. Recompute every affected contract, basis, and downstream assurance result
   on the combined model.
3. Retain an accepted seal only when its stored components still match the
   combined computation.
4. Return `reseal_required` rather than carrying a branch-local seal that is
   stale only after union.
5. Validate outcomes against their exact basis and receipts against their
   self-hash and retained consumer basis.
6. Never synthesize a seal, outcome, receipt, accepted owner, or conformance
   fact from branch topology, commit authorship, or a clean merge.

The pure diff may describe any difference between two valid documents,
including machine-managed records. Candidate generation and persistent
authority remain separate. A generic patch must not emulate `dag advance` and
bypass its assurance-preserving contraction or history-safety proof.

The later contract must classify at least:

- ordinary plan maintenance;
- governed goal or DAG change;
- plan-assurance change;
- lifecycle/evidence change;
- destructive advance-equivalent change; and
- unsupported protected-record change.

## 12. Source-only changes

Normalized semantics alone are insufficient for safe Git integration because
comments and explanatory layout are tracked source information. The merge
must use a separate source-fidelity decision.

The preferred first-version approach is ownership-aware and conservative.

- Leading comments use the existing declaration and field ownership rules.
- A one-sided source-only change on an otherwise unchanged owner can be
  transferred.
- Identical source-only changes deduplicate.
- Divergent source-only changes to the same owner conflict.
- A source-only change and a semantic change on disjoint owned spans may
  combine.
- A source-only change overlapping a semantically replaced owner conflicts
  unless an accepted renderer can prove exact preservation.
- Standalone comments and blank lines require stable before/between/after
  anchors; missing or ambiguous anchors conflict rather than disappearing.
- Representation-only spelling changes follow the same one-sided/identical/
  divergent rule.

`OURS` is the proposed source anchor for a normal three-way merge. That choice
preserves the current branch's unchanged representation while transplanting
accepted `THEIRS` semantic and source-only changes. It does not authorize
silently discarding a `THEIRS` comment when its anchor is ambiguous.

## 13. Git source model

### 13.1 Source selectors

The Core receives bytes and provenance, not a command-line string. Candidate
application selectors include:

- a regular file or stdin;
- a worktree path;
- a commit-ish revision and repository-relative path;
- an exact blob object ID and path provenance;
- index stage 0 for a normal staged blob; and
- index stages 1, 2, and 3 for base, ours, and theirs.

A compact review spelling such as `git:<revision>:<path>` is possible, but the
public contract may instead use separate `--revision`, `--path`, and `--repo`
operands to avoid path ambiguity. This proposal selects the semantic source
types, not their CLI spelling.

Every Git source result records:

- object format (`sha1` or `sha256`);
- requested revision, when present;
- resolved commit/tree/blob IDs;
- repository-relative path;
- raw source digest;
- semantic digest after successful validation; and
- typed unavailable or race causes.

The reader disables prompts, optional locks, replacement objects, lazy fetch,
and inherited repository-routing environment in the same spirit as the
existing history probe. It reads local objects only.

### 13.2 Merge-base handling

For direct revision merge, a unique merge base may be resolved and captured
before blob reads. Multiple merge bases must not be reduced by arbitrary
ordering. Version 1 should either:

- fail with `multiple_merge_bases`; or
- accept only the virtual ancestor supplied explicitly by Git's merge
  machinery.

The standalone `--index`-style adapter avoids this decision by consuming the
stage-1 base chosen by Git together with stage 2 and stage 3.

### 13.3 Paths and renames

The reader resolves the exact requested repository-relative path. Missing
paths, type changes, symlinks, submodules, and contradictory path evidence are
typed outcomes. Version 1 does not infer a rename from similarity. A caller may
explicitly provide different old and new paths to diff two blobs, but that does
not by itself create a semantic entity-rename operation.

## 14. Git merge-driver adapter

Git custom merge drivers receive temporary ancestor, current, and other files
and expect the result in the current-side temporary file. The proposed driver
adapts those three byte sources and the repository path to the accepted
three-way Core.

Driver behavior must be:

- overwrite the current-side temporary file only for a complete clean result;
- return zero only when the written bytes revalidate and equal the reported
  candidate digest;
- return a normal nonzero conflict status without inserting invalid DSL
  markers when semantic, source, protected-record, or authority conflicts
  remain;
- distinguish an expected merge conflict from process or internal failure;
- never call `git add`, write the index directly, update a ref, create a commit,
  or change Git configuration; and
- expose a concise machine-readable or stderr conflict summary without a
  repository sidecar transaction.

Initial delivery should stop at manual `BASE/OURS/THEIRS` or index-stage merge.
Installing `.gitattributes` and `merge.<driver>` configuration is a later,
explicitly authorized adoption step. Recursive internal merging of multiple
common ancestors should use a conservative Git policy rather than recursively
claiming semantic success before that case is accepted.

## 15. Unified diff conversion

### 15.1 Native patch to unified diff

A semantic patch alone has no line numbers, context, labels, or exact target
representation. Conversion therefore requires one concrete base source.

- If the raw base matches and the source delta is complete, reconstruct the
  exact target and emit an exact unified diff.
- If only the semantic base matches, render the target into the receiver's
  source style and label the unified diff `rendered`, not byte-exact.
- If no complete base is available, fail rather than inventing context.

The current single-middle-hunk emitter is valid for existing mutation preview.
The source-control feature should evaluate a deterministic multi-hunk
line/Myers projection so distant semantic changes do not replace an arbitrarily
large unchanged middle.

### 15.2 Unified diff to native patch

A unified diff is normally incomplete: context lines do not reconstruct the
unmodified source. Conversion requires either:

- a complete base DSL to which the textual patch applies unambiguously; or
- resolvable old and new blob IDs in a repository, followed by verification
  that they match the patch.

After reconstructing complete before and after sources, both documents are
parsed and validated and the ordinary semantic diff produces the native
artifact. Without both complete documents, conversion fails with typed
insufficient-source information.

Formatting-only unified changes produce an empty semantic delta and a nonempty
source delta. Multi-file, binary, mode-only, copy, and inferred rename patches
are outside the first version. A semantic round trip guarantees normalized
semantic equivalence; it does not promise identical hunk boundaries, labels,
timestamps, or extended headers.

## 16. Candidate public surface

The repository's hierarchical command style suggests these review names:

```text
perttool document diff <base-source> <target-source>
perttool document patch <receiver-source> --patch <artifact>
perttool document merge <base-source> <ours-source> <theirs-source>
perttool document merge --index <repository-relative-path>
```

Possible result and artifact identities are:

- `Perttool.DocumentSemanticModel.v1`;
- `Perttool.SemanticPatch.v1`;
- `Perttool.SemanticDiffResult.v1`;
- `Perttool.SemanticPatchResult.v1`;
- `Perttool.SemanticMergeResult.v1`; and
- `Perttool.SemanticMergeConflict.v1`.

These names are not reserved. The active command catalog and result schemas
are closed under CLI Contract 7, so public addition requires an explicit
interface-version decision. The `.pert` source Grammar need not change merely
to add an external patch artifact, but any new in-document conflict, archive,
or identity syntax would require a separate Grammar decision.

Preview remains the default. A result should expose:

- all input source and semantic identities;
- operation and algorithm model versions;
- deterministic changes and conflicts;
- candidate text, digest, unified projection, and edits only when trustworthy;
- fidelity status and source-loss records;
- affected governance and protected-record scopes;
- validation diagnostics; and
- write state only after the existing write boundary succeeds.

## 17. Persistence and authority

A clean semantic candidate is not persistent authority.

- Standalone in-place writes retain pre-change governance classification,
  warning policy, expected digest, current digest, symlink and path identity,
  atomic replacement, and post-write validation.
- A changed candidate affecting multiple scopes requires all applicable
  authority in one decision.
- A prior owner assertion or governance decision is not reusable for a merged
  candidate.
- Destructive advance-equivalent changes retain repository-baseline and
  history-safety requirements or are rejected as unsupported generic patch
  writes.
- Assurance evidence is validated but not accepted merely because hashes are
  internally consistent.
- Merge-driver execution must not claim that Git invocation authenticates an
  owner or accepts a plan.

An open design decision is whether the first merge driver refuses every
governed-scope change and returns it for manual resolution, or writes a valid
candidate while explicitly making no governance-enforcement claim. The safer
initial policy is to auto-resolve only authority-neutral changes, including
compatible independent lifecycle progress, and require an interactive path for
goal, structural DAG, owner, and assurance-scope changes.

## 18. Initial acceptance matrix

The later normative contract should assign fixed machine-readable fixtures to
at least these cases.

| ID | Case | Required result |
| --- | --- | --- |
| `SDM-001` | comment or whitespace only | empty semantic delta; nonempty source delta |
| `SDM-002` | equivalent exact Rational spelling | no semantic numeric change |
| `SDM-003` | one task field change | one stable field replacement with before/after |
| `SDM-004` | connected milestone and edge additions | one final valid atomic candidate |
| `SDM-005` | exact patch on original bytes | byte-exact target and target digests |
| `SDM-006` | patch on semantically equal reformatted source | semantic-exact receiver-style candidate |
| `SDM-007` | contextual disjoint receiver change | both changes retained and validated |
| `SDM-008` | contextual same-field divergence | typed value conflict; no candidate |
| `SDM-009` | separate tasks progress on separate branches | clean lifecycle merge |
| `SDM-010` | identical work-event ID and payload | deduplicated clean merge |
| `SDM-011` | identical work-event ID, different payload | evidence-identity conflict |
| `SDM-012` | concurrent non-prefix transitions on one task | lifecycle conflict |
| `SDM-013` | disjoint graph edits create a cycle | union-validation conflict |
| `SDM-014` | disjoint edits exceed resource capacity | resource union conflict |
| `SDM-015` | plan union invalidates an accepted basis | reseal-required conflict/action |
| `SDM-016` | divergent owned comment changes | source-fidelity conflict |
| `SDM-017` | ambiguous standalone trivia anchor | source-fidelity conflict; no silent loss |
| `SDM-018` | SHA-1 ref/blob inputs | resolved immutable provenance and clean read |
| `SDM-019` | SHA-256 ref/blob inputs | resolved immutable provenance and clean read |
| `SDM-020` | index stages 1/2/3 | same Core result as equivalent explicit blobs |
| `SDM-021` | linked worktree input | correct common repository and relative path |
| `SDM-022` | multiple merge bases | typed conservative stop or explicit Git base only |
| `SDM-023` | unified diff with complete base | reconstructed documents and native artifact |
| `SDM-024` | unified diff without complete base/blob pair | insufficient-source failure |
| `SDM-025` | merge-driver semantic conflict | nonzero conflict, valid current-side bytes, no markers |
| `SDM-026` | governed merged candidate | no persistent authority without a fresh decision |
| `SDM-027` | advance-equivalent destructive patch | no bypass of history-safety and assurance contraction |
| `SDM-028` | repository observation audit | no index, ref, commit, config, attribute, or history mutation |

Acceptance also needs BOM/CRLF, no-final-newline, intentional Unicode, block
text, field and declaration order, source comments, invalid inputs, warning
policy, read races, temporary link, isolated package, schemas, help, Guide, and
determinism coverage.

## 19. Proposed refinement order

If `SCM-001` is selected, refine it in this order:

1. accept whole-document semantic-model coverage and canonical vectors;
2. accept the native artifact, source-fidelity contract, and conflict taxonomy;
3. implement pure semantic diff and inversion;
4. implement exact and contextual patch planning;
5. implement three-way merge and complete-candidate validation;
6. close actuals, assurance, governance, and advance protected-change rules;
7. implement read-only Git blob, ref, merge-base, and index-stage adapters;
8. implement unified-diff projections and conversion loss reporting;
9. select the public CLI, result schemas, help, and package boundary; and
10. only then consider opt-in merge-driver installation and Git workflow
    acceptance.

The selected workstream must begin from current requirements and a fresh
complete task-selection authority result. This document does not create that
workstream or authorize any implementation, Git configuration, release, or
remote operation.
