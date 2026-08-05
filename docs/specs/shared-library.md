# Shared Library Boundary

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `SHARED_LIBRARY_BOUNDARY`
- Parent contract: [adapter-platform.md](adapter-platform.md)
- Machine cases: [../../test/fixtures/adapter-shared-library-cases-v1.json](../../test/fixtures/adapter-shared-library-cases-v1.json)

## 1. Scope

This specification activates two additive source-package subpaths without
selecting or publishing a release:

- `perttool/core` is the platform-neutral shared runtime and type boundary;
- `perttool/node` is the Node.js library facade for the complete established
  package-root API.

The existing `perttool` root remains the compatibility authority for its 121
runtime export names. `perttool/schemas/*`, CLI Contract 7, Grammar 6, all 44
commands, all 20 root schemas, result identities, and payload meanings remain
unchanged. The package retains zero production dependencies.

This task does not define filesystem, Git, hashing, artifact, or persistence
port contracts. Their separation remains owned by `NODE_PORT_BOUNDARY`.

## 2. Core runtime contract

`perttool/core` is ESM/ES2024. Importing it MUST NOT import any `node:` module,
external package, Application implementation, CLI command module, I/O module,
Git/history module, schema-artifact loader, process state, network state, or
adapter module. It MUST NOT start a process or perform I/O at module load.

The accepted `SHARED_LIBRARY_BOUNDARY` runtime catalog contained forty names
in these groups:

- active Grammar 6 `parseDocument`, `validateDocument`, and `formatDocument`;
- residual-graph, precedence, and heuristic resource analysis functions;
- exact Rational and unit conversion values and functions;
- deterministic diagnostic utilities;
- the domain Help registry and active Contract 7 Guide query, JSON,
  serialization, and text projections;
- the recommendation-analysis JSON projection; and
- the generated direct-edit guidance constant.

The machine-case fixture owns the exact ordered name inventory. The three
active source functions MUST be reference-identical to the existing package-
root functions, not parallel implementations. Lifecycle reduction and stored-
state validation have one pure owner so source formatting does not load the
Node-only work-event identifier generator.

The Core type surface additionally exposes neutral syntax, diagnostic, format,
graph, schedule, Help, Guide, recommendation, base check/analysis,
plan-assurance projection, governance-decision, history, observation, and
schema-result contracts. Type-only exports do not expand the runtime closure.
Current file-backed Contract 7 Application result types remain available from
the root and Node facades until their concrete hashing and Host dependencies
are separated by `NODE_PORT_BOUNDARY`; Core does not point outward merely to
re-export those types.

The later accepted [Document Session Core](document-session.md) is an additive
extension of this same boundary. It retains all forty original runtime values
and adds five Core-only document snapshot, session, analysis, and UTF-16
conversion functions. The current exact catalog therefore has 45 names and a
34-module portable runtime closure. The original `SLB-*` fixture remains the
historical boundary baseline; the exact current inventory and closure are
owned by the `DSC-*` fixture. Neither the root nor `perttool/node` re-exports
the five later values.

## 3. Node and compatibility facades

`perttool/node` is an additive Node.js `>=22` facade over the current package
root. It MUST expose exactly the same 121 runtime names, in the same order,
with reference identity for every runtime value. It therefore provides the
existing file, Git, hashing, safe-write, schema-loader, and Application APIs
without changing their behavior.

The root remains authoritative and `perttool/node` depends on that facade in
this slice. The later Node-port task may move concrete ownership behind
inward-owned port contracts, but it MUST preserve these accepted subpath and
root identities unless a separate compatibility decision changes them.

The schema registry remains Node-owned because it resolves bundled artifacts
from the filesystem. Portable consumers may import its result types from
`perttool/core`; executable schema lookup uses `perttool/node`, and immutable
artifacts remain available through `perttool/schemas/*`.

## 4. Package and consumption contract

The manifest MUST map exact `types` and `import` targets for `./core` and
`./node`. The packed artifact MUST contain both JavaScript entrypoints and
declarations. A fresh isolated installation MUST resolve both package
subpaths through the package export map, import the Core without a Node
builtin in its static closure, prove root/Node facade identity, and execute
the Core source and Help paths without repository-relative imports.

Adding the source export map does not imply that an npm or GitHub artifact
already contains it. Publication, version selection, Git tags, npm dist-tags,
remote writes, global installation, and release acceptance remain separate
decisions.

## 5. Compatibility and safety

- No existing root name is added, removed, renamed, or narrowed.
- No CLI command, option, exit status, text, JSON, or schema identity changes.
- No adapter dependency enters the Core, Node facade, root facade, or CLI.
- No Core result is silently treated as write, governance, assurance, or task-
  selection authority.
- The Node facade does not weaken digest, symlink, race, Git-history,
  governance, assurance, safe-write, or post-write verification behavior.
- A consumer needing the current file-backed Application behavior uses
  `perttool/node` until the separately accepted Node-port boundary makes more
  services portable.

## 6. Normative cases

| Case | Boundary | Required result |
| --- | --- | --- |
| `SLB-001` | Manifest | additive `./core` and `./node` targets are exact |
| `SLB-002` | Core catalog | the original exact forty runtime names remain present and deterministic |
| `SLB-003` | Core closure | no Node builtin, external package, outer layer, or side effect enters the additive Core closure |
| `SLB-004` | Source identity | Grammar 6 parse, validate, and format are identical through root and Core |
| `SLB-005` | Node facade | all 121 root values and the Node subpath are key- and reference-identical |
| `SLB-006` | Schema and Help | types are portable; executable schema loading stays Node-owned; Help and Guide run in Core |
| `SLB-007` | Isolated package | packed Core and Node entrypoints resolve and execute directly |
| `SLB-008` | Compatibility | commands, schemas, root exports, dependencies, and release state are unchanged |

The cases are dependency ordered in the machine fixture.

## 7. Acceptance boundary

Acceptance requires the focused boundary, source, lifecycle, formatter,
analysis, package, and documentation tests; the complete repository gate;
`git diff --check`; and a reviewed task-local diff. Acceptance writes only the
local implementation, documentation, tests, and exact task lifecycle record.
It does not advance the plan or mutate any remote, release, registry, Issue,
editor, MCP, or user-global state.
