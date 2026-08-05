#!/usr/bin/env bash
set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
temporary_root=$(mktemp -d)
vsix_path="$temporary_root/perttool-vscode-private.vsix"
unpacked="$temporary_root/unpacked"
inventory="$temporary_root/inventory.txt"
node_binary=${PERTTOOL_NODE_BINARY:-node}

cleanup() {
  rm -rf "$temporary_root"
}
trap cleanup EXIT

cd "$repository_root"
npm run build --workspace perttool-vscode-private
npm run package:list --workspace perttool-vscode-private >"$inventory"

for required in \
  dist/extension.cjs \
  dist/server/main.cjs \
  language-configuration.json \
  syntaxes/pert.tmLanguage.json; do
  if ! grep -Fx "$required" "$inventory" >/dev/null; then
    printf 'VSIX shell inventory is missing %s\n' "$required" >&2
    exit 1
  fi
done

if grep -E '(^|/)(node_modules|webview|media)/' "$inventory" >/dev/null; then
  printf 'VSIX shell inventory contains an unaccepted dependency or Webview path\n' >&2
  exit 1
fi

npm run package:vsix --workspace perttool-vscode-private -- \
  --out "$vsix_path" >/dev/null
mkdir -p "$unpacked"
unzip -q "$vsix_path" -d "$unpacked"

if [[ ! -f "$unpacked/extension/dist/extension.cjs" || \
      ! -f "$unpacked/extension/dist/server/main.cjs" ]]; then
  printf 'packaged VSIX shell is missing its client or bundled server\n' >&2
  exit 1
fi

"$node_binary" "$repository_root/scripts/check-lsp-isolated.mjs" \
  "$unpacked/extension/dist/server/main.cjs"
printf 'isolated VSIX shell acceptance passed\n'
