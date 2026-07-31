# Advance History Safety Contract

- Status: Normative 1.0
- History-safety model version: 1
- Target grammar: Grammar 5, with Grammar 1 through 4 compatibility
- Active CLI contract during design: Contract 6
- Requirements: [../requirements.md](../requirements.md)
- Backlog: [`ADV-001`](../backlog.md#adv-001-guard-advance-writes-that-can-erase-uncommitted-history)
- Accepted correction: [`ADV-002`](../backlog.md#adv-002-keep-advance-candidates-repository-clean-without-a-second-edit)

## 1. Purpose

`dag advance` removes source that no longer affects the present or future
graph. Source digests, candidate validation, and atomic replacement protect
against stale or partial writes, but they do not prove that the exact
current-side information being removed is already durable in Git.

History-safety model 1 adds one repository-aware guard to a changed in-place
advance write. The guard blocks only destructive source ranges that cannot be
matched exactly to the target path in `HEAD` and the stage-0 index. It does
not reject unrelated dirty paths or dirty source ranges that remain in the
advance candidate.

The guard is read-only with respect to Git. It never stages, commits, stashes,
checks out, resets, updates a ref, or searches reflogs or unreachable
objects.

## 2. Normative precedence and boundaries

The applicable order is:

1. requirements in `docs/requirements.md`;
2. this contract;
3. project-actuals source ownership and the read-only Git boundary in
   [Project Actuals and Git History Contract](project-actuals.md);
4. candidate and `TextEdit` invariants in
   [Mutation Semantics](mutation.md);
5. pre-change owner authority in
   [Governance Interface Contract](governance-interface.md);
6. safe file replacement in [CLI Interface](interfaces.md); and
7. process guidance in `docs/process/`.

History safety is not owner authentication, a recommendation override, a
durable approval ledger, or a Git mutation. It cannot authorize a governance
denial or bypass candidate validation, expected-digest checks, source
identity, symlink rejection, post-write validation, or atomic replacement.

## 3. Terms and identities

### 3.1 Destructive advance record

A destructive advance record identifies one non-empty current-source range
that an advance `TextEdit` removes or replaces:

```ts
interface AdvanceDestructiveRecordV1 {
  readonly entityKind: "task" | "gate" | "milestone" | "work_event";
  readonly entityId: string;
  readonly field: "declaration" | "state";
  readonly startOffset: number;
  readonly endOffset: number;
}
```

Offsets are zero-based UTF-16 code units in the exact current source and use
half-open ranges. `startOffset < endOffset` is required. A declaration record
includes the leading comments owned by that declaration under Mutation
Semantics. A zero-width insertion is not destructive.

For the accepted `ADV-002` correction, a declaration in the terminal
removed-declaration suffix also owns the exact consecutive blank-line prefix
defined as advance-owned terminal separator trivia in Mutation Semantics
Section 12.2. Its `startOffset` moves backward over that prefix, so the edit
and destructive record cover identical current-source bytes. Ownership stops
at nonblank standalone trivia and does not expand any retained or interior
range. This is a narrow extension of the declaration correspondence rule, not
a global whitespace normalization.

The record set is derived by the advance planner from the same validated
source and edit set used to build the candidate. An adapter MUST NOT infer
destructive entities from the unified diff text.

### 3.2 Repository baseline

The baseline is the exact target path in the repository's current `HEAD`
commit. It is bound to:

- the repository snapshot identity;
- the repository-relative target path;
- the `HEAD` object ID;
- the raw `HEAD:<path>` blob;
- the stage-0 index blob for the same path;
- the raw current-source digest; and
- the advance candidate digest.

The index is evidence of uncommitted state, not durable history. A stage-0
index range that differs from `HEAD` inside a destructive record blocks the
write even when the working-tree range was later restored to the `HEAD`
bytes. An unmerged index has no safe stage-0 baseline.

### 3.3 Public identities

The first runtime activation targets:

```text
history-safety model       1
CLI command                dag advance
new option                 --force-history-loss
success result             Perttool.AdvanceResult.v1
diagnostics                PTADV-101, PTADV-102, PTADV-103
```

`Perttool.AdvanceResult.v1` retains every root, candidate, write,
governance, lifecycle, and advance-summary field from
`Perttool.MutationResult.v3`. It requires the existing `advance` field and
adds the required nullable `history_guard` field defined in Section 8.

The new identity is deliberate. `Perttool.MutationResult.v3` and its bundled
schema are closed contracts, so adding a root or nested property under that
identity would make a new result fail validation against the already
published artifact. Direct, batch, and lifecycle mutations continue to
return `Perttool.MutationResult.v3`. Runtime activation adds one root schema
and changes only the `dag advance` descriptor to advertise
`Perttool.AdvanceResult.v1` plus `Perttool.CliError.v1`.

This target retains Grammar 5 and CLI Contract 6 command names. Release
version selection and publication remain separate decisions.

## 4. Applicability

The guard is assessed only when all of the following are true:

1. the input is an on-disk file;
2. the requested effect is in-place `--write`;
3. the original document and advance request are valid;
4. the candidate is valid and `changed=true`;
5. the advance plan contains at least one destructive record;
6. governance authorizes persistent intent; and
7. warning policy has not already denied persistence.

When a trustworthy candidate exists but the guard is not applicable, the
result has `history_guard.status="not_applicable"` and one of these exact
causes:

| Cause | Meaning |
| --- | --- |
| `preview` | Default preview or `--diff`; no Git inspection occurs. |
| `separate_output` | `--out` preserves the input file; no Git inspection occurs. |
| `no_change` | The in-place advance is an idempotent no-op. |
| `no_destructive_records` | The candidate only inserts source and removes no current bytes. |
| `authority_denied` | Governance rejected persistent intent before Git inspection. |
| `warning_denied` | Existing warning policy rejected persistent intent before Git inspection. |

When no trustworthy candidate exists, `history_guard=null`; there is no
history-guard cause because the candidate diagnostics retain authority.

Stdin remains incompatible with `--write`. Read-only `document`, `project`,
`dag analyze`, `dag next`, ordinary mutation preview, and advance preview do
not acquire a Git requirement.

## 5. Exact proof rule

### 5.1 Correspondence

The pure assessor receives validated decoded documents for `HEAD` and the
current source, the raw stage-0 index blob, and the destructive records. It
locates corresponding source ranges in `HEAD` and the current source by exact
entity kind and ID:

- `field="declaration"` maps to the complete declaration and its owned
  leading comments and, for the `ADV-002` terminal suffix, the exact
  advance-owned terminal separator prefix;
- `field="state"` maps only to the existing milestone `state` value range.

Each decoded document must contain at most one corresponding entity because
normal semantic validation has already rejected duplicate IDs. Raw bytes are
compared after mapping the validated UTF-16 spans back to the captured byte
buffers. BOM and CRLF bytes are significant.

The stage-0 index is not required to be a globally valid `.pert` document.
The assessor derives a deterministic raw-byte edit script from the complete
`HEAD` blob to the complete index blob. Model 1 uses a Myers shortest-edit
script over unsigned byte values. At an equal-length path choice it takes
deletion from `HEAD` before insertion into the index; remaining equal
furthest-reaching positions use the smaller `HEAD` offset and then the
smaller index offset. A staged edit overlaps a destructive `HEAD` range when
it removes or replaces any byte in the half-open range, or inserts bytes
strictly inside that range. An insertion exactly at either boundary is
outside that range. This rule lets an unrelated staged syntax error remain
outside the guard while still detecting every staged edit to the baseline
bytes being destroyed.

A destructive record is recoverable only when:

1. the corresponding `HEAD` range exists and is byte-identical to the
   current destructive range; and
2. the stage-0 index blob exists and its raw-byte edit script has no overlap
   with the corresponding `HEAD` range.

Every destructive record must be recoverable for status `passed`.

This entity-and-field rule avoids a repository-wide dirty shortcut. A title,
description, resource, task, or comment edit outside every destructive record
does not block merely because it is in the same file. A changed byte inside a
removed declaration, its owned comments, a removed work event, or a replaced
state value blocks.

For the `ADV-002` correction, a changed or staged byte inside an advance-owned
terminal separator prefix also blocks. `HEAD` correspondence extends backward
by the exact same prefix; the assessor never silently adds current-only trivia
to a recoverable record. Preview remains Git-independent, while the later
in-place assessment proves the exact bytes that the already constructed
single candidate removes.

### 5.2 Unavailable proof

The proof is unavailable and therefore blocked when any of these stable
causes applies:

```text
no_repository
no_head
untracked_target
ambiguous_path
unmerged_index
git_unavailable
baseline_read_failed
baseline_invalid
correspondence_missing
correspondence_ambiguous
```

An uncommitted rename is not reconstructed through similarity heuristics. If
the current relative path is absent from `HEAD`, the result is
`untracked_target`; contradictory path evidence is `ambiguous_path`.
A committed rename is ordinary because `HEAD` owns the current path.

Git-unavailable includes process start, timeout, malformed output, and
command failure. Public results identify the stable cause and operation but
do not include an absolute repository path, temporary path, environment
value, or command stderr.

### 5.3 Dirty overlap

If correspondence exists but either current or index bytes differ from
`HEAD`, the result is blocked with cause `destructive_overlap`. The result
lists affected entity IDs in stable ASCII order without copying the removed
source text into a diagnostic.

Staged and unstaged modifications are evaluated independently. A staged
change cannot become durable merely because it is in the index, and a later
unstaged edit cannot conceal a staged destructive overlap.

## 6. Read-only adapter and composition

### 6.1 Shared boundary

`ADV-001` and project history share repository discovery, linked-worktree
resolution, repository-relative path rules, object-format handling, `HEAD`
identity, raw blob reading, current-source capture, and race hooks from
`src/history/`.

They remain separate application decisions:

- project history walks first-parent snapshots and reduces evidence;
- advance history safety reads only the current `HEAD` and stage-0 index
  baselines needed for one write decision;
- neither calls the other's application service or result projector.

The pure history-safety assessor receives captured values as dependencies and
does not spawn Git, read the filesystem, inspect a clock, or mutate state.

### 6.2 Write ordering

A changed in-place advance follows this order:

1. capture the regular-file source and digest through the existing safe-read
   boundary;
2. plan and validate the advance candidate and destructive records;
3. evaluate pre-change governance with `intent="persist"`;
4. if applicable, capture `HEAD`, index, path, and raw baseline blobs;
5. run the pure history-safety assessment;
6. stop on `blocked`, unless the exact request contains the force option;
7. immediately before replacement, recheck the original file identity and
   digest and the repository/path/`HEAD`/stage-0-index binding;
8. execute the existing atomic safe write; and
9. perform the existing candidate digest and semantic post-write checks.

An unauthorized governance decision returns before Step 4. History safety
does not turn an unauthorized candidate into an authorized one.

## 7. Force boundary

The exact option is:

```text
--force-history-loss
```

It is valid only on `dag advance <file> --write`. It conflicts with stdin,
`--diff`, and `--out`. It bypasses only an initial `blocked` history-safety
assessment and produces `status="forced"`, `cause="forced_by_option"`, and
warning `PTADV-103`.

The force option does not bypass:

- document, request, or candidate validation;
- governance or `--warnings-as-errors`;
- `--expect-digest`;
- source/path/symlink identity;
- source or `HEAD` rechecks;
- atomic replacement; or
- post-write digest and semantic validation.

A force request on a no-op or a candidate without destructive records is
valid but remains `not_applicable`; it does not claim that history loss
occurred. An agent instruction to perform ordinary work, release work, or a
prior advance is not implicit authority to add this option to a later
candidate.

## 8. Result contract

For a trustworthy advance candidate:

```ts
interface AdvanceHistoryGuardV1 {
  readonly model_version: 1;
  readonly status: "not_applicable" | "passed" | "blocked" | "forced";
  readonly cause:
    | "preview"
    | "separate_output"
    | "no_change"
    | "no_destructive_records"
    | "authority_denied"
    | "warning_denied"
    | "baseline_matches"
    | "destructive_overlap"
    | "no_repository"
    | "no_head"
    | "untracked_target"
    | "ambiguous_path"
    | "unmerged_index"
    | "git_unavailable"
    | "baseline_read_failed"
    | "baseline_invalid"
    | "correspondence_missing"
    | "correspondence_ambiguous"
    | "forced_by_option";
  readonly repository_snapshot_id: string | null;
  readonly repository_relative_path: string | null;
  readonly head_commit_id: string | null;
  readonly source_digest: string;
  readonly candidate_digest: string;
  readonly source_modified_at: string | null;
  readonly source_bytes: number;
  readonly candidate_bytes: number;
  readonly diff_added_lines: number;
  readonly diff_removed_lines: number;
  readonly destructive_entity_ids: readonly string[];
  readonly overlapping_entity_ids: readonly string[];
  readonly force_requested: boolean;
}
```

IDs are sorted by exact ASCII code-unit order. Byte and diff counts are the
primary human context; repository snapshot and content digests are
supplemental machine bindings. `source_modified_at` is the captured regular
file modification time normalized as an ISO UTC date-time and is null for a
non-file input.

`history_guard=null` only when no trustworthy candidate exists. A blocked
result retains the candidate, diff, edits, advance summary, and governance
decision, sets `ok=false` and `write.written=false`, and emits `PTADV-101`.
A passed or forced result may proceed to safe write. A post-assessment source
or repository-baseline binding race emits `PTADV-102`, returns exit 5, and
never writes.

The text projection presents, in this order:

1. status and cause;
2. repository-relative target and short `HEAD` identity when available;
3. source modification time;
4. source and candidate byte sizes;
5. added and removed line counts;
6. destructive and overlapping entity IDs; and
7. force state.

Digests may follow this explanation but MUST NOT replace it.

## 9. Diagnostics and exits

| Code | Severity | Exit | Meaning |
| --- | --- | ---: | --- |
| `PTADV-101` | error | 1 | History proof is blocked or unavailable. `data` contains the stable cause and affected entity IDs. |
| `PTADV-102` | error | 5 | The source or repository/`HEAD`/stage-0-index binding changed after assessment. |
| `PTADV-103` | warning | 0, or 1 under `--warnings-as-errors` | The request explicitly forced a blocked history assessment. |

Invalid option combinations use the existing structured usage-error
boundary and exit 2. Existing `PTIO-501`, `PTIO-502`, and `PTGOV-101`
retain their meanings. Do not translate a candidate diagnostic into
`PTADV-*`.

## 10. Acceptance matrix

The machine-readable authority is
[`test/fixtures/advance-history-contract-v1.json`](../../test/fixtures/advance-history-contract-v1.json).
It fixes these cases:

| ID | Required outcome |
| --- | --- |
| `AHS-001` | Preview is not applicable and performs no Git inspection. |
| `AHS-002` | Separate output is not applicable and preserves the source. |
| `AHS-003` | An in-place no-op is not applicable without Git. |
| `AHS-004` | A tracked destructive range identical in `HEAD`, index, and current source passes. |
| `AHS-005` | An unstaged destructive-range modification blocks. |
| `AHS-006` | A staged destructive-range modification blocks. |
| `AHS-007` | A dirty range retained by the candidate does not block, including globally invalid staged syntax outside destructive ranges. |
| `AHS-008` | A changed owned leading comment blocks. |
| `AHS-009` | An uncommitted task-owned work event blocks. |
| `AHS-010` | No repository, no `HEAD`, or an untracked target fails closed. |
| `AHS-011` | An unmerged or ambiguous index/path fails closed. |
| `AHS-012` | A linked worktree uses its shared repository and worktree-local `HEAD` safely. |
| `AHS-013` | An uncommitted rename fails closed without similarity inference. |
| `AHS-014` | BOM and CRLF are compared as exact raw bytes. |
| `AHS-015` | Force records the bypass but preserves every other validation and write gate. |
| `AHS-016` | A source race after assessment returns exit 5 and writes nothing. |
| `AHS-017` | A `HEAD` or stage-0 index race after assessment returns exit 5 and writes nothing. |
| `AHS-018` | Text, JSON, help, Guide, schema, package, and installed behavior agree. |

## 11. Non-goals

History-safety model 1 does not:

- reject a write solely because the repository or target file is dirty;
- search other branches, merge parents, tags, reflogs, unreachable objects,
  chat, or terminal output;
- create or request a commit automatically;
- protect ordinary `task|gate|milestone remove`;
- add recommendation override apply, MIG-08, approval certificates, or
  durable authorization audit;
- authenticate the caller or owner;
- mutate Git, publish a package, move a dist-tag, or close an Issue; or
- guarantee recovery after an explicit force.

## 12. Runtime activation gate

This contract alone does not activate the guard. Runtime acceptance requires:

1. the pure assessment and shared read-only adapter extension;
2. focused raw-byte, staged/unstaged, retained-dirty, comment, event, race,
   worktree, rename, BOM, and CRLF tests;
3. atomic `dag advance` integration and the exact force boundary;
4. `Perttool.AdvanceResult.v1`, its complete Draft 2020-12 schema, registry
   symmetry, text projection, command help, and Guide;
5. repository, temporary-link, package, and isolated installed checks; and
6. no regression in governance, expected-digest, safe-write, Grammar 1
   through 5, or unrelated no-Git commands.

Release preparation, publication, npm tags, and Issue state remain outside
this gate.
