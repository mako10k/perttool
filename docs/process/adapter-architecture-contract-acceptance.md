# Shared Adapter Architecture Contract Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `ADAPTER_ARCHITECTURE_CONTRACT`
- Normative contract: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Machine cases: [../../test/fixtures/adapter-platform-contract-v1.json](../../test/fixtures/adapter-platform-contract-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted outcome

The architecture contract fixes one shared dependency and distribution model
for CLI, LSP, VSIX/DAG, and MCP before adapter implementation. The accepted
model separates deterministic Domain behavior, protocol-neutral Application
services, inward-owned ports, Node Hosts, protocol adapters, presentation, and
composition roots.

The existing `perttool` npm package remains the compatibility facade and CLI
distribution. Its later shared-library slice adds Core and Node subpaths.
Protocol dependencies remain in separate private language-server, VSIX, and
MCP workspace/distribution inputs. LSP is the predecessor of VSIX; MCP remains
independent of the editor branch after the shared foundation.

This acceptance changes requirements and design only. It does not change
runtime source, package metadata, the lockfile, command discovery, result
schemas, exports, CLI behavior, or an installed artifact.

The task is complete with exact lifecycle evidence and retained before
advance. The completed plan source digest is
`sha256:9270caead5ca1abf0c9e6bd76f37a878c3a1a6fbd7b98f69868c3928064194de`.

## 2. Reproduced baseline

| Evidence | Result |
| --- | --- |
| `package.json` | `perttool@0.7.1`, ESM, Node.js `>=22`, zero production dependencies |
| `Object.keys(await import("./dist/index.js"))` | 121 runtime export names |
| public command registry | 44 Contract 7 commands |
| public schema catalog | 20 root schemas |
| `find src -type f -name '*.ts'` | 144 TypeScript files |
| lower-layer import inventory | 12 files and 19 imports into `src/application/` |
| adapter runtime inventory | no LSP, VSIX, or MCP implementation or dependency |

The exact nineteen imports are versioned in the machine fixture. They are an
accepted description of current technical debt, not an allowlist for the
target architecture. `CORE_DEPENDENCY_CLEANUP` owns their removal and the
executable no-reverse-dependency gate.

## 3. Decisions

| Topic | Accepted decision |
| --- | --- |
| Dependency direction | Inner Domain and ports never import Hosts, protocols, presentation, or composition roots |
| Shared library | Keep `perttool` and add Core/Node subpath boundaries while retaining all current root meanings |
| Adapter isolation | LSP, VSIX, and MCP use separate private distribution inputs; their dependencies do not leak into Core or CLI |
| Runtime | Shared Core is ambient-I/O-free ESM/ES2024; Node Host, CLI, LSP, and MCP retain Node.js `>=22` |
| CLI | Direct Application/Host composition; no MCP or LSP startup dependency |
| LSP | Initial read-only protocol over the shared document session; no rename, formatting, or mutation edits |
| VSIX | TextMate and LSP client plus a current-version, CSP-constrained read-only DAG Webview |
| MCP | Initial closed read-only resources/tools; no CLI subprocess or editor dependency |
| Results | Application owns semantics; adapters own wire envelopes and presentation |
| Capabilities | Closed neutral operation mapping with explicit mutability and fail-closed unknown handling |
| Parity | Same source/digest/options/Application result; compare versioned semantic projections, not unrelated envelope bytes |
| Authority | Connection, initialization, trust, process, and Git identity grant no task-selection or write authority |

## 4. Review findings

| ID | Finding | Resolution |
| --- | --- | --- |
| `AACR-001` | Existing root package mixes shared logic, Node Hosts, presentation, and composition | Preserve it as a compatibility facade and split additive Core/Node subpaths later |
| `AACR-002` | Lower-layer modules import Application orchestration | Fix the exact 19-import migration input; removal belongs to the next task |
| `AACR-003` | A multi-package split could force premature version and publication policy | Use private adapter distribution inputs and leave public names/releases separate |
| `AACR-004` | A single package could leak protocol SDKs into CLI installs | Keep protocol dependencies in adapter workspaces |
| `AACR-005` | CLI JSON cannot be treated as a universal adapter wire contract | Preserve CLI Contract 7 and define adapter-specific versioned envelopes |
| `AACR-006` | Adapter parity could be misread as cross-protocol byte identity | Compare a documented semantic projection from one Application result |
| `AACR-007` | Capability presence could be inferred from files or connection state | Require a closed neutral catalog and explicit adapter mapping |
| `AACR-008` | Initial LSP requirements included mutation-returning rename and formatting | Select a read-only first contract and defer mutation edits |
| `AACR-009` | A VSIX DAG view could duplicate analysis or execute arbitrary Mermaid | Consume only a validated current-version graph result in a constrained Webview |
| `AACR-010` | MCP could be coupled to editor delivery | Retain an independent MCP branch after shared Core and Node boundaries |
| `AACR-011` | Adapter startup could be mistaken for authority | State that startup, trust, identity, and connection grant no authority |
| `AACR-012` | Build or acceptance might imply publication | Keep publication, release, remote, Issue, and global-install mutations separate |

There are no open findings within the architecture-contract scope. Protocol
capability details, supported VS Code versions, concrete SDK selection,
GraphViewResult fields, MCP tool names, and write contracts remain assigned to
later tasks.

## 5. Verification

The accepted gate is:

```sh
npm run build
node --test test/adapter-platform-contract.test.mjs
npm run check:docs
npm run check:english
npm run check:self-use
git diff --check
```

The repository-wide `npm run check` remains the final shared verification
before the task slice is committed.

## 6. Retained boundaries

- No runtime implementation or package dependency is added.
- Grammar 6, CLI Contract 7, 44 commands, 20 schemas, and 121 root export names
  retain their accepted meanings.
- Editor and MCP mutation remain unavailable in this workstream.
- Release selection, publication, public package naming, remote writes, Issue
  mutation, and plan advance remain separate decisions.
- `CORE_DEPENDENCY_CLEANUP` is the next implementation task after this task is
  durably completed; this acceptance does not start it.
