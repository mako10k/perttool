# Issue #48 public contract verification

## Scope and authority

The 2026-11-13 owner message authorized continuation with 18p and 12–24
engineer-hours and directed the public contract first. This record covers
MAX_COUNT_PUBLIC_CONTRACT, estimated at 5p. The owner's count-first and
boundary-tie requirements are preserved in the public contract and ADR 0011.

## Delivered contract

[Maximum-count selection](../specs/maximum-count-selection.md) defines CLI
Contract 12, NextResult v10, recommendation model 2, OverrideDecision v2 and
MCP Next v2. Closed schemas, twenty registered description templates, two
complete Next examples, one complete override example and five source-bound
selection vectors fix the projection before adoption.

The engineering choices are lexicographic semantic-rank group counts after
maximum task count, then stable task IDs, and a result decision ID bound to the
complete normalized selection input. Every boundary group reports capacity,
active usage, outside-group selected usage, allocatable units, selected usage
and remaining units for each resource.

MCP schema derivation preserves successful-result conditions when facade
metadata is removed. This obligation is exercised against a standalone schema
with all definitions included.

## Direct verification

- Twelve exact-core tests passed, including an independent exhaustive oracle,
  multiple resources, zero-resource tasks, active usage and complete frontiers.
- Seven public-contract tests passed. They validate the closed schemas, real
  source/ranking vectors, cross-field selection equations, description templates,
  override commitments and MCP success conditions. Deliberately inconsistent
  examples are rejected by schema or semantic checks as appropriate.
- Three existing Issue #37 tests passed through the current v9 entrypoints.
- The English baseline check passed across 1,446 text files.
- Repository documentation checks passed across 432 Markdown files and seven
  PERT examples. git diff --check passed.

These are local artifact and contract checks. This phase uses self-review.
Production entrypoints still emit v9 at this checkpoint. MAX_COUNT_ADOPTION
and MAX_COUNT_ACCEPTANCE cover runtime integration and consumer verification.
Their remaining estimate is 13p within the authorized continuation budget.

## Adoption clarification on 2026-11-13

Contract revision 1.1 records zero applied capacity, deferral of individually
oversized tasks while other tasks remain selectable, explicit null resource
forecasts when the complete forecast owner is unavailable, and the two traced
editor/Planning Pool consumers. The candidate and registered schemas agree.
The MCP contract is the self-contained adapter derivation with its own
identity. An exact structural comparison now checks it against the live
adapter schema. Runtime and consumer evidence is recorded in
[the adoption verification](issue-48-adoption-acceptance.md).
