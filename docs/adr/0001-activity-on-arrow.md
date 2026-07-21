# ADR 0001: taskをActivity-on-Arrowのedgeとして表現する

- Status: Accepted
- Date: 2026-07-21
- Decision owners: perttool maintainers
- Related requirements: [要件定義](../requirements.md)
- Related specifications: [DSL文法](../specs/dsl-grammar.md)、[Graph Semantics](../specs/graph-semantics.md)

## Context

perttoolは、taskの追加・変更・削除を文書diffとして扱い、PERT/CPM、現在frontier、共有resource scheduleを同じDAGから機械的に再計算する必要がある。

TaskをnodeにするActivity-on-Nodeと、taskをedgeにするActivity-on-Arrow（AoA）のどちらでも一般的な依存関係は表現できる。しかし、本projectの初期要求はtaskをedgeとして扱うこと、milestone/eventを明示すること、PERT線図としてdependencyを可視化しやすいことを重視している。

## Decision

Canonical graph modelにAoAを採用する。

- taskはpositive durationを持つdirected edge
- milestoneはevent node
- gateはduration 0のdependency edge
- task/gate endpointの接続だけをhard precedenceとする
- resource requirement、owner、priorityはedge属性または別制約であり、precedence edgeへ変換しない
- resource競合から派生するresource arcは選択scheduleの説明用であり、正本DSLへ自動保存しない

DSLでは次をcanonical headerとする。

```pert
task IMPLEMENT READY -> IMPLEMENTED:
  title "実装する"
  duration 3d

gate RELEASE_GATE TESTED -> RELEASED:
  reason "試験完了をリリース条件にする"
```

## Consequences

Positive:

- task endpoint変更が`from`/`to`の局所変更になる
- milestone到達、join、frontierをnode状態として明示できる
- PERT/CPMのforward/backward passをedge durationとして直接定義できる
- Mermaid flowchartでmilestone=node、task/gate=edgeを自然に描画できる
- task IDを保ったままtitle、estimate、status、resource requirementを変更できる

Costs:

- 複数taskの合流・分岐にはmilestoneとzero-duration gateが必要になる場合がある
- 一般的なAON toolとの変換ではdummy/gateとloss reportが必要になる
- task中心UIではedge選択とsource span navigationを明示的に設計する必要がある

## Rejected alternatives

### Activity-on-Nodeをcanonical modelにする

一般的なproject management UIとは親和性が高いが、task=edgeという初期要求、milestone/eventの明示、既存DSL表現との整合を失うため採用しない。

### AoAとAONを同時にcanonical modelとして保持する

同期規則と二重のID/source mappingが必要になり、どちらが正本か不明確になる。AON viewが必要な場合はAoA graphから派生表示として生成する。

## Validation

- parserはtask/gate headerの両endpointをsource span付きで保持する
- graph validatorはtaskとgateを含む全edgeでself-loop/cycle/finish reachabilityを検査する
- resource requirementをcycle検査へ混入させないtestを持つ
- Mermaid round-tripはtask/gate IDとendpointを保持する
