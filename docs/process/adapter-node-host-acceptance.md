# Node Host Boundary Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `NODE_PORT_BOUNDARY`
- Normative contract: [../specs/node-host-boundary.md](../specs/node-host-boundary.md)

## 1. Accepted result

The accepted source adds the type-only Node Host port model and one additive
`createNodeHost()` composition. Its six capabilities expose exact SHA-256,
raw document and bundled-artifact bytes, read-only Git evidence, the existing
safe-persistence mechanics, and bounded process context. The Host selects no
Application behavior and grants no governance, plan-assurance, task-selection,
Git-mutation, or write authority.

The package root and `perttool/node` remain key- and reference-identical after
adding the factory as their 122nd runtime value. `perttool/core` remains an
exact 45-name portable runtime with a 34-module closure. Grammar 6, CLI
Contract 7, all 44 commands, all 20 root schemas, existing result meanings,
and zero root production dependencies remain unchanged.

## 2. Implementation evidence

- `src/ports/node-host.ts` owns the type-only `Perttool.NodeHostPorts.v1`
  contract and has no runtime or Node builtin import.
- `src/node/host.ts` is the only aggregate composition. It delegates Git and
  persistence to the accepted implementations and imports no Application,
  command, LSP, VSIX, or MCP module.
- `src/model/sha256.ts` is the portable semantic-hash owner. Known empty and
  `abc` vectors, Unicode text, byte/text parity, and the prior semantic hash
  suites match Node SHA-256 exactly.
- A static boundary test finds Node builtins in only six logical or concrete
  Host/composition sources: CLI, Git probe, document file, safe write, Node
  host, and schema registry. No Domain or Application module imports one.
- The candidate contains 157 TypeScript source files. Root and Node contain
  122 runtime values; Core contains 45.
- Git evidence remains first-parent and read-only. Safe artifact creation
  retains exclusive creation, typed conflict, exact digest, and readback
  behavior.

The executable cases are
[`node-host-boundary-cases-v1.json`](../../test/fixtures/node-host-boundary-cases-v1.json),
`NHP-001` through `NHP-008`, in dependency order.

## 3. Lifecycle evidence

The assertion-free start preview was governance-not-applicable and was written
without `--accepted-by-owner`. The start event is
`WE-9ec8f2ce85327b3830e27b14b00d04e0ecd4567bedeb433d5dfa8c221bb1fdd6`
at `2026-08-05T18:48:48+09:00`. Its active source digest was
`sha256:8a4f549f29805c524cb56df9f7c084db6d1a00bbdc36106a0f5f9030e7434b4e`.

The assertion-free finish preview was likewise governance-not-applicable and
was written without an owner assertion. The finish event is
`WE-9d9be8b2b1b21978a34a3b84f0de4919890b7c25a551cbcad87e852841d808d6`
at `2026-08-05T19:02:00+09:00`. The source records exact `0.22h` active time
and `0.22ph` effort, equivalent to `11/50h` and `11/50ph`. The completed
source digest is
`sha256:81a7d8cfa1a7a696c3bde4b99e583a3778d59e251e7de1d8fb32c44a1ef09e52`.

## 4. Verification

The focused Node Host, architecture, shared-library, document-session, LSP,
mutation, override, Git, and safe-write regression command passed 70 tests
after the completed lifecycle candidate. `git diff --check`, both JSON fixture
parses, the 157-file inventory, and the six-source Node-builtin inventory also
passed.

The complete repository gate passed under Node.js 22 or later after correcting
one installed-package assertion from the historical 121-name facade to the
accepted 122-name facade. Evidence includes:

- TypeScript checks for the root, private LSP, and private VSIX workspaces;
- all 857 task-scope Node tests; the shared dirty workspace also ran and passed
  two unrelated task-refinement tests, for 859 total;
- the English baseline and documentation checks over 185 task-scope Markdown
  documents and seven PERT examples; the shared workspace also contained two
  unrelated untracked Markdown documents, and all 187 passed;
- read-only check/analyze/next over all 34 self-use plans;
- isolated LSP and disposable VSIX shell package acceptance;
- temporary-prefix npm link acceptance;
- the 653-file public package inventory, npm `beta` publication dry-run, and
  isolated installed Contract 7 file-first and plan-assurance workflows; and
- `git diff --check`.

## 5. Remaining plan and authority

After completion, seven tasks and 36p remain. The precedence makespan is 20p.
The `parallel-sgs` version 1 heuristic resource makespan is 29p with 9p
resource delay. Inherited `29p/2d` velocity produces `40/29d` and `2d`
forecasts.

The complete, non-truncated `Perttool.NextResult.v6` uses recommendation
interface 1 and authority policy
`recommendation_v1_plus_release_gate_plus_plan_assurance_v1`. It recommends
and makes startable only `MCP_READ_CONTRACT`. `CLI_FACADE_PARITY` and
`VSIX_DAG_VIEW` are deferred by the current resource-feasible selection.

CLI composition, MCP implementation, VSIX DAG rendering, adapter integration,
release selection, publication, remote writes, Issue mutation, and plan
advance remain separate boundaries.
