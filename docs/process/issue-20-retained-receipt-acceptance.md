# Issue #20 Retained Receipt History Acceptance

Status: Accepted 1.0

Date: 2026-08-21

Plan: [`issue-20-retained-receipt.pert`](../../plans/issue-20-retained-receipt.pert)

## Accepted correction

The historical transition classifier now treats a frozen task identity absent
from both adjacent task inventories as unchanged. Exactly one absent side
still conflicts, and tasks present on both sides retain exact endpoint and
frozen planning-field comparison. Immutable work-event, task-outcome, and
assurance-receipt payload checks remain earlier fail-closed gates.

The llmthink RCA is
[`issue-20-retained-receipt-rca.think`](issue-20-retained-receipt-rca.think),
and the accepted contract is
[`retained-receipt-history.md`](../specs/retained-receipt-history.md).

## Regression evidence

- Pure transition cases accept an unchanged retained receipt whose producer is
  absent in both snapshots.
- Reintroducing that producer on one side, changing a present frozen task, or
  changing the receipt payload still produces `topology_conflict`.
- A real temporary first-parent repository completes A, canonically advances
  A while retaining its receipt for B, completes and accepts B, and
  canonically advances B.
- The B completion transition is complete and emits neither
  `topology_conflict` nor `PTHDG-103`.
- The full lineage recognizes both canonical advance proofs.

## Complete gate

Node.js 22 `npm run check` passed:

- static type checks for root and private adapters;
- jscpd 5.0.15: 146 clones, 2,731 lines, 3.067 percent;
- Lizard 1.23.0: 4,069 functions and 170 reviewed legacy entries;
- 1,218 tests with zero failure;
- English baseline over 1,064 text files and documentation checks over 322
  Markdown files;
- read-only self-use over 44 plans;
- isolated LSP and MCP package acceptance;
- supported VS Code 1.101.0 trusted and untrusted acceptance;
- temporary npm link at `perttool 0.10.1`; and
- the 872-file isolated public-package workflow.

## Compatibility and remaining boundaries

Grammar 8, CLI Contract 9, public commands, schemas, facades, historical result
identity, Git evidence limits, assurance meanings, adapters, and persistence
are unchanged. Version selection, release publication, remote writes, Issue
#20 mutation, plan advance, and unrelated work remain separately authorized.
