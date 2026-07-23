# perttool 自己利用計画

- 文書状態: Active Stage 3 / Revision 2.20
- 作成日: 2026-07-21
- 更新日: 2026-07-23
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
| `plans/operations.pert` | formatter previewからadvanceまでの現在・未来 DAG | `.pert` 文書 |
| `plans/recommendation.pert` | MIG-01からMIG-07の実装・shadow・adoption DAG | `.pert` 文書 |
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

2026-07-21に開始条件を満たし、[MVP macro plan](../../plans/mvp.pert)と[grammar detail plan](../../plans/grammar.pert)をread-onlyの正本計画として使用し始めた。2026-07-22に[AI工程制御設計plan](../../plans/control-plane.pert)と[操作系詳細plan](../../plans/operations.pert)を追加し、同日にStage 2、操作系完了後にStage 3へ移行した。

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

最後に`HELP_FIXTURE_SYNC`を完了した。Parser/validator diagnosticが参照していた未登録のproject、resource、milestone、string、text、tags、comments、top-level help topicと、基本設計上必要なgate topicをregistryへ追加した。全registry topicのrelated link、syntax/sample topicのstable `.pert`参照とparser受理、全invalid parser fixtureのdiagnostic `helpTopic`解決を自動検査する。Grammar planの全13pがdoneとなり、残りmakespanとready taskは0である。Macroでは`GRAMMAR_WORK_PACKAGE`もdoneとなり、次のcriticalかつ`runnable_now`は操作系roadmapを確定する`M1_ROADMAP_UPDATE`である。

2026-07-22に[Issue #1「`dag next`をAI工程制御APIへ発展させる」](https://github.com/mako10k/perttool/issues/1)をmacro planへ反映した。機能依存を捏造せず、`CONTROL_PLANE_DESIGN_WORK_PACKAGE`と`GRAMMAR_WORK_PACKAGE`を並行可能にし、両方の受け入れを`FOUNDATION_INPUTS_ACCEPTED`で合流させた。Issue #1の設計受け入れ直後はcontrol-plane work packageをdoneとし、その時点でmacroに残るreadyかつcriticalなwork packageは`GRAMMAR_WORK_PACKAGE`だけだった。Grammar受け入れ後は`M1_ROADMAP_UPDATE`で操作系のdetail planを確定するまで、formatter以降はreadyにならない。

[AI工程制御設計plan](../../plans/control-plane.pert)はIssue #1の設計範囲をPointとvelocity forecastへ分解する。`VISION_REQUIREMENTS`と`RECOMMENDATION_MODEL`に加え、`RANKING_POLICY`でselection horizon、完全tie-break、joint-feasibleなrecommended setを[Ranking Policy仕様](../specs/recommendation-ranking.md)、`REASON_CODE_TAXONOMY`でstable code、effect/role、typed fact category、entity referenceを[Reason Taxonomy仕様](../specs/recommendation-reasons.md)、`STRUCTURED_EXPLANATION_MODEL`でtyped fact、制限付きexpression、comparison、decision trace、description projectionを[Structured Explanation仕様](../specs/recommendation-explanation.md)、`INTERFACE_CONTRACT`でCore type、complete JSON、text summary、`NextResult.v3` migrationを[Recommendation Interface Contract仕様](../specs/recommendation-interface.md)、`HUMAN_OVERRIDE_CONTRACT`でfeasible replacement、human reason、Git audit artifact、single-use、再解析を[Recommendation Human Override Contract仕様](../specs/recommendation-override.md)へ確定した。`NORMATIVE_EXAMPLES`でcritical対priority、unlock、gate近傍、parallel recommendation、selected/active-only blocker、empty set、構造化description、human override境界を[Recommendation規範例](../examples/recommendation.md)、`PROCESS_MIGRATION`でCoreからv3 publication、shadow evaluation、normal authority、override applyまでのgateを[Recommendation実装・自己利用migration](recommendation-migration.md)へ固定した。最後の`DESIGN_REVIEW`は[設計受け入れ記録](recommendation-design-review.md)で横断整合を確認して完了した。全17pがdoneで、残りresource makespanとvelocity forecastは0であり、ready taskはない。Calibration時点で未完了だった`DESIGN_REVIEW`の1pは次回標本へ送る。Check/analyze/next projectionは[control-plane golden](../../test/golden/self-use/control-plane.expected.json)へ固定する。

同日に[Issue #2「AI Agent Guidance Registryとprovider別helpを追加する」](https://github.com/mako10k/perttool/issues/2)を独立featureとして登録した。Issue #1が「何を今行うべきか」を扱うのに対し、Issue #2はその判断へ従うためのprompt、skill、agent、hookなどをprovider別に表示する方法を扱う。初期scopeはofflineかつread-onlyの`agent help`であり、audit、scaffold、hook enforcementは後続段階とする。Issue #2はM1のpredecessorにせず、操作系trackを遅らせないcapacityでだけ並行する独立backlogとして保持する。

同日に[Issue #3「backlog階層とmulti-plan PERT compositionを統合する」](https://github.com/mako10k/perttool/issues/3)を将来構想として登録した。Product/Sprint Backlog、Sprint PERT、macro/detail PERTのownership、link、roll-up、include/referenceを設計対象とするが、grammar version 1やMVP操作系へ機能依存を追加しない独立backlogとして保持する。

`M1_ROADMAP_UPDATE`では[操作系詳細plan](../../plans/operations.pert)を作成し、formatter preview 3p、mutation preview 9p、safe write 6p、advance 6pを実module/file、acceptance、narrow test、parallel可否へ割り付けた。操作系の完了標本はまだないため、近い実装作業であるgrammarの直近実測`3p/1d`を初期Velocityとして暫定継承する。Precedence/resource makespanはともに21p、forecast 7dで、最初のcriticalかつ`runnable_now`は`TASK_MUTATION_CORE`、6pのfloatを持つ`FORMAT_APPLICATION`も同時に`runnable_now`である。Macroは17d、resource delay 0dとなり、`MUTATION_PREVIEW`と`FORMATTER_CORE`が同時にrunnableである。

続いて`TASK_MUTATION_CORE`を完了した。[Mutation Semantics仕様](../specs/mutation.md)を正本として、task add/set/remove/finishをsource spanへ局所化した非重複UTF-16 `TextEdit`、再検査済みcandidate、SHA-256 digest、deterministic unified diffとして返すpure library Coreを実装した。Comment所有、BOM、主要line ending、trailing trivia、duration/estimate切替、tag/requirement局所更新、invalid candidate抑止を専用testへ固定し、I/OとCLI公開は追加していない。最初の操作系標本4pをAsia/Tokyoの1 active dayで完了したため、Velocityを実測`4p/1d`へ再calibrationした。残るprecedence/resource makespanは17p、forecastは`17/4d`で、次のcriticalかつ`runnable_now`は`ENTITY_MUTATION_CORE`、並行可能な非critical taskは`FORMAT_APPLICATION`である。Macroのresource makespanは`59/4d`となる。

続いて`ENTITY_MUTATION_CORE`を完了した。Milestone/resource add/set/removeをtaskと同じsource-preserving pathへ統合し、comment所有、無関係field、既存resource tags、declaration順を保持する。単独milestone addではvalidな中間DAGを作れない仕様穴を解消するため、複数atomic mutationをoriginal spanへ計画して最終candidateだけを検査するbatch契約を追加した。Connected milestone追加、path置換、resourceとtask requirementの同時追加をtestへ固定し、standaloneの参照破壊、孤立milestone、capacity縮小はcandidate diagnosticで拒否する。操作系の同日完了標本は累計7p/1 active dayとなり、Velocityを`7p/1d`へ再calibrationした。残るprecedence makespanは15p（`15/7d`）、resource makespanは16p（`16/7d`）、resource delayは1pである。Macroは6 decimal dayへのdeterministic roundを使い、makespanは`13.428572d`となる。Macro CPは`FORMATTER_CORE`、詳細planでは`FORMAT_APPLICATION`がprecedence critical、`MUTATION_CLI_PREVIEW`がschedule criticalで、両方とも`runnable_now`である。

Developer capacity 2を使い、`FORMAT_APPLICATION`と`MUTATION_CLI_PREVIEW`を分離worktreeのAgentで並行完了した。Formatterは再検査済みcandidate、UTF-16 TextEdit、digest、diffをpure application resultへ投影した。Mutation CLIはtask/milestone/resource actionとatomic batchをdefault candidateまたは`--diff`、text/JSONで公開し、BOM、stdin分離、error時の候補非公開、warning policy時のJSON candidate保持、document ID、preview summaryを受け入れtestへ固定した。Write optionはusage errorのままである。同日完了標本を累計10p/1 active dayへ更新し、残るprecedence/resource makespanは14p、forecastは1.4d、resource delayは0pとなった。Macro makespanは12.8dで、次はmacro `FORMATTER_CORE`に対応するdetail `FORMAT_CLI_PREVIEW`がprecedence/schedule criticalかつ`runnable_now`である。

続いて`FORMAT_CLI_PREVIEW`を完了した。`dsl format`は既定candidate、`--diff`、`--check`、text/JSON、stdinを公開し、BOMとraw-byte digestを保持する。Candidate生成に成功した場合は`--check`または`--warnings-as-errors`でCLI `ok=false`になってもJSONのcandidate、diff、UTF-16 TextEditを保持し、invalid inputではすべて非公開にする。`--write`、`--out`、`--expect-digest`はusage errorとして拒否し、原本を変更しない。操作系の同日完了標本は累計12p/1 active day、実測Velocityは`12p/1d`となった。残るprecedence/resource makespanは12p、forecastは1d、resource delayは0pである。Macro makespanは12.5dで、macro `WRITE_SAFETY`とdetail `SAFE_WRITE_ADAPTER`がprecedence/schedule criticalかつ`runnable_now`である。

続いて`SAFE_WRITE_ADAPTER`を完了した。Raw-byte document readerをCLIと共有し、in-place replaceはsymlink/非regular file拒否、initial/expected/commit直前digest照合、path identity確認、mode継承、同directory exclusive temporary、file fsync、atomic rename、parent directory fsync、rename後digest/document再検査を行う。新規outputはfsync済みtemporaryからexclusive hard linkで公開し、既存target、symlink、同時writerの上書きを拒否する。CLIのwrite optionは引き続きusage errorで、Stage 2はまだ開始しない。同日完了標本は累計16p/1 active day、実測Velocityは`16p/1d`となった。残るprecedence/resource makespanは8p、forecastは0.5d、resource delayは0pである。Macro makespanは12.125dで、macro `WRITE_SAFETY`とdetail `SAFE_WRITE_ACCEPTANCE`がprecedence/schedule criticalかつ`runnable_now`である。

続いて`SAFE_WRITE_ACCEPTANCE`を完了した。`dsl format`とtask/milestone/resource/batch mutationは既定previewを維持しながら、明示的な`--write`、exclusive `--out`、`--expect-digest`を共通safe-write pathへ接続した。No-op writeはlock検査後にfileを置換せず`written=false`、競合はstable `PTIO-501` reasonとexit 5で返す。一時copyだけを使うCLI/E2Eでrace・symlink・既存target・warning/invalid failure時の原本保持、grammar planのexact round-trip、write後のcheck/analyze/nextを固定した。Gate成立後、`plans/operations.pert`の完了状態はpreview diffを確認してからexpected digest付き`--write`で初めて正本へ反映した。操作系標本は累計18p/1 active day、実測Velocityは`18p/1d`、残るadvanceは6p、forecastは`1/3d`である。Macro `WRITE_SAFETY`はdone、残りmakespanは12dとなり、`MERMAID_PROFILE`がprecedence/schedule criticalかつ`runnable_now`、`ADVANCE`はreadyだが`REVIEWERS`競合で待機する。

続いて`MERMAID_PROFILE`を完了した。[Mermaid Profile仕様](../specs/mermaid-profile.md)でdefault適用後の完全なsemantic record、canonical JSON、metadata/projection SHA-256、stable node/edge mapping、fail-closed import、plain importのloss code、security境界を固定した。[規範例](../examples/mermaid-profile.md)のsource DSL、record count、canonical JSON、両digestをcontract testへ固定し、helpは設計済みprofileと未実装commandを区別する。`plans/mvp.pert`はpreview diffとexpected digestを確認してから`task finish --write`で更新した。残りprecedence/resource makespanは10d、resource delayは0dである。`ADVANCE`と`MERMAID_EXPORT`はともにreadyかつ`runnable_now`だが、precedence/schedule criticalなのは`MERMAID_EXPORT`である。

続いて`MERMAID_EXPORT`を完了した。`exportMermaid`はdefault適用後の全semantic record、canonical decimal/velocity、stable projection、metadata/projection digestを生成し、`dag render --to mermaid`はprofile/plain、precedence/resource annotation、capacity override、text/JSON、`PTCNV-206`、`--strict-loss`、exclusive `--out`を公開した。規範artifactとCoreをbyte一致させ、unit、CLI、E2E、link、packageを検査した後、`plans/mvp.pert`のpreview diffと`sha256:38b2337f81702d6e93e00819c72c6a33d189ad343969a561a033b3ecaa5db626`を確認して`task finish --write`した。残るprecedence makespanは7d、resource makespanは7.333333d、resource delayは0.333333dである。`ADVANCE`とprecedence CP上の`MERMAID_ROUNDTRIP`がreadyだが、priority 20の`ADVANCE`が`REVIEWERS` capacity 1を先に確保するため、`runnable_now`は`ADVANCE`だけである。詳細planでは`ADVANCE_PLANNER`が唯一のready、precedence/schedule critical、`runnable_now`である。Mermaid macroはday見積りでPoint実績ではないため、操作系Velocity標本は`18p/1d`のままとする。

続いて`ADVANCE_PLANNER`を完了した。Pure `planAdvance` Coreはeffective reachedからcanonical keep/remove setを決定し、過去edgeと不要milestoneをsource-preserving `TextEdit`で除去する。未到達joinへ入るdone taskとsatisfied gateは`partial_satisfaction`理由付きで保持し、retained rootを明示`state reached`へ変換する。Candidate再検査、before/afterのeffective reached・task分類・residual analysis input・project completion一致、再実行時empty editをpostconditionとし、部分合流、complete project、BOM/CRLF、invalid inputを専用testへ固定した。CLIとfilesystem writeは後続taskへ分離した。`plans/operations.pert`はpreview diffと`sha256:ed7a1e02bc22cd076a52f11f0d2df69b2b5e92e0b9cc536992fc472f48cc5f93`を確認して`task finish --write`した。操作系の同日完了標本は累計22p/1 active day、実測Velocityは`22p/1d`、残る`ADVANCE_CLI_ACCEPTANCE`は2p、forecastは`1/11d`である。Macro `ADVANCE`は残作業を0.090909dへroll-upし、残るprecedence makespanは7d、resource makespanは7.090909d、resource delayは0.090909dとなった。Detailの唯一のready、precedence/schedule critical、`runnable_now`は`ADVANCE_CLI_ACCEPTANCE`である。

最後に`ADVANCE_CLI_ACCEPTANCE`を完了した。`dag advance`は既定candidate、`--diff`、advance固有JSON、削除task/gate/milestone一覧、frontier/readyの前後比較を公開し、他のediting commandと同じatomic `--write`、exclusive `--out`、`--expect-digest`へ接続した。Partial joinのpreviewからcheck/analyze/next、一時copyへのdigest付きwrite、再実行no-opまでをE2Eへ固定し、全158 test、文書、4自己利用plan、link、package検査を通した。`plans/operations.pert`とmacro `ADVANCE`はpreview diffとinitial digestを確認してから`task finish --write`した。操作系の同日完了標本は全24p/1 active day、実測Velocityは`24p/1d`、残作業とforecastは0である。Macroの残るprecedence/resource makespanはともに7d、resource delayは0dとなり、唯一のreadyかつ`runnable_now`なprecedence/schedule critical work packageは`MERMAID_ROUNDTRIP`である。このgate成立によりStage 3へ移行した。

続いて`MERMAID_ROUNDTRIP`を完了した。`importMermaid`と`dag import --from mermaid`はprofileのcanonical JSON、record順、metadata/projection digest、意味model、projection対応をfail-closedで検査し、canonical DSLを復元する。Plain inputは限定subsetだけをstable generated IDと`PTCNV-201`から`PTCNV-205`のloss report付きで変換し、実行可能directiveとraw HTMLを拒否する。Strict loss、exclusive `--out`、Core/CLI/package parity、PERT/velocity保持、改変拒否をunit/CLI/E2Eへ固定し、全167 test、文書、4自己利用plan、link、package検査を通した。`plans/mvp.pert`はpreview diffと`sha256:8de200ead6689709245d94c1473804cd28dca361397193fab8f8f1ea979acb96`を確認して`task finish --write`した。Macroの残るprecedence/resource makespanはともに2d、resource delayは0dで、唯一のreadyかつ`runnable_now`なprecedence/schedule critical work packageは`RELEASE_E2E`である。Mermaid taskはday見積りのmacro標本なので、Point基準の操作系Velocityは`24p/1d`のままとする。

続いて`RELEASE_E2E`の受け入れ監査を開始したが、[MVP受け入れ条件16](../requirements.md#21-mvp-受け入れ条件)のrecommendation tier、recommended set、structured explanation、higher-priority comparisonが未実装であることを確認した。`dag next` v2のoperational groupをrecommendationへ再解釈せず、`RELEASE_E2E`は未完了のまま保持する。[Recommendation実装plan](../../plans/recommendation.pert)へMIG-01からMIG-07を22pで分解し、operations実測`24p/1d`によるresource forecast `11/12d`をmacroへ`0.916667d`としてroll-upした。Macro残存precedence/resource makespanは`2.916667d`、resource delayは0dで、`RECOMMENDATION_IMPLEMENTATION`が唯一のreadyかつ`runnable_now`なprecedence/schedule critical work package、`RELEASE_E2E`はupcomingとなった。Detailでは`FIXTURE_BASELINE`が唯一のready、precedence/schedule critical、`runnable_now`である。監査根拠と再開条件は[release readiness記録](mvp-release-readiness.md)を正とする。

続いて`FIXTURE_BASELINE`を完了した。REC-001からREC-007を警告なしの最小`.pert`へ、REC-008からREC-011をunit inputへ展開し、将来のcandidate fact・期待判断と現行`Perttool.NextResult.v2`のgroups、tasks、resource rejection、upcoming explanationを分離してgolden化した。Gate距離0とnew satisfied gate count 0が両立しなかったREC-002は、先行ruleのtieを維持する規範距離1対2へ補正した。全170 testでpublic schema/text不変を確認し、`plans/recommendation.pert`はpreview diffと`sha256:920718d3f18cc45bb615488d986b4088dcff925ac20dc891d3ee42d10559c67a`を確認して`task finish --write`した。初回完了標本2p/1 active dayからrecommendation固有Velocityを`2p/1d`へcalibrationし、残るprecedence 17p、resource 20p、resource delay 3p、resource forecast 10dとなった。Macroへ10dをroll-upした結果、残存precedence/resource makespanは12d、次のdetail critical taskは`RANKING_CORE`である。

続いて`RANKING_CORE`を完了した。`src/recommendation/`へactual ready taskだけを対象とするcompletion counterfactual、structural distance、exact Rationalとstable task IDによるcomplete order、driving/near-critical/minimum-float selection horizon、active allocation込みのjoint resource scan、`recommended`/`allowed`/`deferred` tierをpure Coreとして実装した。REC-001からREC-007、全10 ranking rule、parallel/empty set、capacity override、selected/active-only blockerを専用testへ固定し、全175 testで現行Core export、CLI、help、`Perttool.NextResult.v2`が変わらないことを確認した。`plans/recommendation.pert`はpreview diffと`sha256:688cc5aa9091b37576f619c6d9111d05e5d1a4e24f3cf12016e5caa461cc5e87`を確認して`task finish --write`し、write後digestは`sha256:e239c14c804f53e65162e112871483ef1c88ac90a13f9169e1bde44f87ab1ceb`となった。累計6p/1 active dayからVelocityを`6p/1d`へcalibrationし、残るprecedence 13p、resource 16p、resource delay 3p、resource forecast`8/3d`となった。Macroへ6 decimal dayの`2.666667d`をroll-upした結果、残存precedence/resource makespanは`4.666667d`、次のdetail critical taskは`EXPLANATION_CORE`である。

続いて`EXPLANATION_CORE`を完了した。MIG-02 resultからexact typed fact、最大depth 8の制限付きexpression、winner/alternative/decisive ruleを持つminimal comparison、phase順のdecision trace、taxonomy 1.0 reason occurrence、typed parameterからのcanonical English descriptionを構築する非公開pure Coreを実装した。Reference closure、tier/set、expression再評価、version/rule/code/fact registry、description key/parameter/textの破損を`PTREC-301`から`PTREC-303`へ変換し、partial resultを返さない。REC-001からREC-011、selected/active-only blocker、scan時点とfinal setのresource witness、ready 0件、exact Rational、各diagnostic破損を専用testへ固定し、全186 testで現行Core export、CLI、help、`Perttool.NextResult.v2`が変わらないことを確認した。`plans/recommendation.pert`はpreview source digest `sha256:6f29a90d7958dfe8101527afad0d06c111e86fe57a6285e72d4f50a8509f0c5c`を確認して`task finish --write`し、task finish直後のdigestは`sha256:f9ade5949069deec4164d5ee4b6bae5c396df6addd5bec00c5134fa34f8282e7`、Velocity反映後は`sha256:31985c15f5cb32a3340519b093eb6036606502e2026b33d5d8a145c5ca9cf700`となった。累計11p/1 active dayからVelocityを`11p/1d`へcalibrationし、残るprecedence 8p、resource 11p、resource delay 3p、resource forecast 1dとなった。Macroへ1dをroll-upした結果、残存precedence/resource makespanは3d、次のdetail critical taskは`NEXT_V3_PUBLICATION`である。

続いて`NEXT_V3_PUBLICATION`を完了した。`selectNextTasks`へrankingとexplanation graphを接続し、public `NextResultV3`型、`recommendationAnalysisToJson`、`Perttool.NextResult.v3` CLI JSON、4 tier text summary、structured help、consumer migration guide、CHANGELOGをatomicに公開した。Core/CLI complete graph parity、ready 0件のcomplete JSON、text/error golden、byte determinism、raw BOM digest provenance、PTREC時のpartial result抑止とexit 70、v2 operational field維持、package-installed API/CLIを専用testへ固定し、全195 test、文書、5自己利用plan、local link、package検査を通した。`plans/recommendation.pert`はpreview source digest `sha256:31985c15f5cb32a3340519b093eb6036606502e2026b33d5d8a145c5ca9cf700`を確認して`task finish --write`し、task finish直後のdigestは`sha256:eeab2abcf0be0ca25fe8124dbea46c90dff130721f1ba43fcdf211569b924069`、Velocity反映後は`sha256:2271c43a68cc7eb0cd9286335a1020c1a1fb53af3d6a3167b86d8f2e02f3109d`となった。累計15p/1 active dayからVelocityを`15p/1d`へcalibrationし、残るprecedence 4p、resource 7p、resource delay 3p、resource forecast`7/15d`となった。Macroへ`0.466667d`をroll-upし、digestは`sha256:1bc4b4b9d16fe9ab6b96491e6270a8c9c9c3de19af2eddff5fc4d30a044556fd`、残存precedence/resource makespanは`2.466667d`となった。Detailでは`SELF_USE_SHADOW`がrecommended、`OVERRIDE_VALIDATION`がreviewer競合でdeferredである。V3はshadow受け入れ前なのでmanual selectionをauthorityとして維持する。

2026-07-23に利用者がnpm publication preparationの前倒しを明示した。これはhuman overrideとして、`RELEASE_E2E`を開始・完了せずにpackage metadata、publish normalization dry-run、同一tarball publish guard、TOKEN注入手順だけを整備する。`NPM_ACCESS_TOKEN`はmaintainer domainで`NPM_TOKEN`へrenameし、旧名なし、新名あり、`npm whoami`成功を値非表示で確認した。現行`0.1.0-alpha.1`は既存Git tag/GitHub Releaseより後の内容なのでpublishせず、次期候補`0.1.0-alpha.2`へのversion更新、tag、GitHub asset、npm publish、registry installはrelease gate後に残す。Macro/detailのstatusとrecommendation結果は変更せず、次のnormal taskは`SELF_USE_SHADOW`のままとする。

続いて`SELF_USE_SHADOW`を完了した。5 planの`dag next --format=json`を同一snapshotで2回実行し、known `Perttool.NextResult.v3` contract、complete graph、byte determinism、ready subset、recommended setのjoint resource feasibility、v2 operational field互換、`PTREC-*`不在を検査した。受け入れ前detail snapshotでは`SELF_USE_SHADOW`と`OVERRIDE_VALIDATION`の差をprimary comparison、`REVIEWERS` resource witness、canonical descriptionだけから説明でき、[shadow受け入れ記録](recommendation-shadow-review.md)へdigestと判定を固定した。`plans/recommendation.pert`はpreview source digest `sha256:2271c43a68cc7eb0cd9286335a1020c1a1fb53af3d6a3167b86d8f2e02f3109d`を確認してexpected digest付き`task finish --write`を行い、finish直後のdigestは`sha256:2494c60b92f70a8bb66ab35e05e789bac717cd06a2d00e3f2f8f15b1f78cc94d`となった。完了2pを同日の標本へ加えてVelocityを`17p/1d`へcalibrationし、残るprecedence 3p、resource 5p、resource delay 2p、resource forecast`5/17d`となった。Macroへ`0.294118d`をroll-upし、残存precedence/resource makespanは`2.294118d`となった。Detailでは`OVERRIDE_VALIDATION`がrecommended、`AUTHORITY_ADOPTION`がreviewer競合でdeferredである。MIG-07完了まではmanual selectionをauthorityとして維持する。

続いて`OVERRIDE_VALIDATION`を完了した。Pure `validateOverride`、public request/result型、snake_case projection、canonical artifactを実装し、OVR-001からOVR-004およびOVR-006のallowed/deferred replacement、normal-authority selection、stale/eligibility/resource failure、caller-asserted actor、explicit UTC time、evidence canonicalization、capacity override binding、normal trace reference、SHA-256 identityを専用testとpackage-installed APIへ固定した。OVR-005のdiscouraged fixtureはconcrete negative factを導入する将来versionまで予約のままである。Functionはsource resultとrequestだけを読み、task state、file、Git、networkを変更しない。`plans/recommendation.pert`はpreview source digest `sha256:f7b46fca9c5ce53f8cea57c2a12ecd38dcca33c542865fdb72dfac74da573507`を確認してexpected digest付き`task finish --write`を行い、finish直後のdigestは`sha256:2e1a1d0412230d60a805e17ee3f30a1308460142c0d1244d953c6e3ec1f53038`、Velocity反映後は`sha256:bf9622a81219e4dceca2279305ed015da964680c6856d0e081f566224f679ac2`となった。完了3pを同日の標本へ加えてVelocityを`20p/1d`へcalibrationし、残るprecedence/resource 2p、resource delay 0p、resource forecast`1/10d`となった。Macroへ`0.1d`をroll-upし、digestは`sha256:5006bf9b863538ec8404665c9150b8c40a048ddb1a4008591276117424c7cf21`、残存precedence/resource makespanは`2.1d`となった。Detailでは`AUTHORITY_ADOPTION`が唯一のready、recommended、critical taskである。Override apply、audit write、Git operationはMIG-08まで未解禁である。

続いて`AUTHORITY_ADOPTION`を完了した。`AGENTS.md`、Copilot指示、AI開発ガイド、consumer guide、helpへmacroからdetailのnormal selection ruleを同期し、recommended subset、recommended set全件とallowed 1件の追加、allowed replacement、deferred selection、empty recommendationをdry-runへ固定した。Schema、interface、algorithm、taxonomy、explanation、expression、description、locale、completeness、tier、decisive rule/reason/expression、`PTREC-*`の16境界では選択taskなしのsafe stopになる。`plans/recommendation.pert`はpreview source digest `sha256:bf9622a81219e4dceca2279305ed015da964680c6856d0e081f566224f679ac2`からexpected digest付き`task finish --write`を行い、finish直後は`sha256:bfe6fecde02b11cb14d451388c7bf234ee91029fef8e78a7d0a2caed592abdf3`、Velocity反映後は`sha256:b683fdacbbff39c0afd7ee20faf6cc4c05c50ece2ea350e4ce15e4a599f61464`となった。完了2pを同日の標本へ加えてVelocityを`22p/1d`へcalibrationし、detail残作業は0pとなった。Macro `RECOMMENDATION_IMPLEMENTATION`もsource digest `sha256:5006bf9b863538ec8404665c9150b8c40a048ddb1a4008591276117424c7cf21`からexpected digest付きで完了し、finish直後は`sha256:a3056f2c72554b2835acc6b48ec8db3a795c35a635f3af851e4262ab331ae075`、説明更新後は`sha256:741c027228dd13cfdf6bcdb6a4e0c0f6523848aba6f1c4f6e4d1f762433533bf`となった。`RELEASE_E2E`が唯一のready、`runnable_now`、recommended、precedence/schedule critical work packageで、残るmakespanは2dである。Override apply、audit write、Git operationはMIG-08まで未解禁のままである。

Issue #2はrecommendation publication後のprovider別guideとしてhelp surfaceとreviewerを共有するが、現行macroへwork packageを追加していない。Issue #3もMVP外の将来設計のままとする。

### 4.1 Velocity実測calibration

DSL version 1はworking calendar、pause、作業開始時刻を持たないため、commit timestamp間の数時間を暗黙のengineering-dayへ変換しない。自己利用planのVelocityは次の決定的なactive-day方式で測る。

1. 対象planで、taskを`done`にしたcommitと同じlogical changeにacceptance artifactとtest結果があることを確認する
2. 前回calibration後に完了したtaskの宣言Pointを合計する
3. そのcompletion commitが属するAsia/Tokyoの異なる日付数をactive dayとして数える
4. `completed points / active days`をproject-wide team Velocityとする
5. 同日parallel workは二重にdayを数えず、Point合計へ反映する
6. calibration自身が完了させるtaskは循環を避けて次回標本へ送る

2026-07-22から2026-07-23 recalibration:

| Plan | Closed sample | Completed Point | Active day | Velocity | Remaining forecast |
| --- | --- | ---: | ---: | --- | --- |
| `grammar.pert` | `FORMATTER_ROUNDTRIP`、`HELP_FIXTURE_SYNC` | 3p | 1d | `3p/1d` | 0p |
| `control-plane.pert` | `VISION_REQUIREMENTS`から`PROCESS_MIGRATION`までの9 task | 16p | 1d | `16p/1d` | calibration時点で1p = `1/16d` |
| `operations.pert` | formatter/mutation preview、safe write、advance | 24p | 1d | `24p/1d` | 0p |
| `recommendation.pert` | `FIXTURE_BASELINE`、`RANKING_CORE`、`EXPLANATION_CORE`、`NEXT_V3_PUBLICATION`、`SELF_USE_SHADOW`、`OVERRIDE_VALIDATION`、`AUTHORITY_ADOPTION` | 22p | 1d | `22p/1d` | 0p |

これはeffort hourや個人別生産性ではなく、plan単位の観測throughputである。4標本ともactive dayが1日なので暫定値とし、新しいactive dayまたは複数taskの完了が蓄積した時点で再calibrationする。Grammar実装、control-plane設計、操作系実装、recommendation実装はwork typeが異なるため平均せず、将来のdetail planは最も近いwork typeの標本を初期値として明示する。

Grammarは前回calibration後に`FORMATTER_ROUNDTRIP` 2pと`HELP_FIXTURE_SYNC` 1pが同じactive dayで完了したため再calibrationし、Velocityを`3p/1d`へ更新した。残作業は0なのでforecastは0である。Control-planeの`DESIGN_REVIEW` 1pは新規標本がまだ1 taskのため、次回calibrationへ送る。

Operationsはformatter/mutation preview 12p、safe write 6p、advance 6pの同日完了を累計し、実測`24p/1d`へ更新した。まだ1 active dayだけの暫定値であり、次の操作系taskを詳細planへ追加して完了実績が生じた時点で独立再calibrationする。Macroはday単位しか持たないため、未完了work packageでは`p/velocity`を6 decimal dayへroundする。現在のdetail残作業とresource delayは0pである。

Recommendation実装は`FIXTURE_BASELINE` 2p、`RANKING_CORE` 4p、`EXPLANATION_CORE` 5p、`NEXT_V3_PUBLICATION` 4p、`SELF_USE_SHADOW` 2p、`OVERRIDE_VALIDATION` 3p、`AUTHORITY_ADOPTION` 2pを2026-07-23の同じactive dayで完了したため、累計22p/1 active dayの暫定実測`22p/1d`へ更新した。残るresource makespanは0pである。まだ1 active dayだけの標本なので、次の異なるactive dayまたは複数task完了時に再calibrationする。

Stage 1で許可した操作:

- check
- analyze
- next
- CLI JSONによるcheck/analyze/next result
- `dsl format`のpreview、diff、check、JSON result
- task/milestone/resourceとatomic batchのpreview、diff、JSON result
- Mermaid export が read-only で利用可能なら preview

Stage 1で禁止した操作:

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

`plans/mvp.pert`はM1からM6までのstage gateとwork packageだけを持つ。`GRAMMAR_WORK_PACKAGE`は`plans/grammar.pert`、`CONTROL_PLANE_DESIGN_WORK_PACKAGE`は`plans/control-plane.pert`、M1からM4の操作系work packageは`plans/operations.pert`、`RECOMMENDATION_IMPLEMENTATION`は`plans/recommendation.pert`のresource makespanとvelocity forecastをroll-upするが、内部taskの状態を重複管理しない。

- macro milestoneと全体critical path: `mvp.pert`
- 現在のgrammar実装taskとresource待ち: `grammar.pert`
- 現在のAI工程制御設計taskとresource待ち: `control-plane.pert`
- 現在の操作系実装taskとresource待ち: `operations.pert`
- 現在のrecommendation実装taskとresource待ち: `recommendation.pert`
- macroでworkstreamを選んだ後、対応する詳細planで日々のtaskを選ぶ
- 詳細slice完了時にだけ対応するmacro taskをdoneへ更新する
- `M1_ROADMAP_UPDATE`は完了し、formatter preview、mutation preview、safe write、advanceを操作系detail planへ分解した
- formatter/mutation preview、safe write、advance Core/CLIは完了し、Stage 3へ移行した
- `MERMAID_PROFILE`、`MERMAID_EXPORT`、`MERMAID_ROUNDTRIP`、`ADVANCE`は完了した。Release監査でcondition 16の欠落を確認し、`RECOMMENDATION_IMPLEMENTATION`をmacro release gateへ追加した
- 現在のmacro precedence/schedule CPかつ唯一のready、`runnable_now`、recommended taskは`RELEASE_E2E`である。Recommendationと操作系detailに未完了taskはない
- Issue #2はmacro planへ追加するまで着手順を推測しない
- Issue #3はbacklog階層とmulti-plan compositionの将来設計であり、現行macroへwork packageを追加しない

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

V3 publicationだけで現行のmanual task selection ruleを置き換えない。Shadow gateと共有instruction更新が完了するまで[AI開発ガイド](ai-development.md)のmanual selectionを維持する。Safe-write gateは成立したが、override applyはMIG-08の検証とaudit契約を満たすまで解禁しない。操作系とrecommendation実装がresourceまたはfile ownershipで競合する場合は、Stage 3へ進む操作系を含めmacro planで順序を判断する。

## 6. Stage 2: safe-write self-use

2026-07-22に開始条件を満たして移行した。最初の正本writeとして、`SAFE_WRITE_ACCEPTANCE`のpreview diffとinitial digestを確認し、`plans/operations.pert`へexpected digest付き`task finish --write`を適用した。その後にcheck/analyze/nextとself-use goldenを更新した。

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
- `mutation apply --write`
- 上記editing commandの`--out`と、in-place `--write`の`--expect-digest`

運用:

1. 必ず preview を先に取得する
2. diff が対象 task/milestone 以外へ広がっていないことを確認する
3. write 後に check/analyze/next を再実行する
4. `.pert` と対応する仕様・実装を同じ logical commit にまとめる

## 7. Stage 3: advance self-use

2026-07-22に開始条件を満たして移行した。Partial join、complete project、BOM/CRLF、invalid inputをCore testへ、CLI preview/write/repeated no-opをCLI/E2Eへ固定し、`ADVANCE_CLI_ACCEPTANCE`とmacro `ADVANCE`の完了状態をStage 2のsafe `task finish --write`で記録した。以後、正本planでも次の運用を満たす場合に`dag advance --write`を使用できる。

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

MVP macro planはStage 1から全体milestoneの確認に使用する。Grammar planでのread-only運用開始後、Issue #1のcontrol-plane設計planとM1-M4の操作系planをStage 1で追加した。Issue #2とIssue #3は独立backlogとして保持し、まだ詳細planへ展開しない。`M1_ROADMAP_UPDATE`で次の順を確定した。

- formatterとmutation preview
- safe write
- advance
- safe-write後に、Issue #1の設計結果に基づくrecommendation実装
- safe-write後に、Issue #2のread-only AI Agent Guidance Registry
- Mermaid conversion
- perttool全体のMVP release plan
- MVP後に、Issue #3のbacklog階層・multi-plan composition
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
- self-use golden: grammar、control-plane、operations、recommendation、MVP planのcheck/analyze/next projection test
- Point self-use gate: grammar/control-plane/operations/recommendation planの基準unit、実測または明示した初期velocity、precedence/resource forecastをgoldenで分離して検査する
- field fixture gate: `all declaration fields parse from the grammar acceptance fixture`と各`grammar fixture ... reports only ...` testでfield/token境界を固定する
- block text/span gate: common indent、paragraph、tab/末尾space、leading/trailing trivia、UTF-16 marker/content spanをparser testと専用fixtureへ固定する
- formatter Core gate: HSPACE入力、source構造保持、lexical normalization、UTF-16 non-overlap edit、invalid input拒否をformatter testへ固定する
- formatter round-trip gate: 全fieldのgolden一致、idempotence、exact値ベースのAST同値をformatter testへ固定する
- help/fixture sync gate: registry related link、syntax/sample `.pert`参照、invalid fixture diagnosticのhelp topic解決をhelp testへ固定する
- control-plane planning gate: Issue #1の設計17p完了、残り0p、ready taskなし、設計受け入れ記録をgoldenと文書へ固定する
- operations planning gate: M1-M4の24pをfile ownership、acceptance、narrow testへ分解し、critical/resource makespan 21p、初期forecast 7d、runnable frontierをgoldenへ固定する
- task mutation Core gate: add/set/remove/finish、UTF-16局所edit、comment所有、candidate再検査、digest、unified diff、invalid result抑止をmutation testへ固定する
- entity mutation Core gate: milestone/resource add/set/remove、atomic batch、connected milestone、path置換、resource requirement同時追加、非cascade拒否をmutation testへ固定する
- formatter application gate: 再検査済みcandidate、UTF-16 edit、digest、unified diff、invalid/no-op resultをformatter testへ固定する
- mutation CLI preview gate: entity/batch action、text/JSON、stdin分離、BOM、document ID、warning policy、preview-only write拒否をCLI/E2E testへ固定する
- formatter CLI preview gate: default candidate、diff、check、text/JSON、stdin、BOM、document ID、warning policy、preview-only write拒否をCLI/E2E testへ固定する
- safe-write adapter gate: raw-byte digest、symlink/非regular file拒否、expected/stale digest、mode継承、exclusive temporary、fsync、atomic replace、新規output同時writer拒否、再検査、cleanupをwrite-safety testへ固定する
- safe-write CLI gate: formatter、entity/batch mutationの`--write`/`--out`/`--expect-digest`、no-op、競合reason、失敗時原本保持、grammar temporary-copy round-trip、write後再解析をCLI/E2E/self-use testへ固定する
- advance planner gate: canonical keep/remove set、partial joinのdone task/satisfied gate保持、explicit reached frontier、before/after不変条件、idempotence、invalid candidate抑止をadvance testへ固定する
- advance CLI gate: default preview、diff、advance固有JSON、削除entityとfrontier/ready比較、partial join、digest付きwrite、再実行no-opをCLI/E2E/self-use testへ固定する
- operations calibration gate: 完了9 taskの24p/1 active dayから実測Velocity `24p/1d`、残るprecedence/resource forecast 0と0p resource delayをgoldenへ固定する
- Mermaid profile contract gate: 全semantic record、canonical JSON、metadata/projection digest、fail-closed import、stable loss code、security境界、規範artifactを仕様/help/testへ固定する
- release readiness gate: MVP condition 1から16を個別監査し、未実装conditionを既存fieldの再解釈でPassにせず、recommendation detail/macro gateと再開条件へ固定する
- recommendation authority gate: MIG-07完了後はdetail残作業0p、実測Velocity `22p/1d`、macroの唯一のrecommended `RELEASE_E2E`をgoldenへ固定し、known/complete v3だけをnormal selection authorityとして使用する
- CI entrypoint: `npm run check`から`npm run check:self-use`を実行し、5 planを検査する
- write状態: Stage 3のediting/advance commandをpreview-first、diffと削除一覧、expected digest、write後再解析の手順で解禁する
