# Adapter Read-Only MCP Implementation Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `MCP_READ_ADAPTER`
- Normative contract: [../specs/mcp-read-contract.md](../specs/mcp-read-contract.md)
- Machine cases: [../../test/fixtures/mcp-read-adapter-cases-v1.json](../../test/fixtures/mcp-read-adapter-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted implementation

The private `adapters/mcp` workspace implements MCP protocol model 1 with
Node.js 22 or later, final protocol revision `2026-07-28`, and exact
`@modelcontextprotocol/server` `2.0.0`. Its eight TypeScript sources provide:

- one protocol-neutral adapter with exactly four immutable JSON resources and
  five read-only tools;
- strict inline and launcher-registered document-source handling with exact
  raw-byte SHA-256 binding and no path disclosure;
- direct calls into the accepted Application and registry surfaces without a
  CLI subprocess;
- closed MCP-owned input and output schemas, including self-contained local
  `$defs` for recursive shared value structures and no external reference;
- request-size, source-size, result-size, registration, capacity, concurrency,
  deadline, cancellation, and diagnostic ceilings;
- exact read-only tool annotations and no mutation, Git-evidence, persistence,
  network, or connection-derived authority; and
- a modern-only local stdio launcher whose stdout is protocol-only and whose
  registration arguments are accepted only before protocol service starts.

The launcher accepts repeated `--document ID=/absolute/path` arguments. Wire
requests use only the registered ID and expected digest; the absolute path is
never exposed through resource discovery, tool results, or diagnostics.

## 2. Schema and protocol findings

The implementation review found that the contract's earlier phrase "fully
dereferenced" conflicted with recursive public result values such as JSON
objects. The normative contract now says "self-contained": same-root local
`$defs` references are permitted, while external and remote references remain
forbidden. This preserves complete recursive schemas without weakening the
adapter boundary.

The SDK advertises list-change capability by default when registrations are
added. The server therefore declares the exact accepted capability values
explicitly: resource subscription and list-change are false, and tool
list-change is false. A legacy 2025-era initialize request is rejected with
protocol error `-32022`; a modern 2026-07-28 discovery and request sequence
then succeeds without stdout noise.

## 3. Executable evidence

The twelve dependency-ordered `MCA-001` through `MCA-012` cases cover the
workspace and SDK pin, deterministic discovery, resource closure,
self-contained schemas, inline and registered sources, Domain-invalid
results, Application parity, limits, cancellation, offline Help/schema, and
side-effect exclusions. Ten executable tests include a real child-process
stdio trace for discovery, tools, resources, and a `perttool_next` call.

The complete repository gate passed in the completed-task state under the
repository's Node.js 22-or-later contract. It covered:

- TypeScript checks for the root, LSP, VSIX, and MCP workspaces;
- all task-scope Node tests, plus the unrelated task-refinement tests present
  in the shared dirty worktree;
- the English baseline and documentation checks;
- read-only check/analyze/next over all 34 self-use plans;
- isolated LSP and disposable VSIX shell acceptance;
- temporary-prefix npm link acceptance; and
- the 653-file public package and isolated installed-package workflows, which
  continue to exclude the private adapter workspaces.

`git diff --check` also passed.

## 4. Lifecycle evidence

The assertion-free start preview was governance-not-applicable and was written
without `--accepted-by-owner`. The start event is
`WE-323972660605a84023ae68dbdf5a96db2962b74d85acdf8c80f15074499957b9`
at `2026-08-05T19:54:22+09:00`.

The assertion-free finish preview was likewise governance-not-applicable and
was written without an owner assertion. The finish event is
`WE-c1c6559db94c1b46f5bebbf5e13456ff8384fd54823114309cb4d30fedf1c3d4`
at `2026-08-05T20:20:00+09:00`. The source records exact `769/1800h` active
time and `769/1800ph` effort. The completed source digest is
`sha256:ad60ec990e6e75c21c92719edd7d3020dca749c75bba9efe337d6a1d3b7d2a2c`.

## 5. Remaining plan and authority

After completion, five tasks and 25p remain. The precedence makespan is 16p.
The `parallel-sgs` version 1 heuristic resource makespan is 25p with 9p
resource delay. Inherited `29p/2d` velocity produces `32/29d` and `50/29d`
forecasts.

The complete, non-truncated `Perttool.NextResult.v6` uses recommendation
interface 1 and authority policy
`recommendation_v1_plus_release_gate_plus_plan_assurance_v1`. It recommends
and makes startable only `VSIX_DAG_VIEW`. `CLI_FACADE_PARITY` and
`MCP_ACCEPTANCE` are ready but deferred by the current resource-feasible
selection.

MCP installed-artifact acceptance, VSIX DAG implementation and acceptance,
CLI parity, integrated acceptance, release selection, publication, remote
writes, Issue mutation, and plan advance remain separate boundaries.
