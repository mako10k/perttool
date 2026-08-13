# Milestone Acceptance Adapter Acceptance

- Date: 2026-08-13
- Task: `MILESTONE_ACCEPTANCE_ADAPTERS`
- Result: Accepted locally before plan lifecycle mutation

## Accepted boundary

The private LSP, VSIX, and MCP adapters now project the active milestone
acceptance model without adding mutation authority. The LSP accepts exact
Grammar 7 text through an injected coordinate-compatible session preparation,
negotiates one separate result, binds every current result to URI, generation,
version, and digest, and maps Application-owned source spans to UTF-16 ranges.

The VSIX validates and presents closure, acceptance, criteria, blockers, and
receipt provenance with accessible source actions. The MCP adapter retains its
four resources, five tools, and wire v1 identities while returning active
Contract 8 check, analysis, and Next payloads including acceptance. Root and
Node runtime values are now identical for the shared Application boundary.

No adapter implements criterion replacement, receipt mutation, advance,
external verification, Git write, editor write, CLI subprocess execution,
public extension identity, publication, or release selection.

## Evidence

- `test/fixtures/milestone-acceptance-adapter-v1.json` fixes ten ordered cases.
- `test/milestone-acceptance-adapters.test.mjs` covers Grammar 7 session use,
  exact negotiation, current and older-Grammar results, source bindings, MCP
  Contract 8 payloads, VSIX validation, presentation, and no-mutation text.
- Existing LSP, DAG focus, historical editor, MCP, adapter integration, and
  VSIX supported-host gates remain the regression boundary.

The complete local gate passed on 2026-08-13. Type checking passed for the
root, LSP, VSIX, and MCP workspaces. `npm test` passed 1,040 tests with no
failure, skip, or cancellation. The English baseline passed over 844 text files
with three allowlisted lines; documentation checks passed over 237 Markdown
files and seven PERT examples; and read-only self-use passed all 37 plans.
Isolated LSP and MCP packages, the trusted and untrusted VS Code 1.101.0 host,
temporary linking, and the 713-file isolated public package also passed.
`git diff --check` passed.

After the implementation gate, one previewed status-only mutation completed
`MILESTONE_ACCEPTANCE_ADAPTERS`. It changed the plan digest from
`sha256:140573b3...20a9c6` to `sha256:a990cc7e...c0da2`; governance was not
applicable, and one expected-digest in-place write was read back. Fresh
complete NextResult v7 recommends and makes runnable only
`MILESTONE_ACCEPTANCE_ACCEPTANCE`.

## Remaining boundary

This record accepts only the implementation task. Final cross-surface
`MILESTONE_ACCEPTANCE_ACCEPTANCE`, release selection, version preparation,
candidate retention, Git remote writes, tags, GitHub Release, npm publication,
dist-tag changes, Issue mutation, and plan advance remain separate.
