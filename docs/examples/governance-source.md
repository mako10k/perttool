# Normative Governance Source Examples

- Document status: Normative 1.0
- Created: 2026-07-26
- Related requirements: [../requirements.md](../requirements.md)
- Source contract: [../specs/governance-source.md](../specs/governance-source.md)
- Authority semantics: [../specs/governance-authority.md](../specs/governance-authority.md)

## 1. Purpose and activation boundary

These cases fix the source and effective-metadata observations accepted by
`GOV_DSL_CONTRACT`. They do not fix the later actor/owner-confirmation CLI,
JSON, text, write, or authority-decision cases owned by
`GOV_NORMATIVE_EXAMPLES`.

Grammar 4 is an accepted target and is not active in perttool `0.3.0`.
The active runtime supports Grammar 1, 2, and 3 and must fail closed for these
explicit Grammar 4 examples until the governance source/interface cutover.

## 2. Source cases

### GOV-SRC-001 Existing documents use effective defaults

Input: [minimal.pert](minimal.pert), an omitted-version Grammar 1 document.

Declared governance:

```text
goal_owner     = null
goal_delegates = null
dag_owner      = null
dag_delegates  = null
```

Effective governance:

```text
goal_owner     = user
goal_delegates = []
dag_owner      = user
dag_delegates  = []
```

Checking, formatting, showing, analyzing, or selecting from this document does
not insert defaults or upgrade its grammar.

### GOV-SRC-002 Explicit Grammar 4 metadata

Accepted target source:

```pert
# Existing .pert plans should normally be maintained through perttool commands; direct DSL editing bypasses goal/DAG owner-confirmation checks.
project GOVERNED:
  version 4
  title "Governed plan"
  duration_unit day
  finish DONE
  goal_owner user
  goal_delegates [llm]
  dag_owner user
  dag_delegates [codex, llm]

milestone START:
  title "Start"
  state reached

milestone DONE:
  title "Done"

task WORK START -> DONE:
  title "Complete the plan"
  duration 1d
```

Declared and effective values are identical. Delegate list source order is
`[codex, llm]`; authority treats it as a set. The header warning is generated
for new documents but has no semantic or authentication meaning.

### GOV-SRC-003 Omission differs from an explicit empty list

For this Grammar 4 project fragment:

```pert
project GOVERNED:
  version 4
  title "Governed plan"
  duration_unit day
  finish DONE
  goal_delegates []
```

declared `goal_delegates` is `[]`, while declared `dag_delegates` is `null`.
Both effective sets are empty. Removing `goal_delegates` is still an actual
goal-governance source change even though its effective set remains empty.

### GOV-SRC-004 Duplicate delegates fail

```pert
project GOVERNED:
  version 4
  title "Governed plan"
  duration_unit day
  finish DONE
  dag_delegates [codex, codex]
```

Expected: `PTSEM-113` on the duplicate delegate value. The parser or metadata
projection must not silently deduplicate the list.

### GOV-SRC-005 Older grammars remain closed

Adding any of `goal_owner`, `goal_delegates`, `dag_owner`, or
`dag_delegates` to Grammar 1, 2, or 3 without setting `version 4` is
`PTDSL-005`. A source-preserving mutation that adds one of these fields to an
older source produces one final candidate that also sets `version 4`.

Clearing the last governance field from Grammar 4 retains version 4. A
separate explicit downgrade succeeds only when the final source is valid
under the selected older grammar.

### GOV-SRC-006 Unit migration and recommendation are unchanged

Point/time unit migration preserves every governance field, omission, and
delegate-list token and retains Grammar 4. Governance metadata does not enter
the DAG or recommendation fact model, so the same non-governance project facts
produce the same schedule, recommendation tiers, and normal start authority.

## 3. Required later projections

The governance interface contract and later normative cases extend these
source observations with:

- exact `project show` text and JSON for declared and effective metadata;
- actor and owner-confirmation request forms;
- governed preview facts and stable denial projections;
- owner, delegate, mixed-scope, self-authorization, and stale-digest cases;
  and
- installed-package behavior after the atomic cutover.

They may not change the source meanings or case observations above.
