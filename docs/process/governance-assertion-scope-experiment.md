# Loose Governance Assertion Scope Experiment

- Status: Active hypothesis 1.0
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
source_digest: <preview governance.source_digest>
updated_digest: <preview updated_digest>
candidate_summary: <changed goal fields or structural additions/removals>
```

For `dag advance`, the candidate summary includes every task, gate, and
milestone removal reported by the preview. A concise user-facing confirmation
may summarize this context, but it must name the operation and scopes. The
caller, not the user, is responsible for retaining the digest details needed
to distinguish the candidate.

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
| GOV-LOOSE-002 | The same release instruction followed by a structural `dag advance` | Preview stops before write and presents operation `dag.advance`, scope `dag`, required owner, digests, and removals. |
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
