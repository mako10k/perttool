# Adapter Read-Only MCP Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `MCP_ACCEPTANCE`
- Normative contract: [../specs/mcp-read-contract.md](../specs/mcp-read-contract.md)
- Implementation record: [adapter-mcp-read-adapter-acceptance.md](adapter-mcp-read-adapter-acceptance.md)
- Machine cases: [../../test/fixtures/mcp-acceptance-cases-v1.json](../../test/fixtures/mcp-acceptance-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted installed boundary

The private `perttool-mcp-private` tarball installs beside the retained root
`perttool` tarball with scripts disabled. Its installed `perttool-mcp` entry
serves only final MCP revision `2026-07-28` over local newline-delimited stdio
under Node.js 22 or later. It exposes exactly four immutable JSON resources
and five closed read-only tools, keeps the adapter outside the public root
package, and requires no repository source tree at runtime.

Two independent client processes receive byte-identical semantic results for
the same registered document and digest even when their client metadata
differs. Legacy negotiation is rejected, unknown methods remain protocol
errors, EOF closes cleanly, stdout remains protocol-only, and absolute
registered paths remain private.

## 2. Acceptance correction

Installed probing found one pre-acceptance mismatch: the upstream SDK's
default stdio transport reported malformed JSON out of band but continued with
a later valid line. The accepted contract requires a malformed message to
prevent recovery from a later line. The launcher now places a fatal UTF-8,
bounded JSON-line transform before the SDK transport. A malformed or
unterminated line terminates that input stream, emits no later semantic result,
and writes only a human diagnostic to stderr. The SDK remains responsible for
validated MCP messages and protocol errors after this framing boundary.

The adapter also provides an internal output-ceiling narrowing seam. It cannot
raise the normative 8 MiB limit; tests lower the ceiling to prove that a
complete oversized result becomes `PTMCP-105` without partial semantic output.

## 3. Executable evidence

Dependency-ordered `MCPA-001` through `MCPA-012` close package installation,
lifecycle, discovery, schemas, inline and registered sources, digest mismatch,
legacy, malformed and unknown traffic, invalid documents, all fixed limits,
cancellation, deterministic Core parity, multiple-client isolation, offline
Help/schema, and side-effect exclusion.

`check:mcp-package` packs the root and private MCP workspaces, rejects an open
private inventory, installs both tarballs with lifecycle scripts disabled,
and runs the installed server from a disposable non-Git directory. SHA-256
inventory before and after proves that the registered project input is
unchanged and no file is created. Static closure and injected-Host tests prove
that MCP calls no CLI subprocess, LSP/VSIX adapter, Git-evidence port,
safe-persistence port, listener, remote fetch, preview, mutation, or authority
path.

The focused MCP contract, implementation, acceptance, isolated-package,
documentation, English, and recommendation-shadow gates pass. The complete
repository gate passes in the completed-task state, including all Node tests,
34 self-use plans, isolated LSP, MCP, and VSIX workflows, temporary linking,
and the isolated public-package workflow. `git diff --check` also passes.

## 4. Lifecycle and retained authority

The task was started through an assertion-free, governance-not-applicable
preview and digest-bound write at `2026-08-05T21:13:49+09:00`. Its start event
is `WE-172e086c4e8462a7ee26b5f68ab654590f221dae7d61538894c61e77d7fd2310`.
The assertion-free finish is
`WE-30dbf9efeaa090fef2416cce23885d40c14e3dccfd1bd2a4b324019648c1f6b1`
at `2026-08-05T21:21:03+09:00`, with exact `217/1800h` active time and
`217/1800ph` effort. The completed source digest is
`sha256:c60e438bbc2415bb12e820ffba0b07c7aeef08da51af9845139faa3b23d33356`.

Two tasks and 9p remain. Precedence and `parallel-sgs` version 1 heuristic
resource makespans are both 9p with zero resource delay. Inherited `29p/2d`
velocity produces `18/29d` for both forecasts. Complete, non-truncated
NextResult v6 recommends and makes startable only `VSIX_ACCEPTANCE`;
`ADAPTER_INTEGRATION_ACCEPTANCE` remains upcoming.

VSIX supported-host acceptance, cross-surface integration acceptance, release
selection, publication, remote writes, Issue mutation, and plan advance remain
separate boundaries.
