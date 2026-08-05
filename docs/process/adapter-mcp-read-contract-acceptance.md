# Adapter Read-Only MCP Contract Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `MCP_READ_CONTRACT`
- Normative contract: [../specs/mcp-read-contract.md](../specs/mcp-read-contract.md)
- Parent architecture: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Machine cases: [../../test/fixtures/mcp-read-contract-cases-v1.json](../../test/fixtures/mcp-read-contract-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted outcome

MCP protocol model 1 fixes one private, Node.js 22-or-later, local-stdio server
input over final MCP revision 2026-07-28 and exact stable server SDK 2.0.0. It
lists exactly four immutable JSON resources and five read-only tools. It does
not expose prompts, resource templates, subscriptions, roots, sampling,
elicitation, tasks, logging, extensions, a network listener, or a child CLI.

Document tools accept exact inline text or a launcher-registered local document
ID. Registered reads require an optimistic SHA-256 assertion, and no MCP
request accepts or receives an absolute path, workspace root, Git repository,
Git ref, commit, remote URL, or registration mutation.

## 2. Accepted protocol decisions

| Topic | Accepted decision |
| --- | --- |
| Protocol | exact final revision `2026-07-28`; no fallback |
| SDK input | exact `@modelcontextprotocol/server` `2.0.0` |
| Runtime | Node.js `>=22`, ESM/ES2024, private `adapters/mcp` workspace |
| Transport | client-launched local stdio only; stdout is protocol-only |
| Capabilities | exact `resources` and `tools` with complete deterministic lists |
| Resources | capabilities, command Help, Guide index, and schema catalog |
| Tools | check, analyze, next, Help, and schema lookup |
| Source | inline text or launcher-only registered ID; no caller path |
| Results | closed adapter-owned `Perttool.Mcp*Result.v1` projections |
| Parity | same Application call and semantic projection; never a CLI subprocess |
| Authority | connection, client, process, and path registration grant none |

## 3. Failure and resource-limit decisions

The contract distinguishes protocol parameter errors, adapter source failures,
and completed Domain-invalid results. A completed result retains Domain
diagnostics and becomes an MCP tool error with complete structured content.
Source failures use `PTMCP-101` through `PTMCP-108`. Internal output-schema
failure emits no partial semantic result.

The fixed ceilings are 256 KiB per JSON-RPC line, 2 MiB per source, 8 MiB per
complete output, 64 registered documents, 256 capacity overrides, eight
concurrent tool calls, a 30-second result deadline, and 1000 diagnostics. The
server does not truncate semantic output or authority traces to fit. Cancellation
or expiry discards a result and never triggers an automatic retry.

## 4. Review findings

| ID | Finding | Resolution |
| --- | --- | --- |
| `MCRR-001` | A generic file-path argument would let a client explore the server filesystem | Accept only inline text or a launcher-registered opaque ID |
| `MCRR-002` | A registered file can change after discovery | Require the exact expected SHA-256 on every registered read |
| `MCRR-003` | Reusing CLI JSON as an MCP identity would collapse adapter ownership | Define closed MCP wire identities outside the CLI schema catalog |
| `MCRR-004` | Connection metadata could be mistaken for owner or task authority | Make all client and transport metadata non-authoritative context |
| `MCRR-005` | Truncating a large Next result could hide decisive authority causes | Reject the complete output and emit no partial semantic result |
| `MCRR-006` | Read-only annotations alone do not prevent hidden write calls | Close the operation list and forbid Git-evidence and persistence-port use |
| `MCRR-007` | A cancellation arriving during synchronous Core work cannot preempt JavaScript calculation | Check before and after dispatch, discard late results, and make no preemption claim |
| `MCRR-008` | Contract acceptance could be mistaken for an available server or release | Keep implementation, dependencies, distribution, release, and publication separate |

There are no open findings within this contract task.

## 5. Verification and lifecycle evidence

The contract has sixteen dependency-ordered `MCR-*` cases. Focused checks
cover the exact protocol and SDK input, capability closure, resources, tools,
source selectors, result identities, errors, limits, parity boundary,
side-effect exclusions, and valid plan lifecycle.

```sh
npm run build
node --test test/mcp-read-contract.test.mjs
npm run check:docs
npm run check:english
npm run check:self-use
npm run check
git diff --check
```

The task started with event
`WE-a53bbaf695f8dff592f835bbb58f8e3e9d9f5989351960ec82510fe22d02d970`
at `2026-08-05T19:17:13+09:00` and finished with event
`WE-7145073435056597697b7c3e713ccc715273d1bfce06a750ad63f2f74aad4032`
at `2026-08-05T19:45:00+09:00`. Exact active time and effort are
`1667/3600h` and `1667/3600ph`. The assertion-free preview and write both
reported governance not applicable, no affected scope, and no required owner
confirmation.

The complete repository gate passed in the final completed-task state. The
completed plan source digest is
`sha256:e4461dc339d58773a08d13d857c2ffdbca1245748aa9e9db57458a5bbdc9ed72`.
Six tasks and 32p remain. Precedence makespan is 16p; the `parallel-sgs`
version 1 heuristic resource makespan is 25p with 9p resource delay. Complete
NextResult v6 recommends and makes startable exactly `MCP_READ_ADAPTER` and
`VSIX_DAG_VIEW`; `CLI_FACADE_PARITY` is deferred by the resource-feasible
selection.

## 6. Retained boundaries

- No MCP source, workspace, dependency, manifest, command, public package,
  root export, or CLI schema is added.
- No arbitrary local or remote source, Git history read, mutation preview,
  persistent write, client configuration write, telemetry, or network listener
  is activated.
- `MCP_READ_ADAPTER` and `VSIX_DAG_VIEW` are the fresh normal-authority
  implementation inputs; `MCP_ACCEPTANCE` remains a later installed-artifact
  task.
- CLI parity, VSIX DAG rendering, integrated acceptance, release selection,
  publication, global install, remote writes, Issue mutation, and plan advance
  remain separately gated.
