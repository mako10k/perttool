# Milestone Acceptance Read-only Adapter Contract

- Status: Selected model 1
- Date: 2026-08-13
- Parent: [Milestone Outcome Acceptance Contract](milestone-acceptance.md)

## 1. Purpose

This contract projects the accepted milestone-outcome acceptance model through
the existing private LSP, VSIX, and MCP adapters without giving an adapter
acceptance-mutation authority. Effective graph closure, explicit reached state,
criterion acceptance, and task start authority remain separate facts owned by
the existing Domain and Application services.

The adapter slice does not revise `Perttool.GraphViewResult.v1`, the historical
editor result identities, or the five `Perttool.Mcp*Result.v1` wire identities.
It adds one separately negotiated current-document editor result and updates
the MCP semantic payloads to the active Contract 8 Application results.

## 2. Document session boundary

The LSP session retains the exact open text, URI, generation, version, and
SHA-256 source digest. For Grammar 7 source, an injected Application
preparation service returns a coordinate-compatible Grammar 6 analysis view
plus the complete Contract 8 diagnostics. The analysis view has exactly the
same UTF-16 length and line terminators as the original source. The session
rejects a preparation that changes either property.

Parser, graph analysis, symbols, diagnostics, and current GraphView continue to
use the shared session cache. Milestone acceptance inspection uses the original
text and source digest in a distinct snapshot-scoped cache entry. An invalid,
truncated, cancelled, closed, desynchronized, or stale snapshot cannot produce
a current acceptance result.

## 3. Editor negotiation and result

The client offers both exact lists:

```text
milestoneAcceptanceEditorProtocolModelVersions: [1]
milestoneAcceptanceViewResultSchemaVersions:
  ["Perttool.MilestoneAcceptanceViewResult.v1"]
```

When the Application service and both identities are available, the server
advertises the selected scalar identities and accepts
`perttool/milestoneAcceptanceView`. Otherwise the method is unavailable; the
server does not guess a compatible version.

The request contains only the open document URI and exact document version.
The result binds the URI, generation, version, and source digest and has
`current`, `invalid`, or `unavailable` status. A complete current result carries:

- model and Grammar version plus `available` or `not_applicable` availability;
- every milestone in declaration order with title, closure, acceptance,
  grandfather state, current criterion-set identity and commitment;
- every criterion with required/optional meaning, evidence kind, commitment,
  state, effective receipt, evidence reference and revision, caller-asserted
  verifier and time, waiver reason, and revoked receipt identities;
- every blocking required criterion ID in evaluator order;
- retained migration provenance when present; and
- closed source bindings for milestones, sets, criteria, receipts, and any
  migration record.

Older Grammar documents return `not_applicable`; the adapter never rewrites or
implicitly accepts them. All semantic values come from
`inspectEditorMilestoneAcceptance`. The LSP maps only source spans to UTF-16
ranges.

## 4. VSIX presentation

The VSIX negotiates and requests the separate result beside current GraphView
and DAG focus. It validates the complete closed result and its exact document
binding before retaining it. The Webview receives that validated clone and
shows closure, acceptance, grandfather state, blockers, criterion state, and
receipt provenance in a native accessible list.

Source actions carry only the current document binding and one adapter-owned
binding ID. The extension resolves that ID through the retained result, opens
the matching current source range, and rejects stale or unknown actions. The
Webview does not receive a filesystem path and does not infer acceptance from
color, layout, title, task status, or evidence prose.

## 5. MCP projection

The existing five read-only tools and four resources remain unchanged. The
check, analysis, and Next tools now consume active Contract 8 services from
`perttool/node` and return `Perttool.CheckResult.v5`,
`Perttool.AnalysisResult.v6`, and `Perttool.NextResult.v7` semantic payloads.
Their unchanged MCP wire v1 envelopes retain the complete `acceptance` field.
The output schemas embed the corresponding active public schema directly.

The root and Node facades have identical runtime names and values. The MCP
adapter invokes neither the CLI nor a mutation, persistence, Git, editor,
network, or external-verification service.

## 6. Limits and no-write boundary

Existing LSP synchronization, MCP request/source/output, VSIX CSP, and
historical hard limits remain unchanged. This slice provides no criterion-set
replacement, receipt verification, failure, unavailable, revocation, waiver,
advance, external evidence fetch, authentication, trusted time, Git write,
editor edit, public extension identity, Marketplace publication, or release
authority.

## 7. Normative cases

The dependency-ordered cases are in
[`milestone-acceptance-adapter-v1.json`](../../test/fixtures/milestone-acceptance-adapter-v1.json).
They fix document binding, negotiation, shared projection, source navigation,
older-Grammar handling, cancellation and staleness, VSIX accessibility, MCP
parity, no-write behavior, and unchanged wire identities.
