# Adapter Platform Integration Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-06
- Workstream: `ADAPTER-001`
- Task: `ADAPTER_INTEGRATION_ACCEPTANCE`
- Normative contract: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Editor protocol: [../specs/editor-protocol.md](../specs/editor-protocol.md)
- MCP contract: [../specs/mcp-read-contract.md](../specs/mcp-read-contract.md)
- Machine cases: [../../test/fixtures/adapter-integration-acceptance-cases-v1.json](../../test/fixtures/adapter-integration-acceptance-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted boundary

This acceptance composes the accepted Core, Node Host, CLI facade, LSP, VSIX,
and MCP slices without adding a new public package identity or moving semantic
ownership into an adapter. The current compatibility baseline is exactly 122
root and Node runtime values with reference identity, 45 portable Core runtime
values, 44 Contract 7 commands, 20 root schemas, and zero root production
dependencies. The private adapters remain excluded from the public root
package.

The acceptance fixes sixteen dependency-ordered `AIA-001` through `AIA-016`
cases. They close prerequisite acceptance, acyclic import and distribution
boundaries, public-package compatibility, semantic parity, protocol binding,
diagnostic ownership, stale and limited failure handling, read-only authority,
isolated adapter workflows, the complete repository gate, and external
side-effect exclusion.

## 2. Semantic and protocol evidence

For one exact source byte sequence and SHA-256 digest, Core, CLI, and MCP
produce the same check, analysis, and next semantic payload after removing the
documented protocol envelopes. Repeated CLI and MCP calls are deterministic.
The LSP GraphView result binds the same analysis projection to its URI,
generation, version, source digest, mode, and source-navigation bindings. The
VSIX renders only that versioned result and sends a selected binding back to
the LSP; it does not parse or analyze `.pert` source itself.

Invalid source remains owned by the shared semantic diagnostic model. CLI,
LSP, and MCP retain their documented transport envelopes and failure owners
without repairing source or invoking another adapter. The probes retain the
source bytes and adapter directory inventory before and after all calls.

## 3. Dependency, distribution, and authority closure

The root runtime has no dependency on VS Code, LSP, or MCP packages. LSP does
not import MCP, VSIX, or the CLI. VSIX does not import Core semantic services.
MCP does not import LSP, VSIX, the CLI, or child-process execution. The root
tarball contains only its accepted public inventory; LSP, VSIX, and MCP remain
private workspace artifacts with their separately accepted package gates.

All accepted adapters are read-only. The integration path does not write a
document, Git state, editor configuration, network destination, registry,
release, tag, dist-tag, or Issue. Editor and MCP mutation, public adapter
identities, release selection, publication, remote writes, and plan advance
remain outside this acceptance.

## 4. Complete verification

The focused integration tests pass all seven probes. The complete
`npm run check` and `git diff --check` gates pass in the completed-task source
state, including 907 Node tests, all 34 self-use plans, isolated LSP and MCP
packages, the supported VS Code host, the temporary-link workflow, and the
isolated public-package workflow. The first complete run passed every
implementation and packaging probe and exposed only the expected pre-finish
self-use golden difference. After lifecycle completion and exact golden
alignment, the complete gate passed without failures.

## 5. Lifecycle boundary

The task was started through an assertion-free, governance-not-applicable,
digest-bound write at `2026-08-05T21:57:18+09:00`. Its start event is
`WE-c2a977991aa842f98bf893d13cac1d4e9debdc6910e5bed5b4457579cbbc6823`.
The end-of-day handoff was recorded by suspend event
`WE-c43669d98efac38aeeac500535ed70211720fe72f8af80ba5bba1f8e18dacc4a`
at `2026-08-05T22:05:17+09:00`. Resume event
`WE-533dc70122b079ecd22b1c67bde37a3124a09bfabb95f69b6c0fde8a329e0e87`
records the verified continuation boundary at `2026-08-06T13:09:25+09:00`.
The assertion-free finish is
`WE-824f41f4d363765d848e70b1f70f747a0d82b6a198bdd370161c3a0f892b477a`
at `2026-08-06T13:10:58+09:00`, with exact `143/900h` active time and
`143/900ph` effort. The completed source digest is
`sha256:8aaeedea6ceb2e300947392cc551e9d6459ee5c66f5a10f8486a336696a31baa`.

All sixteen tasks and 91p are complete and retained in their exact pre-advance
state. Precedence and `parallel-sgs` version 1 heuristic resource makespans
are both zero with zero resource delay. Complete, non-truncated NextResult v6
has no ready, active, runnable, upcoming, suspended, recommended, or startable
task.

Release selection, publication, remote writes, Issue mutation, editor or MCP
mutation, public adapter identities, and plan advance remain separate.
