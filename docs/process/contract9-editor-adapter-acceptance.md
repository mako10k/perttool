# Contract 9 Editor Adapter Acceptance

## Accepted boundary

The private LSP and VSIX accept Grammar 8 through the existing coordinate-preserving `DocumentSession` preparation seam. The Application-owned preparation masks temporal and milestone-acceptance records without changing UTF-16 coordinates, supplies Contract 9 validation diagnostics, and injects the Contract 9 formatter only for negotiated editor mutation protocol model 2.

`Perttool.GraphViewResult.v1` remains unchanged. Temporal schedule alerts use the separately offered and accepted `Perttool.TemporalGraphViewResult.v1` over `perttool/temporalGraphView`. The result binds document URI, generation, version, and source digest. The VSIX validates the closed result before presenting POSTDUE and POSTDUE forecast counts; scheduling and alert semantics remain in the Application layer.

The private TextMate grammar recognizes Grammar 8 calendar declarations and stable alert names. The offline bundled server contains the same implementation. Existing trusted, untrusted, virtual-workspace, rapid-edit cancellation, replacement, and uninstall gates remain applicable because the new method uses the synchronized in-memory document only and grants no file, editor, Git, repository, network, release, or publication authority.

## Evidence

- `test/fixtures/contract9-editor-adapter-v1.json` closes twelve dependency-ordered cases.
- `test/milestone-acceptance-adapters.test.mjs` exercises a real Grammar 8 document through diagnostics, unchanged GraphView v1, bound temporal view, strict VSIX parsing, and model-2 formatting.
- The root and private adapter builds, TypeScript checks, static checks, and focused Node.js 22 tests pass.

Public Contract 9 activation, MCP temporal parity, VSIX publication, release selection, remote writes, Issue mutation, and plan advance remain separate boundaries.
