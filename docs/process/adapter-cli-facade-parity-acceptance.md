# Adapter CLI Facade Parity Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `CLI_FACADE_PARITY`
- Architecture contract: [../specs/adapter-platform.md](../specs/adapter-platform.md)
- Node Host contract: [../specs/node-host-boundary.md](../specs/node-host-boundary.md)
- Machine cases: [../../test/fixtures/cli-facade-parity-cases-v1.json](../../test/fixtures/cli-facade-parity-cases-v1.json)
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)

## 1. Accepted composition

`src/cli.ts` now constructs one private
`createCliApplicationFacade(createNodeHost())` composition. The facade keeps
the established Application service functions reference-identical and binds
environmental operations to the accepted Node Host ports:

- file-backed document bytes and SHA-256 use `documentBytes` and `digest`;
- project-history probes, advance baseline capture, and advance recheck use
  `gitEvidence`;
- artifact creation and Grammar 6 create/replace/output persistence use
  `safePersistence`; and
- the Host remains frozen, six-port, and unable to select an operation,
  semantic result, governance authority, task start, or write intent.

CLI command parsing, operand and option validation, terminal streams, text and
JSON presentation, and exit-status selection remain adapter-owned. No LSP,
VSIX, MCP, SDK, transport, adapter subprocess, or network dependency enters
the CLI closure.

## 2. Compatibility result

The refactor retains all 44 CLI Contract 7 commands, command examples and
usage recovery, 20 root schemas, active result identities and payload
meanings, Help, Guide, package-root exports, and file-first installed
behavior. The root and `perttool/node` remain key- and reference-identical at
122 runtime names, `perttool/core` remains an exact 45-name portable runtime,
and the root package retains zero production dependencies.

Read-only command output is byte deterministic and traces to the same direct
Application result. Preview and persistent commands retain candidate exposure,
diagnostic policy, governance-before-write, expected-digest, symlink, Git
history, race, exclusive-output, atomic replacement, and post-write validation
semantics.

## 3. Executable evidence

The dependency-ordered `CFP-001` through `CFP-010` cases cover Application
identity, document/digest ports, Git evidence, safe persistence, the complete
registry, text/JSON byte parity, preview/write safety, Help/Guide/schema
identity, package and installed behavior, and adapter dependency closure.
Injected-host tests prove that the facade calls the supplied document, digest,
Git, and persistence ports rather than reconstructing those capabilities.

The focused build, CLI, history, governance, Node Host, dependency-boundary,
and parity tests pass. The complete repository gate passes in the completed-
task state, including type checks, all Node tests, English and documentation
checks, all self-use plans, isolated LSP and VSIX gates, temporary linking, and
the isolated public-package workflow. `git diff --check` also passes.

## 4. Lifecycle and retained authority

The task was started through an assertion-free, governance-not-applicable
preview and digest-bound write at `2026-08-05T20:53:08+09:00`. Its start event
is `WE-fa65ad8bf4b4136bde6dfe1b53d7c244351f66973e4bbdfdfd357db1ff933ac4`.
The assertion-free finish is
`WE-80a3a5d16c2e7063b8bb9fefe0cb0922f678368df1cef3fcbbbea701779647ed`
at `2026-08-05T21:03:35+09:00`, with exact `209/1200h` active time and
`209/1200ph` effort. The completed source digest is
`sha256:ed242f3abc1967c4d854e2426fdd8a7b01db39591565ba746770206cfd0d572b`.

Three tasks and 13p remain. The precedence makespan is 9p; the
`parallel-sgs` version 1 heuristic resource makespan is 13p with 4p resource
delay. Inherited `29p/2d` velocity produces `18/29d` and `26/29d` forecasts.
Complete, non-truncated NextResult v6 recommends and makes startable only
`MCP_ACCEPTANCE`; `VSIX_ACCEPTANCE` is ready but deferred by the current
resource-feasible selection.

MCP and VSIX acceptance, cross-surface integration acceptance, release
selection, publication, remote writes, Issue mutation, and plan advance remain
separate boundaries.
