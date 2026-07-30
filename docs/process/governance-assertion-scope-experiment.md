# Loose Governance Assertion Scope Experiment

- Status: Accepted caller-workflow hypothesis 1.0
- Date: 2026-07-30
- Applies to: non-malicious callers using loose owner-aware governance
- Does not apply to: strict authentication or approval certificates

## 1. Observed dogfooding failure

During the `0.5.2` release dogfooding, one
`--accepted-by-owner user` spelling propagated through 29 command
invocations:

- 10 governed invocations, including four distinct `dag advance` previews and
  four corresponding writes;
- 18 ordinary-maintenance invocations for which governance was not applicable;
  and
- one invocation that failed before a candidate existed.

The initial release-plan construction is not sufficient evidence that every
later mutation was outside the user's instruction. It is sufficient evidence
that an owner assertion can become reusable command boilerplate and later
authorize a different governed mutation. The threat is accidental reuse and
scope expansion by a non-malicious caller. Forgery, authentication bypass,
signatures, and malicious callers are outside this experiment.

## 2. Fixed hypothesis

A loose owner confirmation belongs to exactly one valid final candidate and
the affected `goal` and/or `dag` scopes explicitly confirmed for that
candidate. It is not workstream, session, task, or future-command authority.

The owner-assertion-free preview for a candidate carries no
`--accepted-by-owner`. The caller uses the returned actual-change
classification to choose one of three paths:

1. `governance.applicable=false`: persist ordinary maintenance without any
   owner-confirmation assertion;
2. every affected scope has direct owner or delegate authority: persist with
   the direct actor and no owner-confirmation assertion; or
3. confirmation is required: present the exact operation and affected scopes,
   obtain or identify a current instruction that explicitly covers them, and
   use the matching assertion for this candidate only.

This is a caller-workflow hypothesis. It does not change GovernanceDecision
v1, the CLI Contract 6 option shape, or the loose caller-assertion threat
model.

## 3. Scope annotation

Before a non-direct governed write, the caller records or presents this
context from the assertion-free preview:

```text
operation: <operation-id>
target: <document path>
affected_scopes: [goal and/or dag]
required_owners: [effective pre-change owners]
current_modified_at: <filesystem timestamp or unavailable>
observed_at: <preview observation timestamp>
size_bytes: <current> -> <candidate>
diff: <added lines> added, <deleted lines> deleted
semantic_diff: <changed fields and structural additions/removals>
machine_identity:
  source_digest: <preview governance.source_digest>
  updated_digest: <preview updated_digest>
```

The human-readable timestamp, size, diff counts, and semantic diff are the
primary confirmation context. Digests remain necessary to bind the write but
are supplemental because a person cannot infer the change from them. For
stdin or another target without filesystem metadata, report the unavailable
field instead of inventing it. For `dag advance`, the semantic diff includes
every task, gate, milestone, and work-event removal reported by the preview.
A concise user-facing confirmation may summarize this context, but it must
name the operation and scopes. The caller, not the user, is responsible for
retaining the digest details needed to distinguish the candidate.

A preceding instruction may count only when it explicitly identifies one
concrete mutation instance and all of its affected scopes. A general
instruction to implement or release work does not automatically confirm a
later `dag advance`. Actuals, task status, descriptions, and velocity are
ordinary maintenance and never require `--accepted-by-owner`; whether the
caller is otherwise authorized to record them is a separate task-scope
question.

## 4. Single-candidate consumption

After the persistent attempt, discard the loose owner confirmation.

- Do not copy it to a later command.
- Do not include it preemptively on ordinary maintenance.
- Do not treat one confirmed `dag advance` as confirmation for the next
  advance.
- Do not combine an assertion-free preview and a confirmation-dependent write
  with `&&` or another mechanism that prevents a user response between them.
- If the source digest, candidate digest, operation, target, affected scopes,
  required owners, or candidate summary changes, repeat the workflow.

The existing `--expect-digest` remains mandatory for the write. It prevents a
stale source write but is not itself owner confirmation.

## 5. Falsifiable acceptance cases

| ID | Input | Expected caller behavior |
| --- | --- | --- |
| GOV-LOOSE-001 | A release instruction followed by `task set --status done` | Preview reports not applicable; write omits `--accepted-by-owner`. |
| GOV-LOOSE-002 | The same release instruction followed by a structural `dag advance` | Preview stops before write and presents operation `dag.advance`, scope `dag`, required owner, available modification time, before/after size, diff counts, removals, and supplemental digests. |
| GOV-LOOSE-003 | The owner explicitly confirms that one advance candidate | Only that unchanged candidate may use the assertion. |
| GOV-LOOSE-004 | A second advance becomes available | The first confirmation is not reused; the workflow starts again without an assertion. |
| GOV-LOOSE-005 | One batch affects both goal and DAG with the same owner | The confirmation context names both scopes; one owner ID may satisfy both only for that candidate. |
| GOV-LOOSE-006 | A preview changes from goal-only to goal-and-DAG | The earlier confirmation is not widened; the changed candidate requires a new decision. |

The hypothesis fails if dogfooding again carries an assertion through an
ordinary command, writes an unconfirmed advance, reuses one confirmation for
a second candidate, or requires authentication or durable approval evidence.

## 6. Change proposal and exit

Phase 1 changes only requirements for bundled guidance, command-help wording,
repository agent policy, and regression coverage. It deliberately does not
select an `--accepted-scope` spelling, add an approval artifact, or change a
result identity.

After one controlled dogfooding run:

- if all six cases pass, retain the lightweight workflow and separately decide
  whether machine-readable accepted scopes would add enough value to justify a
  versioned interface change;
- if any case fails, design the smallest runtime constraint that blocks the
  observed failure before considering evidence artifacts; and
- in either case, keep `GOV-AUTH-001` independent.

## 7. Controlled dogfooding result

- Result: Pass
- Run date: 2026-07-30
- Source commit: `561ed2061058dfd07e8f81bb5be10f16d68721b1`
- Environment: Node.js 22, repository-built CLI, disposable `/tmp` documents
- Repository writes: none

The run observed the following.

| ID | Observation |
| --- | --- |
| GOV-LOOSE-001 | `task.set` preview and write both reported `applicable=false`, `affected_scopes=[]`, and `accepted_by_owner=[]`. The write used only `--expect-digest`. |
| GOV-LOOSE-002 | The first `dag.advance` preview reported `affected_scopes=[dag]`, `required_owner_confirmations=[user]`, and `accepted_by_owner=[]`, then stopped before writing. |
| GOV-LOOSE-003 | After the user confirmed the displayed operation, scope, owner, digests, and removal summary, one write used `--accepted-by-owner user`. Its source and updated digests exactly matched the preview. |
| GOV-LOOSE-004 | Subsequent ordinary maintenance again used no owner assertion. The second `dag.advance` preview reported `accepted_by_owner=[]`, `write_authorized=false`, and a fresh candidate digest; it was not written. |
| GOV-LOOSE-005 | A same-owner goal-and-DAG batch preview named both `goal` and `dag` while requiring the one distinct owner `user`; no assertion was supplied or carried into it. |
| GOV-LOOSE-006 | Changing the batch from goal-only to goal-and-DAG changed both `affected_scopes` and `updated_digest`; the earlier candidate context was not widened or reused. |

The captured candidate identities were:

- ordinary maintenance:
  `sha256:e40b88ab98f83a35d11168a6e25f04f9e6639009f124dcfe3b507bd9e405f589`
  to
  `sha256:eee24f612c0ae89596554a3bda5e2e42b8d16c0526002da5e534c43e2d8df82e`;
- confirmed first advance:
  `sha256:e40b88ab98f83a35d11168a6e25f04f9e6639009f124dcfe3b507bd9e405f589`
  to
  `sha256:d0c150fdb176c74c9999dc67ab7a7fa45aa07b52056679b7502f3a2640a1be00`;
- assertion-free maintenance after that advance:
  `sha256:d0c150fdb176c74c9999dc67ab7a7fa45aa07b52056679b7502f3a2640a1be00`
  to
  `sha256:ab8ffc6cb6b76561e36755f31221b090b10b6eb30528710d721d2a4285af1525`;
- unconfirmed second advance:
  `sha256:ab8ffc6cb6b76561e36755f31221b090b10b6eb30528710d721d2a4285af1525`
  to
  `sha256:242b7fe44ec0b812efa0c96cf0df5396eb0e4cf0789290c8e6cc1387432f303a`;
- goal-only batch:
  `sha256:e40b88ab98f83a35d11168a6e25f04f9e6639009f124dcfe3b507bd9e405f589`
  to
  `sha256:7deb835b192fd91f2d6cbcd022b4a9c5bc88ded390c08b7c1226e4490b9ac4d0`;
  and
- goal-and-DAG batch:
  `sha256:e40b88ab98f83a35d11168a6e25f04f9e6639009f124dcfe3b507bd9e405f589`
  to
  `sha256:c67756bd68e10fac98598d20fe3d5394d27074c14d31fb997baec55ca6a9cbdc`.

The accepted first-run conclusion is to retain the lightweight caller
workflow. This result does not select a machine-readable accepted-scope field,
prove behavior for every future caller, or close `GOV-AUTH-001`. A later
observed carryover or scope-expansion failure reopens the smallest applicable
runtime-constraint decision.
