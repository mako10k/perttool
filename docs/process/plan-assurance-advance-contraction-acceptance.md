# Conditional Plan Assurance Advance Contraction Acceptance

- Status: Accepted internal Core
- Acceptance date: 2026-08-04
- Workstream task: `ASSURE_ADVANCE_CONTRACTION`
- Interface: [Plan Assurance Interface Contract](../specs/plan-assurance-interface.md)
- Semantic contract: [Conditional Plan Assurance](../specs/plan-assurance.md)
- Implementation: `src/assurance/advance.ts`,
  `src/application/target-assurance-advance-history.ts`,
  `src/mutation/advance.ts`, `src/application/advance-history.ts`, and
  `src/history/advance-history.ts`
- Focused test: `test/plan-assurance-advance-core.test.mjs`
- Active public runtime: Grammar 5 and CLI Contract 6

## 1. Accepted slice

The internal Grammar 6 advance target reuses the ordinary canonical residual
graph and extends only its assurance-owned declaration removal and receipt
edits. Assurance-disabled input produces the same candidate bytes as the
active Grammar 5 actuals advance. Enabled input evaluates the original
planning graph, groups crossing planning consumers by removed producer,
materializes one frontier receipt per producer, validates the candidate, and
proves exact before/after computed-basis equality for every retained task.

The preferred receipt ID is `AR_<producer-task-id>`. A retained global-ID
collision selects the first free `_2`, `_3`, ... suffix. The receipt stores the
producer contract and exported assurance commitments, known conformant or
changed outcome, sorted consumer task IDs and effective modes, and the removed
task's destination milestone as source provenance. The canonical self-hash
excludes the `receipt_hash` field and top-level receipt ID; the source
milestone remains part of the canonical semantic contract.

## 2. Contraction and pruning

The contraction extension removes assurance records whose current task
endpoint or owner is removed: explicit task relations, task seals, and task
outcomes. `execution_only` relations create no receipt. Both projected
`both` and explicit `planning_only` inputs retain their effective mode in a
shared producer receipt.

A producer may cross only with a verified contract, exported assurance
commitment, and known completion outcome. A changed outcome additionally
requires every retained consumer seal to contain that exact producer, mode,
and commitment. Otherwise the result fails with `PTASSURE-306` and exposes no
candidate. Existing receipts with retained consumers must have model 1 and a
valid self-hash. Partial consumer removal replaces and rehashes only the
machine-owned hash and consumer fields; last-consumer removal deletes the
receipt. The ordinary advance idempotence check includes this extension.

## 3. Independent history safety

The assurance guard and history guard remain independent. The assurance guard
reports the crossing producer set, receipt changes, and each retained basis
comparison. A blocked assurance guard terminates composition before Git
capture. Consequently `forceRequested=true` cannot create `PTADV-103`, a
forced history guard, or write authority for an assurance-blocked candidate.

For a trustworthy candidate, the existing history model accepts the same
Grammar 6 validator. Its destructive inventory now includes removed
`task_relation`, `plan_seal`, `task_outcome`, and `assurance_receipt`
declarations. Receipt pruning additionally protects the replaced hash value
and complete consumer field. Additive receipt bytes need no destructive
record. The existing exact source, `HEAD`, stage-0 index, repository race, and
safe-write boundaries remain otherwise unchanged.

## 4. Verification

Focused acceptance proves:

- package-root absence and byte-identical assurance-disabled behavior;
- conformant `both` contraction and exact retained-basis equality;
- missing producer outcome and damaged retained-receipt refusal;
- changed-outcome refusal before and acceptance after explicit reseal;
- `execution_only` removal without a receipt;
- `planning_only` and `both` consumers grouped into one receipt;
- partial receipt pruning, rehashing, and last-consumer removal;
- deterministic ID collision handling and BOM/CRLF preservation;
- Grammar 6 destructive-record history composition;
- history-loss force refusal before Git capture on an assurance block; and
- authorized separate-output persistence through the digest-bound Grammar 6
  safe writer.

The focused test passes ten cases. After the task's finish event was written,
`npm run check` passed 766 tests, the 574-file English baseline check, 148
Markdown files, seven normative PERT examples, all 30 self-use plans, the
temporary-link workflow, and the 548-file isolated-package workflow.
`git diff --check` also passed.

## 5. Remaining boundary

This slice does not activate Grammar 6, CLI Contract 7, AdvanceResult v2, the
assurance commands, schemas, registry paths, help, Guide, package exports, or
installed behavior. It does not implement the separately planned pinpoint
hash-inspection command or the opt-in ADV-003 archived advance mode. Current
Grammar 5, CLI Contract 6, package `0.6.0`, and every active public result are
unchanged.

After the finish event, fresh complete, non-truncated NextResult v5 recommends
and authorizes only `ASSURE_COMPATIBILITY`. `ASSURE_HASH_INSPECTION` is raw
runnable but deferred by normal authority and remains a separate planned task.

Plan advance, commit, release selection, remote writes, publication, dist-tag
movement, and Issue mutation remain separate authorization boundaries.
