# perttool 自己利用計画

- 文書状態: Active Stage 1 / Revision 2.3
- 作成日: 2026-07-21
- 更新日: 2026-07-22
- 関連設計: [../basic-design.md](../basic-design.md)

## 1. 目的

`perttool` が最低限の read-only 機能を備えた段階から、`perttool` 自身の開発管理に使用する。

最初の対象は DSL 文法の設計・実装作業とする。ただし、未完成の parser や formatter を正本へ無条件に適用する循環は避ける。

## 2. 正本の分離

| Artifact | 役割 | 正本 |
| --- | --- | --- |
| `docs/specs/dsl-grammar.md` | DSL の規範文法、EBNF、例、error policy | Markdown 文書 |
| `plans/mvp.pert` | MVP全体のmacro milestoneとwork package | `.pert` 文書 |
| `plans/grammar.pert` | 文法作業の現在・未来 DAG | `.pert` 文書 |
| `plans/control-plane.pert` | Issue #1のAI工程制御設計の現在・未来 DAG | `.pert` 文書 |
| `test/fixtures/grammar/` | parser が受理・拒否すべき具体例 | fixture/golden |
| Git history | 過去の計画、仕様、実装 | commit history |

`plans/grammar.pert` に EBNF そのものを埋め込んで規範仕様の代用にしない。

## 3. Stage 0: bootstrap（完了）

TypeScript CLI bootstrap、`dsl check`、`dag analyze`、`dag next`とbootstrap gateの検証を完了した。

Stage 0ではrequirementsとbasic designをMarkdownで管理し、grammar planを`.pert`で作成せず、toolがない状態を自己利用済みとはみなさなかった。

Exit criteria:

- `docs/specs/dsl-grammar.md` が実装可能な粒度に達する
- minimal valid/invalid fixture がレビューできる

## 4. Stage 1: read-only self-use

現在の段階。2026-07-21に開始条件を満たし、[MVP macro plan](../../plans/mvp.pert)と[grammar detail plan](../../plans/grammar.pert)をread-onlyの正本計画として使用し始めた。2026-07-22に[AI工程制御設計plan](../../plans/control-plane.pert)を2つ目の詳細planとして追加した。

開始条件:

- `perttool dsl check <file>` が動く
- project、resource、milestone、task、gate を parse できる
- duplicate ID、undefined endpoint、self-loop、cycle、finish unreachable を検出できる
- `perttool dag analyze <file>` が expected、float、resource scheduleを計算できる
- `perttool dag next <file>` が active/ready/runnable_now/blocked_now/upcoming を返す
- text と JSON の fixture test が通る

開始時に実施した操作:

1. 手作業で `plans/grammar.pert` を作成した
2. `perttool dsl check plans/grammar.pert` を実行した
3. `perttool dag analyze plans/grammar.pert` を実行した
4. `perttool dag next plans/grammar.pert` を実行した
5. 3 commandを`npm run check:self-use`経由でCIのrequired checkへ追加した
6. check/analyze/nextのprojectionを[grammar golden](../../test/golden/self-use/grammar.expected.json)と[MVP golden](../../test/golden/self-use/mvp.expected.json)へ固定した

開始時の機械的な結果:

- precedence makespan: 8d
- resource-constrained makespan: 10d
- ready: `ERROR_RECOVERY`、`FIELD_FIXTURES`、`BLOCK_TEXT_SPANS`
- runnable_now: `ERROR_RECOVERY`、`BLOCK_TEXT_SPANS`
- `FIELD_FIXTURES`は`GRAMMAR_REVIEW` capacity 1を`ERROR_RECOVERY`が先に仮取得するためresource待ち

2026-07-21のPoint/velocity導入後、最初の対象である`plans/grammar.pert`を`duration_unit point`へ移行した。既存10d resource baselineを初期calibrationとして`velocity 10p/10d`を置き、PERT/CPMの基準値を8p/10p、velocity forecastを8d/10dとして分離してgoldenへ固定した。2026-07-22に完了実績から再calibrationし、詳細は本節の「Velocity実測calibration」に記録した。

同日に`ERROR_RECOVERY`を完了し、複数syntax error、phase suppression、diagnostic上限をfixture/CLI E2Eで固定した。完了taskは未実装のadvanceで安全に圧縮できるまで`done`で保持する。残計画はprecedence/resourceとも7p、velocity forecast 7dとなり、次の`FIELD_FIXTURES`と`BLOCK_TEXT_SPANS`は同時にrunnableである。

続いて`FIELD_FIXTURES`を完了し、project/resource/milestone/task/gateの全fieldを1つの正常fixtureで検査した。Identifier、string、duration、velocity、date、list、integer、enum、inline commentの異常fixtureと、missing/duplicate/field combinationの境界も独立入力へ固定した。仕様に存在した`PTDSL-011`の未到達を修正し、quoted string、tag list、block text内の`#`とinline commentを区別した。

その後`BLOCK_TEXT_SPANS`を完了し、block textのcommon indent、paragraph blank、common indent後のtab、末尾spaceをdecoded valueへ保持した。`FieldNode.valueSpan`を`|` markerとして維持し、UTF-16 code unit基準の`contentSpan`を追加して、leading/trailing blankをCST triviaとして保持した。残計画はprecedence/resourceとも5p、直近実測velocityによるforecastは1dである。次のreadyかつ`runnable_now`は`FORMATTER_IMPLEMENT`と`HELP_FIXTURE_SYNC`であり、前者だけがprecedence/resource criticalである。

続いて`FORMATTER_IMPLEMENT`を完了し、有効文書からUTF-16 `TextEdit`と再検査済み候補を返すpure `formatDocument` Coreを実装した。HSPACE受理をEBNFへ揃え、declaration/field順、comment、blank、decoded block text、BOM、主要line endingを保持しながら、syntax spacing、Decimal、String、TagList、block common indent、末尾newlineを正規化する。残りprecedence makespanは2p、`GRAMMAR_REVIEW` capacityを考慮したresource makespanは3p、実測velocity forecastはそれぞれ2/5dと3/5dである。`FORMATTER_ROUNDTRIP`がcriticalかつ`runnable_now`、`HELP_FIXTURE_SYNC`はreadyだがreviewer競合のresource rejectionを持ち`runnable_now`には入らない。

続いて`FORMATTER_ROUNDTRIP`を完了し、全declaration/field、comment、blank、block text、非canonicalなHSPACE、Decimal、String、TagListを含むsource fixtureとcanonical goldenを追加した。整形結果のgolden一致、再整形時のeditなし、source tokenとspanを除いたexact値ベースのAST同値を自動検査する。残りprecedence/resource makespanは`HELP_FIXTURE_SYNC`の1pだけで、実測velocity forecastは`1/5d`である。同taskが唯一のready、critical、`runnable_now`となり、完了するとgrammar acceptanceが成立する。

2026-07-22に[Issue #1「`dag next`をAI工程制御APIへ発展させる」](https://github.com/mako10k/perttool/issues/1)をmacro planへ反映した。機能依存を捏造せず、`CONTROL_PLANE_DESIGN_WORK_PACKAGE`と`GRAMMAR_WORK_PACKAGE`を並行可能にし、両方の受け入れを`FOUNDATION_INPUTS_ACCEPTED`で合流させた。Issue #1の設計受け入れ後はcontrol-plane work packageをdoneとし、macroで残るreadyかつcriticalなwork packageは`GRAMMAR_WORK_PACKAGE`だけである。Grammar受け入れ後の`M1_ROADMAP_UPDATE`で操作系のdetail planを確定するまで、formatter以降はreadyにならない。

[AI工程制御設計plan](../../plans/control-plane.pert)はIssue #1の設計範囲をPointとvelocity forecastへ分解する。`VISION_REQUIREMENTS`と`RECOMMENDATION_MODEL`に加え、`RANKING_POLICY`でselection horizon、完全tie-break、joint-feasibleなrecommended setを[Ranking Policy仕様](../specs/recommendation-ranking.md)、`REASON_CODE_TAXONOMY`でstable code、effect/role、typed fact category、entity referenceを[Reason Taxonomy仕様](../specs/recommendation-reasons.md)、`STRUCTURED_EXPLANATION_MODEL`でtyped fact、制限付きexpression、comparison、decision trace、description projectionを[Structured Explanation仕様](../specs/recommendation-explanation.md)、`INTERFACE_CONTRACT`でCore type、complete JSON、text summary、`NextResult.v3` migrationを[Recommendation Interface Contract仕様](../specs/recommendation-interface.md)、`HUMAN_OVERRIDE_CONTRACT`でfeasible replacement、human reason、Git audit artifact、single-use、再解析を[Recommendation Human Override Contract仕様](../specs/recommendation-override.md)へ確定した。`NORMATIVE_EXAMPLES`でcritical対priority、unlock、gate近傍、parallel recommendation、selected/active-only blocker、empty set、構造化description、human override境界を[Recommendation規範例](../examples/recommendation.md)、`PROCESS_MIGRATION`でCoreからv3 publication、shadow evaluation、normal authority、override applyまでのgateを[Recommendation実装・自己利用migration](recommendation-migration.md)へ固定した。最後の`DESIGN_REVIEW`は[設計受け入れ記録](recommendation-design-review.md)で横断整合を確認して完了した。全17pがdoneで、残りresource makespanとvelocity forecastは0であり、ready taskはない。Calibration時点で未完了だった`DESIGN_REVIEW`の1pは次回標本へ送る。Check/analyze/next projectionは[control-plane golden](../../test/golden/self-use/control-plane.expected.json)へ固定する。

同日に[Issue #2「AI Agent Guidance Registryとprovider別helpを追加する」](https://github.com/mako10k/perttool/issues/2)を独立featureとして登録した。Issue #1が「何を今行うべきか」を扱うのに対し、Issue #2はその判断へ従うためのprompt、skill、agent、hookなどをprovider別に表示する方法を扱う。初期scopeはofflineかつread-onlyの`agent help`であり、audit、scaffold、hook enforcementは後続段階とする。Issue #2はM1のpredecessorにせず、操作系trackを遅らせないcapacityでだけ並行する独立backlogとして保持する。

### 4.1 Velocity実測calibration

DSL version 1はworking calendar、pause、作業開始時刻を持たないため、commit timestamp間の数時間を暗黙のengineering-dayへ変換しない。自己利用planのVelocityは次の決定的なactive-day方式で測る。

1. 対象planで、taskを`done`にしたcommitと同じlogical changeにacceptance artifactとtest結果があることを確認する
2. 前回calibration後に完了したtaskの宣言Pointを合計する
3. そのcompletion commitが属するAsia/Tokyoの異なる日付数をactive dayとして数える
4. `completed points / active days`をproject-wide team Velocityとする
5. 同日parallel workは二重にdayを数えず、Point合計へ反映する
6. calibration自身が完了させるtaskは循環を避けて次回標本へ送る

2026-07-22 recalibration:

| Plan | Closed sample | Completed Point | Active day | Velocity | Remaining forecast |
| --- | --- | ---: | ---: | --- | --- |
| `grammar.pert` | `BLOCK_TEXT_SPANS`、`FORMATTER_IMPLEMENT` | 5p | 1d | `5p/1d` | 1p = `1/5d` |
| `control-plane.pert` | `VISION_REQUIREMENTS`から`PROCESS_MIGRATION`までの9 task | 16p | 1d | `16p/1d` | calibration時点で1p = `1/16d` |

これはeffort hourや個人別生産性ではなく、plan単位の観測throughputである。両標本ともactive dayが1日なので暫定値とし、新しいactive dayまたは複数taskの完了が蓄積した時点で再calibrationする。Grammar実装とcontrol-plane設計はwork typeが異なるため平均せず、将来のdetail planは最も近いwork typeの標本を初期値として明示する。

Grammarの`FORMATTER_ROUNDTRIP` 2pは前回calibration後の新規標本がまだ1 taskのため、Velocityを`5p/1d`に維持して次回calibrationへ送る。Control-planeの`DESIGN_REVIEW` 1pも新規標本がまだ1 taskのため、次回calibrationへ送る。

この段階で許可する操作:

- check
- analyze
- next
- CLI JSONによるcheck/analyze/next result
- Mermaid export が read-only で利用可能なら preview

この段階で禁止する操作:

- `format --write`
- `task ... --write`
- `milestone ... --write`
- `resource ... --write`
- `dag advance --write`

## 5. 詳細planとmacroの関係

### 5.1 最初のgrammar plan

`plans/grammar.pert` は、作成時点で未完了の項目だけを含める。

想定する task group:

- lexical rule の確定
- indentation と block rule の確定
- identifier/string/comment rule の確定
- project/milestone/task/gate grammar の確定
- duration/estimate grammar の確定
- resource/capacity/requires/priority grammar の確定
- EBNF と sample の整合
- parser error recovery
- source span
- formatter round-trip
- help sample 同期

すでに完了している作業を履歴再現のためだけに追加しない。必要な過去情報は Git から参照する。

### 5.2 MVP macro planとの関係

`plans/mvp.pert`はM1からM6までのstage gateとwork packageだけを持つ。`GRAMMAR_WORK_PACKAGE`は`plans/grammar.pert`、`CONTROL_PLANE_DESIGN_WORK_PACKAGE`は`plans/control-plane.pert`のresource makespanとvelocity forecastをroll-upするが、内部taskの状態を重複管理しない。

- macro milestoneと全体critical path: `mvp.pert`
- 現在のgrammar実装taskとresource待ち: `grammar.pert`
- 現在のAI工程制御設計taskとresource待ち: `control-plane.pert`
- macroでworkstreamを選んだ後、対応する詳細planで日々のtaskを選ぶ
- 詳細slice完了時にだけ対応するmacro taskをdoneへ更新する
- Issue #1の設計は受け入れ済みであり、grammar受け入れ後の`M1_ROADMAP_UPDATE`でformatter、mutation preview、safe write、advanceを最優先trackとして詳細化する
- recommendation実装とIssue #2は、操作系のdeveloper、reviewer、file ownershipを競合させずmilestoneを遅らせない場合だけ並行する
- roadmap再構成が完了するまでformatter以降へ進まない

### 5.3 AI工程制御設計plan

`plans/control-plane.pert`はIssue #1の設計完了条件を次の順序へ分解する。

1. product visionとrequirement境界
2. lifecycle/eligibility、resource selection、recommendation tierの分離
3. deterministic ranking policy、stable reason code、human override契約
4. structured reason descriptionとdecision trace
5. Core、text、JSON interface契約
6. normative example、test観点、self-useとmigration方針
7. 横断design review

規範となるrecommendation内容は`docs/requirements.md`と対応する`docs/specs/`へ置き、plan descriptionを仕様の代用にしない。今回のdetail planは設計のみであり、`dag next`やCore APIの実装変更を含めない。

### 5.4 Recommendation実装と自己利用への移行

[Recommendation実装・自己利用migration](recommendation-migration.md)を正とし、次を分離する。

- internal Core implementation
- `NextResult.v3` atomic publication
- self-use shadow evaluation
- normal recommendation authority adoption
- safe-write後のoverride apply/audit adoption

V3 publicationだけで現行Stage 1のtask selection ruleを置き換えない。Shadow gateと共有instruction更新が完了するまで[AI開発ガイド](ai-development.md)のmanual selectionを維持する。Override applyはsafe-write gateを満たすまで解禁しない。操作系とrecommendation実装がresourceまたはfile ownershipで競合する場合は、Stage 2とStage 3へ進む操作系を優先する。

## 6. Stage 2: safe-write self-use

開始条件:

- formatter が idempotent
- comment、宣言順、block text を保持する regression test がある
- mutation が source span に対する局所 TextEdit を使う
- 変更後文書を再 parse・再検査する
- unified diff を preview できる
- atomic write がある
- expected digest による競合拒否がある
- `plans/grammar.pert` の round-trip golden test がある

追加で許可する操作:

- `dsl format --write`
- `task add|set|remove|finish --write`
- `milestone add|set|remove --write`
- `resource add|set|remove --write`

運用:

1. 必ず preview を先に取得する
2. diff が対象 task/milestone 以外へ広がっていないことを確認する
3. write 後に check/analyze/next を再実行する
4. `.pert` と対応する仕様・実装を同じ logical commit にまとめる

## 7. Stage 3: advance self-use

開始条件:

- done task を含む合流 fixture がある
- advance 前後の effective reached と ready set を比較する test がある
- 合流判定に必要な done task を保持する test がある
- 不要な過去 subgraph だけを削除する test がある
- rollback 可能な Git 運用が確認できる

追加で許可する操作:

- `dag advance --write`

advance 運用:

1. task を `done` にする
2. next/analyze で新しい reached closure を確認する
3. advance preview を確認する
4. 削除される task/milestone の一覧を確認する
5. write 後の ready set を確認する
6. Git commit する

## 8. Stage 4: 対象拡大

MVP macro planはStage 1から全体milestoneの確認に使用する。Grammar planでのread-only運用開始後、product方向を確定する必要からIssue #1のcontrol-plane設計planをStage 1で追加し、設計受け入れまで完了した。Issue #2は独立backlogとして保持し、まだ詳細planへ展開しない。Grammar受け入れ後の`M1_ROADMAP_UPDATE`では次の順で詳細化する。

- formatterとmutation preview
- safe write
- advance
- 操作系を遅らせない場合だけ、Issue #1の設計結果に基づくrecommendation実装
- 操作系を遅らせない場合だけ、Issue #2のread-only AI Agent Guidance Registry
- Mermaid conversion
- perttool全体のMVP release plan
- MVP後のMCP/LSP adapter

各 plan は現在・未来だけを持ち、完了部分は advance と Git history で管理する。

## 9. 障害時の扱い

### parser regression

- 先に grammar spec と fixture を確認する
- plan を parser bug に合わせて変更しない
- 直前の動作版で plan を check する
- fix 後に旧版と新版の結果差を記録する

### formatter/mutation regression

- write を停止する
- Git diff から意図しない変更を分離する
- source document を直前 commit から復元する
- regression fixture を追加してから再開する

### analysis regression

- next result を作業判断に使わない
- 手計算ではなく、既知の小さな golden graph と照合する
- expected、float、critical、ready のどの段階で差が出たか切り分ける

## 10. 自己利用の証跡

自己利用開始 commit では次を残す。

- bootstrap gate を満たした test 名
- `plans/grammar.pert`
- check/analyze/next の golden result
- CI command
- read-only で開始したこと

safe-write と advance を解禁する commit でも、それぞれの gate を満たした test と golden を残す。

Stage 1開始時の証跡:

- parser/check gate: `all normative examples parse and validate`、各invalid fixture diagnostic test、`resource requirements do not become precedence edges`
- analyze gate: precedence、capacity override、active allocation、resource witness、schedule critical pathを固定する`analysis.test.mjs`
- next gate: `parallel next selects a deterministic runnable subset`、classification/depth unit test、text/JSON CLI integration test
- self-use golden: grammar、control-plane、MVP planのcheck/analyze/next projection test
- Point self-use gate: grammar/control-plane planの基準unit、active-day実測velocity、precedence/resource forecastをgoldenで分離して検査する
- field fixture gate: `all declaration fields parse from the grammar acceptance fixture`と各`grammar fixture ... reports only ...` testでfield/token境界を固定する
- block text/span gate: common indent、paragraph、tab/末尾space、leading/trailing trivia、UTF-16 marker/content spanをparser testと専用fixtureへ固定する
- formatter Core gate: HSPACE入力、source構造保持、lexical normalization、UTF-16 non-overlap edit、invalid input拒否をformatter testへ固定する
- formatter round-trip gate: 全fieldのgolden一致、idempotence、exact値ベースのAST同値をformatter testへ固定する
- control-plane planning gate: Issue #1の設計17p完了、残り0p、ready taskなし、設計受け入れ記録をgoldenと文書へ固定する
- CI entrypoint: `npm run check`から`npm run check:self-use`を実行し、3 planを検査する
- write状態: Stage 1では全面禁止。Planの変更は手作業とGit diffで行う
