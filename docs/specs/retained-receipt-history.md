# Retained Receipt Historical Classification

Status: Accepted 1.0

Issue: [#20](https://github.com/mako10k/perttool/issues/20)

## Contract

A retained frontier assurance receipt may outlive its producer task after an
accepted canonical advance. For each task identity frozen by previous work,
outcome, or assurance evidence, historical transition comparison uses this
closed presence table:

| Previous declaration | Current declaration | Result |
| --- | --- | --- |
| absent | absent | unchanged |
| absent | present | `topology_conflict` |
| present | absent | `topology_conflict`, unless an earlier canonical-advance or noncanonical-removal classification owns the transition |
| present | present | compare endpoints and frozen planning fields exactly |

Absent-on-both-sides equality applies only to task declaration lookup. It does
not weaken immutable work-event, task-outcome, or assurance-receipt identity
and payload checks. It does not recognize a canonical advance without the
existing exact complete unforced candidate proof.

## Acceptance matrix

1. A stable retained receipt whose producer is absent in both snapshots does
   not conflict with later lifecycle and assurance additions.
2. A producer absent before and present after conflicts.
3. Changed endpoints or frozen planning fields of a present producer conflict.
4. Changed immutable receipt payload conflicts.
5. Noncanonical removal remains ambiguous and an exact following canonical
   advance remains recognized.

Grammar 8, CLI Contract 9, result and schema identities, public facades,
commands, Git evidence limits, assurance meanings, adapters, and persistence
remain unchanged.
