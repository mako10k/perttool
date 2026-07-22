# Recommendation実装・自己利用migration

- 文書状態: Active 1.2
- 作成日: 2026-07-22
- 対応要件: [../requirements.md](../requirements.md)
- 基本設計: [../basic-design.md](../basic-design.md)
- Interface contract: [../specs/recommendation-interface.md](../specs/recommendation-interface.md)
- Human override: [../specs/recommendation-override.md](../specs/recommendation-override.md)
- 規範例: [../examples/recommendation.md](../examples/recommendation.md)
- AI開発ガイド: [ai-development.md](ai-development.md)
- 自己利用計画: [self-use.md](self-use.md)
- 関連Issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)
- 設計受け入れ記録: [recommendation-design-review.md](recommendation-design-review.md)

## 1. 目的

本書は、設計済みのrecommendation契約を、現行`Perttool.NextResult.v2`の意味を途中で変えずにCore、CLI、自己利用へ導入する順序とgateを定義する。

移行の目的は次である。

- ranking、reason、explanationをUIごとに再実装しない
- incompleteな説明graphをAIのtask選択authorityにしない
- v2からv3へのbreaking migrationを1つの公開logical changeにする
- recommendation実装とhuman override適用を別authorityとして導入する
- 現行のread-only自己利用を、未完成のwriterやaudit pathへ依存させない
- roadmap再構成時に、実装task、dependency、acceptanceを見積り可能な単位へ分ける

本書はprocessとmigration順序を定義する。Ranking、tier、wire schema、overrideの意味は対応する規範仕様を変更しない。

## 2. 現在の境界

2026-07-22時点の実装は次である。

- `selectNextTasks`と`dag next`は`Perttool.NextResult.v2`を返す
- `active`、`ready`、`runnable_now`、`blocked_now`、`upcoming`は実装済み
- recommendation tier、recommended set、structured explanationは未実装
- override validation、apply、audit integrationは未実装
- 自己利用はStage 3であり、editing/advance writeはpreview、expected digest、write後再解析を必須とする。Override applyは未実装である
- AIのtask選択は[AI開発ガイド](ai-development.md)の明示手順をauthorityとする

したがって、設計文書や規範例が存在することだけを理由に、現行v2 fieldをrecommendationとして解釈しない。実装途中の内部resultをCLI、help、AI promptへ公開しない。

## 3. Roadmap再構成gate

最初のproduct implementation taskと見積りは、次を満たした`M1_ROADMAP_UPDATE`でmacro/detail planへ追加する。このgateは2026-07-22に完了した。

1. `plans/control-plane.pert`の`DESIGN_REVIEW`が完了している
2. `plans/grammar.pert`の受け入れが完了している
3. formatter、mutation preview、safe write、advanceを、実際のmodule/file境界と担当resourceへ割り付ける
4. 各unitへduration、acceptance、narrow test、並行可否を付ける
5. `plans/mvp.pert`の`M1_ROADMAP_UPDATE`を完了してからproduct implementationへ着手する

実行順は[操作系詳細plan](../../plans/operations.pert)へ固定し、全24pを完了した。M3、Stage 3、Mermaid profile設計、Mermaid export/import round-tripへ到達した後、[MVP release readiness監査](mvp-release-readiness.md)で受け入れ条件16の未実装を確認した。MIG-01からMIG-07は[Recommendation実装plan](../../plans/recommendation.pert)へ22p、precedence 19p、resource 22pとして詳細化し、operations実測`24p/1d`を初期Velocityに使用する。Macroでは`RECOMMENDATION_IMPLEMENTATION`をrelease hard predecessorへ追加し、`RELEASE_E2E`をupcomingへ戻した。

MIG-01からMIG-07は、v3 publicationまでに`src/cli.ts`、`src/index.ts`、CLI/help test、`REVIEWERS`を共有する。Task別duration、file ownership、acceptance、narrow testは`plans/recommendation.pert`を正とする。MIG-08はsafe-write gateに加えてoverride検証・audit gateを必要とし、MVP後の独立work packageのままとする。Issue #2もhelp surfaceとreviewerを共有するが、macroへ追加するまでは実装順を推測しない。

Roadmap再構成前はrecommendation migrationのduration、担当、parallel可否を先行決定しなかった。2026-07-22のrelease readiness監査で再構成gateを開き、実moduleとverification matrixから初期見積りを固定した。Issue #2をMVP recommendation実装の意味上のpredecessorにせず、共有help surfaceを調整する独立featureとして扱う。

## 4. 実装migration unit

### MIG-01 Normative fixture baseline

[Recommendation規範例](../examples/recommendation.md)のcase IDを、最小`.pert` fixtureと期待factへ展開する。現行v2の`groups`、`tasks`、`resource_rejections`、upcoming `explanation`も同じfixtureでgolden化する。

Exit:

- REC-001からREC-011の実装可能caseがfixtureまたはunit inputへ対応する
- v2 fieldの現行projectionが固定される
- normal version 1で`discouraged`を捏造しない
- fixture追加だけではpublic schemaやtextを変更しない

### MIG-02 Candidate facts、ranking、tier Core

Actual `ready`集合からcandidate fact、complete order、selection horizon、recommended set、tierを計算するpure Coreを実装する。Precedence analysisとproject graph factsを入力にし、schedulerの`runnable_now`、resource arc、schedule critical pathをranking inputへ戻さない。

Exit:

- exact Rationalとstable IDで同じ入力から同じ`H`、`R`、tierを返す
- selected blockerとactive-only blockerを区別する
- empty setとparallel recommendationをunit testで固定する
- `R`がactive allocation込みでjointly feasibleである
- CLI renderer、help、provider adapterにranking ruleが存在しない

### MIG-03 Explanation graphとinvariant Core

MIG-02の判断からfact、expression、decision step、comparison、reason occurrence、descriptionを構築する。Record ID、canonical order、reference closure、description renderingを検査し、不一致を`PTREC-301`から`PTREC-303`へ変換する。

Exit:

- 各ready taskのdecisive chainがcompleteである
- 「なぜAでBではないか」をwinner、alternative、rule、typed factから回答できる
- active-only rejectでready-task winnerを生成しない
- canonical English textがkeyとtyped parameterから再現できる
- invariant failureをpartial success resultへ変換しない

### MIG-04 `NextResult.v3` atomic publication

MIG-01からMIG-03を満たした後、Recommendation Interface Contractに従い、Coreと`dag next`のdefault resultをv3へ一括で切り替える。

同じlogical changeへ含めるもの:

- public Core typeとlibrary export
- CLI JSON serializationとtext summary
- complete JSON、Core/CLI parity、text、errorのgolden
- `dsl help`またはcommand helpのv3説明とmachine-readable help
- README、package documentation、consumer migration guide
- `CHANGELOG.md`のpre-release breaking change
- `schema_version`を最初に検査するconsumer example

同じlogical changeで禁止するもの:

- v2 fieldをrecommendation fieldとして再解釈する
- `--schema-version 2`などのdual emissionを追加する
- incomplete graphを`complete=true`で返す
- CLIだけを先にv3へし、library resultをv2のまま残す
- recommendationと無関係なwriter、formatter、Mermaid変更を混在させる

公開直前までdefault CLIはv2のままにする。内部Coreを先行commitする場合も、未完成resultをpublic exportやhelpから発見可能にしない。

### MIG-05 Read-only override validation

Completeなv3 resultを入力にするpure `validateOverride`を、normal rankingと別resultとして実装する。

Exit:

- override不要、必要、不可能を`PTOVR-*`で区別する
- allowed/deferred replacementのselected setをactive allocation込みで再検査する
- normal reasonをcopyまたはhuman reasonへ変換せずsource IDで参照する
- deterministic artifact ID、caller-asserted actor、明示UTC時刻を固定する
- filesystem、Git、network、task stateを変更しない

MIG-05はv3 publication後に独立して実装できる。MIG-04のnormal recommendationをoverride applyやwrite実装へ依存させない。

### MIG-06 Self-use shadow evaluation

V3 publication後も、直ちにAIのtask selection authorityへ昇格させない。まず`plans/mvp.pert`と選択した詳細planに対し、現行の明示手順とv3 recommendationを同じsnapshotで比較する。

Shadow gate:

- すべてのself-use planがcheck/analyze/nextに成功する
- JSONがknown `Perttool.NextResult.v3`かつ`complete=true`、`truncated=false`である
- algorithm、taxonomy、explanation、expression、description versionをconsumerが理解できる
- 同じ入力とoptionでbyte-identical resultを返す
- recommended taskがactual readyのsubsetで、recommended set全体がresource-feasibleである
- 規範例とself-use goldenが成功し、`PTREC-*`がない
- AIがprimary higher-priority taskとdecisive comparisonをJSONから説明できる
- v2由来のoperational groupとresource/upcoming explanationがmigration前と同じ意味である

Shadow中は[AI開発ガイド](ai-development.md)の現行manual selection手順をauthorityとして維持し、差があればimplementation bug、spec gap、plan fact不足のどれかを切り分ける。Chat上の直感でgoldenをrecommendationへ合わせない。

### MIG-07 Normal recommendation authority adoption

MIG-06を満たした後、normal start selectionだけをAI開発flowのauthorityへ昇格できる。

Adoption changeで同時に更新するもの:

- `AGENTS.md`と`.github/copilot-instructions.md`の共有task selection rule
- [AI開発ガイド](ai-development.md)のmanualからv3への切替
- [自己利用計画](self-use.md)のgateとgolden evidence
- helpのAI向けconsumer手順
- schema/version不明時のsafe stop

AIのnormal selection rule:

1. macro planのrecommended work packageからworkstreamを選ぶ
2. 対応するdetail planのrecommended taskを選ぶ
3. recommended taskのsubsetは選択できる
4. `allowed`は`R`全件を同じstart selectionへ維持した上で1件だけ追加でき、開始後は再解析する
5. `deferred`または`discouraged`をnormal authorityで開始しない
6. task start、completion、block、capacity変更後は同じresultを再利用せず再解析する

複数planを1つのranking domainへ合成する機能はない。Macro planでworkstreamを選んでからdetail planを評価し、異なるdetail planのtaskを直接比較しない。

MIG-07はnormal selectionだけを対象とする。Human overrideを必要とする選択は、MIG-08を満たすまでperttool自己利用上の適用済みoverrideとみなさず、AIはnormal recommendationと人間の指示の差を明示して停止する。人間の最終決定権は失われないが、未実装のaudit/applyを成功したと表示しない。

### MIG-08 Override applyとaudit adoption

Overrideを自己利用へ解禁するのは、MIG-05に加えてsafe-write gateと次を満たした後である。

- selected taskのstart state transitionを安全にpreview、再検査、atomic writeできる
- source digest、capacity option、task stateのstale checkがある
- canonical override artifactをdurable audit sinkへ保存できる
- repository-native運用ではtask state変更とGit trailerを同じlogical commitにできる
- artifact ID、trailer、selected setをapply前後に検証する
- apply後にcheck、analyze、nextを全体再実行する
- single-use IDの再利用とpartial applyを拒否する

MIG-08までは`Perttool.OverrideDecision.v1`の生成が可能でも、file mutation、Git commit、task実行を自動化しない。

## 5. Dependencyと公開境界

```text
design review + grammar acceptance
                  |
                  v
          M1_ROADMAP_UPDATE
                  |
                  v
 FORMATTER_CORE + MUTATION_PREVIEW
                  |
                  v
            WRITE_SAFETY ------------------------------+
                  |                                    |
                  v                                    |
              ADVANCE                                  |
                                                       |
MIG-01 fixtures -> MIG-02 ranking -> MIG-03 explanation|
                                      |                |
                                      v                |
                              MIG-04 v3 publish         |
                                  |          |          |
                                  v          v          |
                         MIG-05 override   MIG-06 shadow|
                                  |          |          |
                                  |          v          |
                                  |      MIG-07 normal authority
                                  |          |          |
                                  +----------+----------+
                                             |
                                             v
                                  MIG-08 override apply
```

MIG-01からMIG-07のside trackは、`M1_ROADMAP_UPDATE`で共有CLI・reviewerの競合を確認したため、`M3_SAFE_WRITE_READY`より前には開始しない。MIG-05とMIG-06はv3 publication後に並行可能な候補だが、safe-write後のresource scheduleでMermaid、Issue #2との順序を再解析する。Diagramは実装見積りやAgent並行実行の許可を意味しない。

## 6. Consumer migration guide要件

MIG-04で追加するconsumer guideは最低限次を含む。

- v2とv3のroot差分
- `schema_version`先行検査
- root `recommendation`がalways presentであること
- ready task 0件とempty recommended setの正常処理
- `recommended_task_ids`を集合として扱うこと
- task decision、primary higher-priority task、decisive step、comparisonの参照手順
- unknown decisive semanticsでは自動開始しないこと
- JSONはcomplete graph、textは`complete=false`のsummaryであること
- `groups`、`tasks`、scheduler resource rejection、upcoming explanationの意味を維持すること
- `optimal=false`をglobal optimumと表示しないこと

Provider別prompt、skill、agent、hook templateはIssue #2のscopeである。各provider guideはこのconsumer ruleを参照し、独自rankingやreason推測を追加しない。

## 7. Failure、rollback、compatibility

### Publication前

- default v2を維持する
- internal ranking/explanation failureをv2 fieldへ混入させない
- failed internal sliceをpublic helpへ掲載しない

### Publication後

- v3 regression時はrecommendationをtask selectionへ使用せず、known-good Git revisionとgoldenで原因を分離する
- `schema_version=v3`のままrecommendation rootを省略しない
- failureを隠すためv3 fieldを空にしたsuccess resultを返さない
- v2 consumerへ黙ってdowngradeせず、pre-release breaking changeとして明示する
- self-use authorityを一時停止してもproject planをtool bugへ合わせて変更しない

Recommendation failureはplan failureとは限らない。Check、precedence analysis、resource schedule、classification、ranking、explanation、adapterのどの境界で失敗したかをsmall golden graphで切り分ける。

## 8. Verification matrix

| Unit | Narrow verification | Publication/adoption gate |
| --- | --- | --- |
| MIG-01 | fixture check、v2 projection golden | 規範case coverage |
| MIG-02 | ranking/tier unit test、determinism、resource invariant | Core review |
| MIG-03 | explanation/reference/invariant test | complete graph review |
| MIG-04 | typecheck、Core/CLI parity、text/JSON E2E、help、package | `npm run check`、CHANGELOG、consumer guide |
| MIG-05 | pure override unit、canonical hash、negative test | filesystem/Git side effectなし |
| MIG-06 | 3 self-use plan、byte determinism、why A/B回答 | shadow evidence |
| MIG-07 | AI workflow dry-run、unknown version safe stop | shared instructions同期 |
| MIG-08 | stale、atomicity、audit trailer、re-analysis | safe-write/override adoption review |

全unitで`git diff --check`を実行する。MIG-04、MIG-07、MIG-08はadapterまたは運用境界を変えるため、narrow testだけで完了扱いにしない。

## 9. Acceptance

- Coreからadapterまでの実装順序を定義した
- v2を維持する内部実装期間とv3 atomic publicationを分離した
- CHANGELOG、help、consumer migration guideをv3切替条件へ含めた
- complete JSONをshadow評価してからnormal authorityへ昇格するgateを定義した
- macro/detail planの二段階selectionを維持した
- normal recommendation adoptionとoverride apply adoptionを分離した
- override applyをsafe-write、audit、stale check、再解析へ接続した
- Issue #2のprovider guideが独自rankingを持たない境界を定義した
- roadmap再構成前にduration、担当、Agent並行性を捏造していない
- current CLI、schema、implementation、write pathを変更していない
