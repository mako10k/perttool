# Explicit Project-History Provenance Choice

Status: Accepted implementation contract for `ACT-005` / Issue #6.

## Purpose

The project-history Git probe keeps automatic rename inference fail-closed but
adds one explicit, auditable interpretation for a path that intentionally
starts a new project history. The correction is read-only. It does not modify
Git, declare a velocity, or grant mutation authority.

## Request model

Both `project history` and `project observe-velocity` accept:

```text
--history-provenance automatic|new-root
```

`automatic` is the default and preserves the current behavior. Any detected
rename leaves history `incomplete` with `unsupported_rename`.

`new-root` asks perttool to treat the first commit that records the selected
repository-relative path as the root of the selected project history. It does
not accept or follow a predecessor path. The request is effective only when:

1. the selected endpoint and every retained snapshot parse as a supported
   project source;
2. every retained snapshot has the endpoint project ID;
3. rename evidence exists at the first retained snapshot;
4. each excluded predecessor candidate can be read from that snapshot's first
   parent and has a project ID different from the endpoint project ID;
5. repository, path, resolved revision, HEAD, endpoint source digest, root
   commit, root source digest, and excluded predecessor evidence remain stable
   through the existing final race check.

Missing, malformed, multiple, unreadable, same-project, or changed predecessor
evidence fails closed. Explicit `new-root` never turns a shallow, invalid,
conflicting, or otherwise incomplete history into a complete history.

## Evidence and projection

Project-history metadata additively exposes one `provenance` object:

```ts
interface ProjectHistoryProvenanceV1 {
  readonly modelVersion: 1;
  readonly requestedMode: "automatic" | "new_root";
  readonly effectiveMode: "automatic" | "new_root";
  readonly overrideApplied: boolean;
  readonly rootCommitId: string | null;
  readonly rootSourceDigest: string | null;
  readonly excludedPredecessors: readonly {
    readonly path: string;
    readonly commitId: string;
    readonly sourceDigest: string;
    readonly projectId: string;
  }[];
}
```

Ordering is UTF-8 path, then commit ID. Automatic requests expose
`effectiveMode=automatic`, `overrideApplied=false`, and empty explicit-root
evidence. Successful `new-root` exposes the exact evidence above and removes
only the corresponding `unsupported_rename` cause. Text and JSON results use
the same values. Velocity observation reuses the identical history object.

The public result identities remain `Perttool.ProjectHistoryResult.v1` and
`Perttool.VelocityObservationResult.v1`; their schemas receive additive
required provenance fields. Grammar 8, CLI Contract 9, the command count, and
all mutation authority remain unchanged.

## Diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `PTHIS-102` | warning | Automatic inference or another existing history boundary remains incomplete. |
| `PTHIS-105` | error | Explicit `new-root` evidence is unavailable, ambiguous, stale, malformed, or refers to the same project identity. |

`PTHIS-105` returns history `unavailable`, no measured Velocity candidate, and
machine data containing a closed cause. It never falls back silently to
automatic interpretation.

## Acceptance cases

The normative cases are in
`test/fixtures/history-provenance-choice-contract-v1.json`.

- automatic compatibility and real rename refusal;
- successful false-rename `new-root` recovery;
- same-project predecessor refusal;
- missing, multiple, malformed, and unreadable rename evidence;
- stale source, HEAD, path, and root-evidence races;
- shallow history composition;
- SHA-1, SHA-256, linked-worktree, and unusual path handling;
- identical project-history and velocity-observation evidence;
- Help, Guide, schema, temporary-link, and installed-package parity;
- proof of unchanged repository, index, refs, source bytes, and declared
  velocity.

## Deferred Git integration

The following are intentionally excluded from this implementation and remain
in `SCM-002`:

- explicitly accepting a reviewed predecessor path or project;
- configuring or replacing Git's similarity threshold;
- copying, moving, staging, committing, rewriting, or otherwise mutating Git
  provenance;
- durable cross-command provenance receipts or Git notes.

Those capabilities require a separate source-control authority, audit, and
write-safety contract. They must reuse this evidence model rather than weaken
`automatic` or reinterpret `new-root`.
