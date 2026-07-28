# CLI Contract 5 migration

- Status: Release source prepared
- Date: 2026-07-28
- From: CLI Contract 4 in perttool `0.3.0`
- Target: CLI Contract 5 in perttool `0.4.0`
- Contract: [Owner-Aware Governance Interface Contract](../specs/governance-interface.md)
- Release: [`v0.4.0` procedure](0.4.0-release.md)

## 1. Boundary

Contract 5 is one breaking cutover for Grammar 4 and owner-aware goal and DAG
mutation governance. Preparing version `0.4.0` does not publish it. Until the
separately authorized publication succeeds, npm `beta` and `latest` continue
to resolve to Contract 4 `0.3.0`.

The cutover changes the grammar, every CLI JSON envelope, project and mutation
result identities, command options, help, Guide, persistent-write authority,
README, package checks, and installed-package workflow together. It retains
the Contract 4 temporal, deadline, exact unit-migration, and NextResult v4
surface.

## 2. Consumer mapping

| Contract 4 | Contract 5 | Consumer action |
| --- | --- | --- |
| `cli_contract_version=4` | `cli_contract_version=5` | Require the exact envelope version before reading a result. |
| `Perttool.ProjectResult.v2` | `Perttool.ProjectResult.v3` | Read declared and effective governance metadata from project results. |
| `Perttool.MutationResult.v1` | `Perttool.MutationResult.v2` | Require and evaluate the embedded `Perttool.GovernanceDecision.v1`. |
| Grammar 1/2/3 | Grammar 1/2/3/4 | Preserve older source through effective owner `user` and empty delegates; use Grammar 4 for declared governance fields. |
| no governance actor | optional `--actor` on previews; required for persistent goal/DAG changes | Supply the principal that is requesting the persistent change. |
| no owner assertion | repeatable `--accepted-by-owner` | For a non-owner actor, supply every distinct affected effective owner as a caller assertion. |

The digest-bound pre-change document determines effective owners and
delegates. An effective owner or delegate has direct authority. A different
actor must provide the complete owner-assertion set for the affected goal and
DAG scopes. Duplicate, malformed, incomplete, invalid, denied, and stale
requests fail closed before or within the retained atomic safe-write gates.
Persistent goal or DAG changes require `--actor`; previews may omit it.

Caller assertions are not authentication, verified identity, signatures, or
a durable approval audit. Direct text editing can bypass tool-mediated
authority checks; Git and human review remain external controls.

## 3. Compatibility and rollback

A Contract 4 runtime rejects Grammar 4 fields and the Contract 5 governance
options. Contract 5 has no `--cli-contract 4` switch, compatibility alias,
dual JSON emission, automatic command rewrite, or environment toggle.
Consumers that are not ready for Contract 5 must pin `perttool@0.3.0`.

Rollback after publication means pinning `0.3.0` while a separately reviewed
Contract 5 fix is prepared. Do not add mixed Contract 4 and Contract 5 runtime
semantics as an undocumented patch.

## 4. Migration verification

Before changing an automated consumer:

1. install the exact `0.4.0` candidate or published package;
2. discover commands with Contract 5 JSON help;
3. require `cli_contract_version=5` and each exact result schema;
4. test Grammar 1/2/3 effective defaults and explicit Grammar 4 owners;
5. preview an owner-authorized write, a non-owner assertion, and a mixed-scope
   batch;
6. verify denied, malformed, invalid, and stale requests do not persist;
7. retain complete NextResult v4 temporal start-authority checks; and
8. rerun exact unit migration to confirm Contract 4 behavior is preserved.

Publication, npm `latest` promotion, and Issue #4 closure remain separate
authorization decisions.
