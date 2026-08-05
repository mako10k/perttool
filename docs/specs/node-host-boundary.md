# Node Host and Port Boundary

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `NODE_PORT_BOUNDARY`
- Port model version: 1
- Parent contract: [adapter-platform.md](adapter-platform.md)
- Machine cases: [../../test/fixtures/node-host-boundary-cases-v1.json](../../test/fixtures/node-host-boundary-cases-v1.json)

## 1. Scope

This contract activates one inward-owned port model and one Node.js host
composition without selecting an adapter or a release. It separates the
environmental capabilities needed by the existing CLI and the later read-only
MCP adapter:

- SHA-256 over exact bytes or explicit UTF-8 text;
- raw document bytes;
- bundled artifact bytes;
- read-only Git evidence;
- safe document and artifact persistence; and
- bounded process context.

The portable contracts are in `src/ports/node-host.ts`. The default Node.js
composition is `createNodeHost()` in `src/node/host.ts`. Application services
may receive the contract or a test implementation; they do not infer a Host
from a path, process, connection, or installed adapter.

The root and `perttool/node` facades add the same `createNodeHost` runtime
value and remain key- and reference-identical at 122 names. `perttool/core`
retains its exact 45-name portable runtime closure and exposes the port
contracts only as TypeScript types. CLI Contract 7, Grammar 6, all 44 commands,
all 20 root schemas, existing result identities and payloads, package
production dependencies, and established root function meanings remain
unchanged.

## 2. Port model

`Perttool.NodeHostPorts.v1` is represented by `NodeHostPorts` with
`modelVersion = 1`. It contains exactly six closed capabilities.

| Port | Input | Output | Host responsibility |
| --- | --- | --- | --- |
| `digest` | exact bytes or explicit UTF-8 text | lower-case `sha256:` digest | apply SHA-256 without source normalization |
| `documentBytes` | one caller-selected local path | owned byte copy | read bytes without parsing or authority inference |
| `bundledArtifacts` | one already resolved local `URL` | owned byte copy | read the selected immutable package artifact |
| `gitEvidence` | typed history or advance-baseline request | existing typed evidence outcome | run the accepted read-only Git/filesystem probe |
| `safePersistence` | authorized candidate, validator, target, and lock facts | existing write result or typed conflict | retain validation, symlink, race, atomicity, fsync, exclusivity, and readback |
| `processContext` | no arguments | cwd, PID, platform, or umask | expose only mechanics required by a composition root |

No port selects a task, command, source path, schema identity, validation
profile, governance decision, assurance decision, write intent, output mode,
or retry policy. Those remain caller or Application responsibilities.

### 2.1 Digest separation

The Node Digest Host uses `node:crypto` and is byte-identical to the existing
SHA-256 identities. Deterministic semantic hashing no longer imports
`node:crypto` from Domain or Application. It uses the portable synchronous
`src/model/sha256.ts` implementation, whose known vectors and Node-host parity
are executable evidence. This keeps the semantic result deterministic in a
portable closure while leaving environmental byte hashing injectable through
`DigestPort`.

UTF-8 is explicit. A string and its encoded bytes must return the same digest.
The Host does not strip a BOM, normalize Unicode, normalize line endings, or
reinterpret source text.

### 2.2 Document and artifact sources

The byte-source ports return fresh `Uint8Array` values. They do not parse DSL,
decode text, validate a schema, follow a remote URI, search a workspace, or
choose a fallback. Document callers select a local path. Artifact callers
resolve the exact bundled URL from the accepted catalog before the Host read.

The established `readDocumentFile` compatibility function retains fatal UTF-8
decoding, BOM-byte digest identity, and its current result. The schema registry
retains exact package-relative resolution, dialect and identity validation,
immutable caching, and full/outline/detail projection behavior.

### 2.3 Git evidence

`gitEvidence` delegates to the accepted read-only first-parent history probe
and the ADV-001 HEAD/stage-0 baseline capture and recheck. Its methods retain:

- SHA-1 and SHA-256 repository support;
- exact source, HEAD, index, path, device, inode, and commit binding;
- linked-worktree behavior;
- typed unavailable, incomplete, malformed, and race outcomes; and
- dependency hooks used only by deterministic race acceptance tests.

The Host never stages, commits, checks out, merges, resets, or otherwise
mutates Git. Git branch, author, committer, and configured identity are not
authority inputs.

### 2.4 Safe persistence

`safePersistence` exposes the existing low-level persistence mechanics. An
Application caller must already have selected the candidate and validator and,
for governed operations, proved write authority before calling it.

The Host retains candidate validation, expected-digest comparison, no-follow
regular-file checks, source identity and digest races, same-directory exclusive
temporary files, mode preservation, file and parent-directory sync, atomic
rename or exclusive link, post-write digest and semantic readback, and cleanup
on refusal. It does not add automatic retry. An ambiguous write remains an
error for the caller to read back and resolve.

### 2.5 Process context

Process context is deliberately closed to `cwd`, `pid`, `platform`, and
`umask`. It does not expose environment variables, arguments, stdin/stdout,
terminal state, process spawning, user identity, credentials, or a clock.
None of its fields grant governance, plan-assurance, task-selection, Git, or
write authority.

## 3. Ownership and dependency rules

The type-only port module has no runtime import and no `node:` import. The
default Host imports Node built-ins and the established logical Host
implementations in `src/io/`, `src/history/git-probe.ts`, and
`src/schema/registry.ts`; it imports no Application service, CLI, command
registry, LSP, VSIX, or MCP module.

Direct `node:crypto` imports are removed from Domain and Application. Remaining
Node built-in imports are limited to composition/protocol code and logical Host
implementations. Directory names do not change the logical ownership fixed by
the parent architecture contract.

`createNodeHost()` returns a new shallow composition whose aggregate and all
six port records are frozen. Callers may instead construct another object that
satisfies the same type contract. Reusable code receives that object or a
narrow port; it does not import `createNodeHost`.

The existing CLI is not switched to the aggregate in this task. That
composition and byte/JSON parity work remains exactly
`CLI_FACADE_PARITY`. The later MCP workspace may consume the accepted Core
types and Node Host without importing the CLI or editor adapters.

## 4. Compatibility and distribution

- `createNodeHost` is additive and reference-identical through `perttool` and
  `perttool/node`; it is absent from the `perttool/core` runtime.
- The prior 121-name root/Node state remains historical input. The current
  source boundary contains 122 runtime names and changes no existing value.
- The root package retains zero production dependencies.
- The public tarball continues to include only the established root package;
  no LSP, VSIX, or MCP dependency is introduced by the Host.
- Building, testing, linking, or packing this source does not publish a
  package, tag a commit, move a dist-tag, install globally, or change a user
  configuration.

Version selection and whether the additive runtime name belongs in a future
minor release are separate release-gate decisions.

## 5. Normative cases

| Case | Boundary | Required result |
| --- | --- | --- |
| `NHP-001` | Contracts | all six inward contracts are type-only, portable, and closed |
| `NHP-002` | SHA-256 | known vectors and byte/string parity match the Node Host exactly |
| `NHP-003` | Sources | document and bundled-artifact ports return exact owned bytes |
| `NHP-004` | Git | history and advance evidence retain the accepted read-only semantics |
| `NHP-005` | Persistence | existing safe-write functions retain identity and all refusal/readback guarantees |
| `NHP-006` | Process | context is closed to cwd, PID, platform, and umask and grants no authority |
| `NHP-007` | Facades | root and Node contain the same 122 values; Core runtime remains 45 |
| `NHP-008` | Regression | commands, schemas, dependencies, semantics, and side-effect boundaries remain unchanged |

The machine fixture preserves this dependency order.

## 6. Acceptance boundary

Acceptance requires focused port, SHA-256, document, schema, Git, persistence,
facade, dependency, package, and documentation tests; the complete repository
gate under Node.js 22 or later; `git diff --check`; and a reviewed task-local
diff. The task may write only local source, specification, acceptance evidence,
tests, and its exact lifecycle record.

CLI migration, editor DAG implementation, VSIX supported-host acceptance, MCP
contract or implementation, adapter integration acceptance, release selection,
publication, remote writes, Issue mutation, and plan advance remain separate.
