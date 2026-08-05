# Adapter Document Session Core Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `DOCUMENT_SESSION_CORE`
- Normative contract: [../specs/document-session.md](../specs/document-session.md)
- Editor protocol: [../specs/editor-protocol.md](../specs/editor-protocol.md)
- Parent architecture: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Machine cases: [../../test/fixtures/document-session-cases-v1.json](../../test/fixtures/document-session-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted outcome

`src/session/document-session.ts` implements one protocol-neutral immutable
document-state owner and exposes it only through `perttool/core`. Stateless
consumers can create and analyze one exact snapshot; connection-oriented
consumers can open, incrementally change, close, reopen, resolve, project, and
analyze URI-bound generations without reading a file or importing a protocol.

Every snapshot binds exact URI, session generation, safe-integer version,
synchronized text, injected lowercase SHA-256 identity, active Grammar 6 parse
state, semantic diagnostics, and truncation state. UTF-16 conversion handles
LF, CRLF, lone CR, surrogate pairs, line ends, and invalid boundaries without
rounding. Ordered ranged changes are applied to a temporary candidate and
publish exactly one new frozen snapshot.

Invalid DSL remains a current diagnostic snapshot. Duplicate open, missing
document, non-increasing or invalid version, malformed or empty change, and
digest failure clear all state and terminally desynchronize the session. A
new connection/session is required for recovery.

## 2. Analysis and cache evidence

The analysis path reuses the accepted snapshot parse and semantic result. It
supports `none`, `precedence`, `resource`, and `both`; invalid or truncated
input returns no analysis. Capacity overrides are copied before asynchronous
work and stable cache-key construction, so caller mutation cannot change the
accepted request.

The generic projection cache is weakly scoped to one immutable snapshot and a
non-empty adapter-owned key. It stores only a completed value after
cancellation and exact binding are rechecked. A newer version, close, reopen,
dispose, desynchronization, or observed cancellation returns no value and
cannot populate the cache. A repeated current request returns the completed
value by reference.

## 3. Core and compatibility evidence

| Surface | Accepted source result |
| --- | --- |
| `perttool/core` | original forty values plus five document-session values; exact 45-name catalog |
| Core runtime closure | exact 34 modules; no Node builtin or external package |
| `perttool` | unchanged exact 121-name compatibility facade |
| `perttool/node` | unchanged exact 121-name root-identical facade |
| CLI | unchanged Contract 7 with 44 commands and 20 root schemas |
| production dependencies | unchanged zero |

The five new runtime values are `analyzeDocumentSnapshot`,
`createDocumentSession`, `createDocumentSnapshot`,
`documentOffsetToPosition`, and `documentPositionToOffset`. They are Core-only;
neither the root nor Node facade acquires them. The session receives hashing as
an inward function and does not import `node:crypto`, so general Node Host
separation remains unimplemented.

## 4. Machine cases

| Case | Accepted evidence |
| --- | --- |
| `DSC-001` | exact frozen Grammar 6 snapshot and digest binding |
| `DSC-002` | exact UTF-16, newline, surrogate, and invalid conversion |
| `DSC-003` | ordered atomic change and retained immutable predecessor |
| `DSC-004` | close/reopen receives a distinct generation |
| `DSC-005` | lifecycle, version, range, and digest failures are terminal |
| `DSC-006` | invalid DSL remains current but has no analysis value |
| `DSC-007` | all four analysis modes reuse one validated snapshot |
| `DSC-008` | completed projection cache is snapshot and option scoped |
| `DSC-009` | async completion after change returns stale and is not cached |
| `DSC-010` | observed cancellation returns no value and is not cached |
| `DSC-011` | exact portable Core catalog and static closure |
| `DSC-012` | root, Node, CLI, schema, dependency, and side-effect boundaries retained |

## 5. Verification

Focused verification covers all twelve cases and the original additive
shared-library baseline. The repository-wide gate then checks every source,
historical compatibility suite, all self-use plans, Markdown, English
baseline, temporary local-link workflow, and isolated package workflow.

```sh
npm run build
node --test test/document-session-core.test.mjs test/adapter-shared-library.test.mjs
npm run check
git diff --check
```

The complete gate passed in the completed-task state. The completed plan
source digest is
`sha256:1adc6eb1a054e5ae5919365ba4e96a81b01924a9ca01c0701e9326ca4b8ffe5e`.

## 6. Retained boundaries

- LSP transport, standard capability mapping, `Perttool.GraphViewResult.v1`,
  language-server composition, and isolated server acceptance remain later
  editor-branch tasks.
- Node filesystem, Git, hashing, artifact, persistence, and cancellation-port
  separation remain owned by `NODE_PORT_BOUNDARY`.
- CLI migration and compatibility acceptance remain owned by `CLI_PARITY`.
- MCP contract and implementation remain independent of the editor branch.
- No file, Git, editor, process, network, mutation, persistence, release,
  publication, global install, remote write, Issue mutation, or plan advance
  is added or authorized.
