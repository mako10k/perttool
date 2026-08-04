# Conditional Plan Assurance Source Core Acceptance

- Status: Accepted internal Core
- Acceptance date: 2026-08-03
- Workstream task: `ASSURE_SOURCE_CORE`
- Interface: [Plan Assurance Interface Contract](../specs/plan-assurance-interface.md)
- Semantic contract: [Conditional Plan Assurance](../specs/plan-assurance.md)
- Implementation: `src/model/`, `src/parser/`, `src/semantic/`,
  `src/formatter/`, and `src/assurance/source.ts`
- Focused test: `test/plan-assurance-source-core.test.mjs`
- Active public runtime: Grammar 5 and CLI Contract 6

## 1. Accepted slice

The internal, identity-checked Grammar 6 source capability parses and validates
the two project model fields plus `task_relation`, `plan_seal`,
`task_outcome`, and `assurance_receipt`. It retains UTF-16 declaration, ID,
endpoint, field, nested-entry, and value spans and projects the validated
source into the previously accepted pure assurance hash Core.

The source projection owns exact task contract values, direct task dependency
projection through gate-only milestone paths, explicit relation modes,
accepted seal components, task outcomes, and frontier receipt commitments.
Task status is used only to select unfinished or completed evaluation; it and
all work-event records remain outside task plan hashes.

## 2. Source and validation boundary

Grammar 6 keywords remain contextual. The ordinary Grammar 1 through 5 parser,
validator, formatter, public package root, command registry, CLI, help, Guide,
and schemas do not accept or advertise the future assurance surface.

The Grammar 6 semantic boundary rejects malformed references, duplicate
relation pairs, duplicate seal or outcome ownership, invalid relation-mode
conditions, invalid outcome conditions, unsorted or duplicate nested records,
current-task receipt producers, duplicate frontier pairs, and deterministic
planning cycles with `PTASSURE-101` or `PTASSURE-102`.

Unknown positive model identities, missing seals, inconsistent accepted seal
components, and a missing or self-hash-mismatched receipt remain valid repair
inputs. They project to unsealed, review-required, partial, or unavailable
assurance instead of suppressing the graph required for replanning.

## 3. Formatting and canonical projection

The target formatter uses the accepted declaration-specific field order and
normalizes assurance integers, strings, headers, digests, accepted inputs, and
consumer entries. It preserves BOM, dominant line endings, comments, blank
lines, declaration order, explicit `both` records, and source-owned trivia.

The projection reduces exact Duration and Estimate values, retains declared
calendar values without source offsets, applies task defaults, and excludes
status, blocked reason, events, source spans, formatting, and whole-document
digests from `TaskPlanContract.v1`. A fixed source-to-contract SHA-256 vector
proves that the adapter and canonical hash Core agree.

Frontier receipts use the domain-separated
`Perttool.FrontierAssuranceReceipt.v1` canonical object. The stored self-hash
is checked before its producer assurance commitment enters a consumer input;
a mismatch projects the commitment as unavailable.

## 4. Verification

Focused acceptance proves:

- capability identity checking and absence from `dist/index.js`;
- active Grammar 5 rejection of Grammar 6 project fields;
- complete field, relation, seal, outcome, receipt, and span projection;
- gate-only direct task dependency projection;
- source-preserving BOM/CRLF formatting and idempotence;
- invalid reference, ownership, conditional, order, and cycle rejection; and
- valid unavailable behavior for unknown models, inconsistent seals, and a
  damaged receipt self-hash.

The complete repository test suite initially reported only the two expected
self-use golden mismatches caused by the authorized plan amendment and active
task event. Those goldens are refreshed after the task finish event so they
bind the accepted plan snapshot rather than an intermediate active snapshot.

## 5. Remaining boundary

This slice does not activate Grammar 6, CLI Contract 7, the pinpoint hash
command, public results, schemas, help, Guide, package exports, or
assurance-aware advance. The later governed mutation and start-authority Cores
are accepted separately. `ASSURE_HASH_INSPECTION` owns the read-only scalar
hash UX after the source and hash inputs join.

Plan advance, commit, release selection, remote writes, publication, dist-tag
movement, and Issue mutation remain separate authorization boundaries.
