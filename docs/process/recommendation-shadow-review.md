# Recommendation self-use shadow受け入れ

- 判定: Accepted
- 判定日: 2026-07-23
- 対象task: `SELF_USE_SHADOW` / MIG-06
- Migration: [recommendation-migration.md](recommendation-migration.md)
- Self-use: [self-use.md](self-use.md)
- Test: [../../test/recommendation-self-use-shadow.test.mjs](../../test/recommendation-self-use-shadow.test.mjs)
- Golden: [../../test/golden/self-use/recommendation-shadow.expected.json](../../test/golden/self-use/recommendation-shadow.expected.json)

## 1. 判定

`Perttool.NextResult.v3`のself-use shadow gateを受け入れる。5つのself-use planは同一snapshotのmanual selectionとv3 recommendationが一致し、known version、complete graph、byte determinism、ready subset、joint resource feasibility、operational field、構造化why-notの検査に成功した。

この判定はnormal recommendationのtask selection authority採用ではない。MIG-07で`AGENTS.md`、Copilot指示、AI開発ガイド、help、unknown-version safe stopを同じchangeへ同期するまではmanual selectionをauthorityとして維持する。Read-only override validationとoverride applyも本判定のscope外である。

## 2. 評価snapshot

`SELF_USE_SHADOW`をdoneへ変更する前のsnapshotを評価した。

| Plan | Source digest | Manual selection | V3 recommended | 判定 |
| --- | --- | --- | --- | --- |
| `control-plane.pert` | `sha256:21d4d8e5706031abf5c5713ed680638eef58f0f73cb49e2a3631a605b9c66c95` | empty | empty |一致 |
| `grammar.pert` | `sha256:bbdeeb1636c0c3ca534d0f69b8a52c17f399a31c38aeecb2b7271f07812c909a` | empty | empty |一致 |
| `operations.pert` | `sha256:02735a31416f6e9e1e62e5aa3a816a6d4e1e44ee1b7a2a3e1caab8e5663aedea` | empty | empty |一致 |
| `recommendation.pert` | `sha256:2271c43a68cc7eb0cd9286335a1020c1a1fb53af3d6a3167b86d8f2e02f3109d` | `SELF_USE_SHADOW` | `SELF_USE_SHADOW` |一致 |
| `mvp.pert` | `sha256:1a264e27b67e081708b2ccba87148296bd4b4aaa392b9c1a2eace9b14c014545` | `RECOMMENDATION_IMPLEMENTATION` | `RECOMMENDATION_IMPLEMENTATION` |一致 |

完了状態の更新後も同じtestをcurrent 5 planへ再実行する。Goldenは過去planの代替ではなく、current snapshotのshadow projectionとして更新し、上表を受け入れ時snapshotの記録として保持する。

## 3. Contract検査

5 planすべてで次を確認した。

- root schemaは`Perttool.NextResult.v3`、recommendation interface versionは1
- algorithmは`perttool.recommendation-ranking.lexicographic-frontier` version 1、`optimal=false`
- reason taxonomy `1.0`、explanation/expression/description registry version 1、locale `en`
- `complete=true`、`decisive_chain_complete=true`、`truncated=false`、全omitted count 0
- 同じfileとoptionを2回実行したstdoutがbyte-identical
- 全ready taskにtask decisionがあり、recommended setはreadyのsubset
- result decisionが参照する`set_start_feasibility` factはboolean `true`
- `PTREC-*` diagnosticなし
- v2由来の`groups`、task classification、`runnable_now`、resource rejection、upcoming explanationは既存baselineと同じ意味

`PTDAG-208`はdone closureに対するadvance提案warningであり、recommendation failureではない。

## 4. なぜAでBではないか

評価時のdetail planでは`SELF_USE_SHADOW`をA、`OVERRIDE_VALIDATION`をBとして、次をJSONだけから回答できた。

1. Aはprecedence critical classが`driving`、Bは`non_critical`であり、primary comparisonのdecisive rule `critical_class`でAが上位になる
2. Aをrecommended setへ入れた後、Bの追加は`REVIEWERS` capacity 1に対してselected usage 1、required 1、available 0、deficit 1となる
3. したがってAは`recommended`、Bは`deferred`で、resource decisive ruleは`joint_resource_feasibility`
4. Canonical descriptionはranking comparison、resource conflict、deferred summaryの3件を同じfact/comparisonから導出する

これはchatの再推論ではなく、`primary_higher_priority_task_id`、2つのcomparison、resource capacity witness、description recordから得た説明である。

## 5. Exitとnon-goal

Exit:

- 5 planのcheck/analyze/next成功
- shadow testとgolden成功
- `SELF_USE_SHADOW`をpreview-first、expected digest付きでdoneへ更新
- 完了2pを同日のrecommendation実測へ加え、Velocityを`17p/1d`へ更新

Non-goal:

- normal authority adoption
- read-only override validation
- override apply、audit、Git integration
- `RELEASE_E2E`またはnpm publish
