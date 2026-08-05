# Adapter Integration Acceptance WIP Handoff

- Document status: WIP 1
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Active task: `ADAPTER_INTEGRATION_ACCEPTANCE`
- Plan: [../../plans/adapter-platform.pert](../../plans/adapter-platform.pert)
- Machine cases: [../../test/fixtures/adapter-integration-acceptance-cases-v1.json](../../test/fixtures/adapter-integration-acceptance-cases-v1.json)

## Frozen state

The final integration task was started through an assertion-free,
governance-not-applicable, digest-bound write at
`2026-08-05T21:57:18+09:00`. Its start event is
`WE-c2a977991aa842f98bf893d13cac1d4e9debdc6910e5bed5b4457579cbbc6823`.
The active plan source digest is
`sha256:7362cd61f955786ad72a13af5e8ba4b00411c9d36941adf92bacd7f93435595d`.

The WIP adds sixteen dependency-ordered integration cases and executable
cross-surface probes for current package boundaries, exact Core/CLI/MCP check,
analyze, and next parity, LSP-to-GraphView-to-VSIX projection identity,
diagnostic ownership, and unchanged source bytes and directory inventory.
The task remains active and must not be reported as accepted.

## Resume checklist

1. Run the focused integration test and correct any remaining failed
   assumptions without weakening the accepted protocol contracts.
2. Add the integrated accepted state to the adapter specification and align
   Requirements, Basic Design, backlog, agent guidance, and development
   procedure.
3. Add the durable final acceptance record and its completed-lifecycle
   alignment test.
4. Run `npm run check` and `git diff --check`, including the isolated LSP,
   MCP, supported VS Code host, temporary-link, and public-package gates.
5. Finish `ADAPTER_INTEGRATION_ACCEPTANCE` through an assertion-free preview
   and digest-bound write only after all evidence passes; then regenerate the
   self-use recommendation golden and rerun the complete gate.
6. Commit the accepted pre-advance state. Do not advance the plan.

Release version selection, public adapter identities, publication, tags,
dist-tags, remote Issue mutation, editor mutation, MCP mutation, and plan
advance remain separate decisions.
