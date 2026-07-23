# npm publication手順

- 文書状態: Prepared 1.0
- 作成日: 2026-07-23
- 対象registry: `https://registry.npmjs.org/`
- 配布tag: `alpha`
- Release gate: [MVP release readiness監査](mvp-release-readiness.md)
- Runtime/package判断: [ADR 0002](../adr/0002-node-typescript-package.md)

## 1. 現在の状態

公開準備時点では`perttool`はnpm registryへ未公開だった。2026-07-23に`npm view perttool`が`E404`であること、`NPM_TOKEN`を`secdat`から注入した`npm whoami`がmaintainer accountで成功することを確認した。

公開準備時のcheckoutは`0.1.0-alpha.1`だったが、同名のGit tagとGitHub Releaseより後の変更を含んでいたため、そのversionではpublishしなかった。Recommendation受け入れ後に`RELEASE_E2E`が唯一のreadyかつrecommended work packageとなり、`0.1.0-alpha.2`をrelease versionとして選定した。

2026-07-23の最初の人間overrideはpublish準備だけを前倒しし、当時の工程statusや外部publish authorityを変更しなかった。その後MIG-07まで完了し、利用者は`secdat exec`配下でのGit pushとnpm publishを明示許可した。この許可は同一tarball、release commit/tag、GitHub asset、registry未公開version、process限定TOKENという本書のgateを省略しない。

## 2. 安全境界

- npmへ送るtarballは、package checkとGitHub Release assetに使用したものと同一にする
- prereleaseは必ず`alpha` dist-tagへpublishし、`latest`を変更しない
- `package.json`、CLI `--version`、annotated Git tag、`origin/main`、tarball manifestのversionを一致させる
- package manifestの`bin.perttool`はnpm publish normalization後も`dist/cli.js`でなければならない
- TOKENをargument、tracked `.npmrc`、logへ書かない
- publishは明示的な人間承認後に一度だけ実行する
- responseが不明瞭な場合は`npm view perttool@VERSION`でdurable stateを確認し、確認前にretryしない

## 3. Repository preflight

認証不要のdry-runはcurrent directoryまたは生成済みtarballへ実行できる。

```sh
bash scripts/publish-npm.sh --dry-run
bash scripts/publish-npm.sh --dry-run /absolute/path/to/perttool-VERSION.tgz
```

`npm run check:package`はtarballを作成し、内容、隔離prefixへのinstall、CLI/library smokeに加えて、このpublish normalization dry-runを実行する。npmがmanifestを自動補正した場合は失敗する。

## 4. Release artifact

`RELEASE_E2E`の再開条件を満たした後、release commitでversion、CHANGELOG、READMEを更新する。`npm run check`と`git diff --check`が成功し、cleanなrelease commitを`origin/main`へpushして同じcommitへannotated tagを作成する。

tarballはworktree外の一時directoryへ一度だけ生成する。次の変数名は例であり、system変数を流用しない。

```sh
PERTTOOL_RELEASE_DIR=$(mktemp -d)
npm pack --pack-destination "$PERTTOOL_RELEASE_DIR"
PERTTOOL_RELEASE_TARBALL="$PERTTOOL_RELEASE_DIR/perttool-VERSION.tgz"
sha256sum "$PERTTOOL_RELEASE_TARBALL"
bash scripts/check-package.sh "$PERTTOOL_RELEASE_TARBALL"
```

tarballと`SHA256SUMS`を同じtagのGitHub prereleaseへ添付し、公開assetからの隔離installを確認する。GitHub操作とGit pushはrepository規則どおり`secdat exec gh ...`と`secdat exec git ...`を使う。

## 5. TOKEN注入とpublish

Maintainer domainではsecret名を`NPM_TOKEN`とする。値は表示せず、publish processだけへ注入する。

非対話publishにはnpmのgranular access tokenをread/write、Bypass 2FA付きで用意する。`npm whoami`成功は認証だけの証拠であり、publish権限やBypass 2FAを証明しない。権限と有効期限は[npm access token公式文書](https://docs.npmjs.com/about-access-tokens/)と[2FA publication要件](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/)に従い、release直前に確認する。

認証確認:

```sh
printf '%s\n' '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' |
secdat --dir /home/katsumata-m exec \
  --inject secret:only=NPM_TOKEN \
  --inject route:prefer=secret \
  --inject final:require=NPM_TOKEN \
  -- npm whoami --userconfig=/dev/stdin
```

同一tarballのpublish:

```sh
secdat --dir /home/katsumata-m exec \
  --inject secret:only=NPM_TOKEN \
  --inject route:prefer=secret \
  --inject final:require=NPM_TOKEN \
  -- bash scripts/publish-npm.sh --publish "$PERTTOOL_RELEASE_TARBALL"
```

`--publish`は次をfail-closedで検査する。

1. 明示tarballである
2. worktreeがcleanである
3. tarballとcheckoutのname/versionが一致する
4. local tag、remote annotated tag、`origin/main`がHEADと一致する
5. `NPM_TOKEN`が存在し、`npm whoami`が成功する
6. 同じversionがregistryに存在しない
7. publish後にregistryから同じversionを取得できる

## 6. 公開後検証

`npm view`でversionとdist-tagを確認し、user-ownedの一時prefixへregistryからinstallする。

```sh
npm view perttool@VERSION name version dist
npm view perttool dist-tags
PERTTOOL_VERIFY_PREFIX=$(mktemp -d)
npm install --global --prefix "$PERTTOOL_VERIFY_PREFIX" perttool@VERSION
"$PERTTOOL_VERIFY_PREFIX/bin/perttool" --version
"$PERTTOOL_VERIFY_PREFIX/bin/perttool" dsl check docs/examples/minimal.pert
```

検証結果、registry integrity、GitHub asset SHA-256、release URLをrelease記録へ残してから`RELEASE_E2E`を完了する。
