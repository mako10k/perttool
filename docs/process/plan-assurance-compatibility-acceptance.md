# Conditional Plan Assurance Compatibility Acceptance

- Status: Accepted internal compatibility slice
- Acceptance date: 2026-08-04
- Workstream task: `ASSURE_COMPATIBILITY`
- Interface: [Plan Assurance Interface Contract](../specs/plan-assurance-interface.md)
- Semantic contract: [Conditional Plan Assurance](../specs/plan-assurance.md)
- Implementation: `src/assurance/compatibility.ts`,
  `src/assurance/mermaid.ts`, the Grammar 6 unit-migration and mutation
  adapters, and the validated project-history snapshot boundary
- Focused test: `test/plan-assurance-compatibility.test.mjs`
- Active public runtime: Grammar 5 and CLI Contract 6

## 1. Accepted slice

The internal compatibility layer validates complete Grammar 6 input and any
complete candidate before returning an operation result. It captures the raw
source owned by both project assurance-model fields and every relation, seal,
outcome, and receipt declaration. Formatter compatibility compares the full
semantic assurance projection; unit migration and unrelated mutation paths
compare the protected raw records so an incidental operation cannot silently
rewrite, remove, or invent assurance state.

Grammar 6 is now an explicit retained input to the exact unit-migration Core.
The adapter converts only the existing duration inventory, project unit, and
required velocity, preserves version 6 and assurance-owned bytes, and rejects
an invalid or non-preserving candidate. Mixed batches use the Grammar 6
project-field order, placing assurance model fields before ordinary duration
configuration without widening the active Grammar 5 mutation surface.

## 2. Metadata and history boundary

The internal project metadata projection includes the assurance enablement,
model version, and hash-model version next to the established project and
governance facts. It is not a Contract 6 `ProjectResult` change.

Project history now shares its reducer through an injected validated-source
boundary. The active wrapper still accepts only Grammar 1 through 5 and keeps
its exact public result type. The internal wrapper accepts Grammar 1 through 6
snapshots, then reduces only tasks and task-owned work events. It never
projects seals, outcomes, receipts, or Git state as assurance acceptance.

## 3. Mermaid and package boundary

Semantic Mermaid profile 2 carries canonical Grammar 6 source under source and
assurance digests and emits a deterministic AoA graph projection. Import
validates canonical base64, source digest, complete Grammar 6 semantics,
assurance digest, and byte-identical artifact reproduction. Profile 1 and
plain output fail under strict loss handling. An explicit non-strict request
emits projection-only Mermaid with one stable loss record for each omitted
assurance project field or declaration and does not claim round-trip fidelity.

The compatibility and Mermaid modules compile into `dist`; the isolated
package inventory now requires both JavaScript and declaration artifacts.
They remain absent from `src/index.ts`, the package export map, Contract 6
commands, help, Guide, schemas, and the installed public workflow. Direct-edit
guidance states that hash inspection neither repairs a seal nor accepts or
authorizes a reseal candidate.

## 4. Verification

Focused acceptance proves:

- BOM/CRLF and non-canonical Grammar 6 formatting with unchanged assurance
  semantics;
- exact version-6 unit migration with byte-identical assurance records;
- project metadata and mixed-batch field-order preservation;
- actuals-only Grammar 6 Git-history reduction;
- semantic-profile-2 round-trip and damaged-projection refusal;
- strict and explicit-loss behavior for profile 1 and plain Mermaid;
- internal package inclusion without a public root export; and
- the read-only, non-authorizing direct-edit guidance boundary.

The focused compatibility test passes six cases. The related unit-migration
and grammar-boundary regression set passes 39 cases. `npm run check` passes 772
tests, the 578-file English baseline check, 149 Markdown files, seven normative
PERT examples, all 30 self-use plans, the temporary-link workflow, and the
556-file isolated-package workflow with the required internal artifacts.
`git diff --check` also passes.

## 5. Remaining boundary

This slice does not activate Grammar 6, CLI Contract 7, public assurance
results, the assurance command family, schemas, registry paths, help, Guide,
or package-root exports. It does not implement the separately planned
pinpoint hash-inspection command. Current Grammar 5, CLI Contract 6, package
`0.6.0`, and every active public result remain unchanged.

After the finish event, fresh complete, non-truncated NextResult v5 recommends
and authorizes only `ASSURE_HASH_INSPECTION`. `ASSURE_PUBLIC_CONTRACT` remains
blocked until that accepted public input is complete.

Plan advance, commit, release selection, remote writes, publication, dist-tag
movement, and Issue mutation remain separate authorization boundaries.
