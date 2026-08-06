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
  dist/webview/dag.css \
  dist/webview/dag.js \
  icon.png \
  language-configuration.json \
  syntaxes/pert.tmLanguage.json; do
  if ! grep -Fx "$required" "$inventory" >/dev/null; then
    printf 'VSIX shell inventory is missing %s\n' "$required" >&2
    exit 1
  fi
done

if grep -E '(^|/)(node_modules|media)/' "$inventory" >/dev/null; then
  printf 'VSIX inventory contains an unaccepted dependency or source asset path\n' >&2
  exit 1
fi

npm run package:vsix --workspace perttool-vscode-private -- \
  --out "$vsix_path" >/dev/null
mkdir -p "$unpacked"
unzip -q "$vsix_path" -d "$unpacked"

if [[ ! -f "$unpacked/extension/dist/extension.cjs" || \
      ! -f "$unpacked/extension/dist/server/main.cjs" || \
      ! -f "$unpacked/extension/dist/webview/dag.css" || \
      ! -f "$unpacked/extension/dist/webview/dag.js" || \
      ! -f "$unpacked/extension/icon.png" ]]; then
  printf 'packaged VSIX is missing its client, server, icon, or DAG assets\n' >&2
  exit 1
fi

"$node_binary" "$repository_root/scripts/check-lsp-isolated.mjs" \
  "$unpacked/extension/dist/server/main.cjs" \
  "$repository_root/plans/historical-dag.pert"
if [[ "${PERTTOOL_SKIP_VSIX_HOST:-0}" != "1" ]]; then
  if [[ "$(uname -s)" == "Linux" && -z "${DISPLAY:-}" ]]; then
    if ! command -v xvfb-run >/dev/null; then
      printf 'xvfb-run is required for the supported VS Code host gate\n' >&2
      exit 1
    fi
    env -u VSCODE_IPC_HOOK_CLI -u ELECTRON_RUN_AS_NODE \
      -u VSCODE_ESM_ENTRYPOINT xvfb-run -a "$node_binary" \
      "$repository_root/scripts/check-vsix-host.mjs" "$vsix_path"
  else
    env -u VSCODE_IPC_HOOK_CLI -u ELECTRON_RUN_AS_NODE \
      -u VSCODE_ESM_ENTRYPOINT "$node_binary" \
      "$repository_root/scripts/check-vsix-host.mjs" "$vsix_path"
  fi
fi
printf 'isolated VSIX shell, DAG, and supported-host gate passed\n'
