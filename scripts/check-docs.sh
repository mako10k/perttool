#!/usr/bin/env bash

set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

fail=0

mapfile -t markdown_files < <(
  find . -type f -name '*.md' \
    -not -path './.git/*' \
    -not -path './node_modules/*' \
    -not -path './.worktree/*' \
    -print | sort
)

for markdown_file in "${markdown_files[@]}"; do
  while IFS= read -r link; do
    target=${link%%#*}
    target=${target#<}
    target=${target%>}

    case "$target" in
      '' | http://* | https://* | mailto:* | app://*)
        continue
        ;;
    esac

    resolved=$(dirname "$markdown_file")/$target
    if [[ ! -e "$resolved" ]]; then
      printf 'broken local link: %s -> %s\n' "$markdown_file" "$link" >&2
      fail=1
    fi
  done < <(
    perl -ne 'while (/\[[^]]*\]\(([^)]+)\)/g) { print "$1\n" }' "$markdown_file"
  )

  fence_count=$(grep -c '^```' "$markdown_file" || true)
  if (( fence_count % 2 != 0 )); then
    printf 'unbalanced Markdown fence: %s (%d)\n' "$markdown_file" "$fence_count" >&2
    fail=1
  fi
done

shopt -s nullglob
pert_examples=(docs/examples/*.pert)

for pert_file in "${pert_examples[@]}"; do
  if ! awk '
    /^project [A-Za-z][A-Za-z0-9_-]*:$/ {
      project_count++
    }
    /^resource [A-Za-z][A-Za-z0-9_-]*:$/ {
      id = $2
      sub(/:$/, "", id)
      resources[id] = 1
      current_resource = id
      in_requires = 0
      next
    }
    /^milestone [A-Za-z][A-Za-z0-9_-]*:$/ {
      id = $2
      sub(/:$/, "", id)
      milestones[id] = 1
      current_resource = ""
      in_requires = 0
      next
    }
    /^(task|gate) [A-Za-z][A-Za-z0-9_-]* [A-Za-z][A-Za-z0-9_-]* -> [A-Za-z][A-Za-z0-9_-]*:$/ {
      from = $3
      to = $5
      sub(/:$/, "", to)
      endpoints[++endpoint_count] = from
      endpoints[++endpoint_count] = to
      current_resource = ""
      in_requires = 0
      next
    }
    /^  finish [A-Za-z][A-Za-z0-9_-]*$/ {
      finish = $2
    }
    /^  capacity [0-9]+$/ && current_resource != "" {
      capacities[current_resource] = $2 + 0
    }
    /^  requires:$/ {
      in_requires = 1
      current_resource = ""
      next
    }
    /^    [A-Za-z][A-Za-z0-9_-]* [0-9]+$/ && in_requires {
      requirement_resources[++requirement_count] = $1
      requirement_units[requirement_count] = $2 + 0
      next
    }
    /^  [^ ]/ {
      in_requires = 0
    }
    END {
      if (project_count != 1) {
        print FILENAME ": expected exactly one project" > "/dev/stderr"
        exit 1
      }
      if (!(finish in milestones)) {
        print FILENAME ": undefined finish " finish > "/dev/stderr"
        exit 1
      }
      for (i = 1; i <= endpoint_count; i++) {
        if (!(endpoints[i] in milestones)) {
          print FILENAME ": undefined endpoint " endpoints[i] > "/dev/stderr"
          exit 1
        }
      }
      for (i = 1; i <= requirement_count; i++) {
        resource = requirement_resources[i]
        if (!(resource in resources)) {
          print FILENAME ": undefined resource " resource > "/dev/stderr"
          exit 1
        }
        if (!(resource in capacities) || capacities[resource] < 1) {
          print FILENAME ": invalid capacity " resource > "/dev/stderr"
          exit 1
        }
        if (requirement_units[i] < 1 || requirement_units[i] > capacities[resource]) {
          print FILENAME ": invalid requirement " resource > "/dev/stderr"
          exit 1
        }
      }
    }
  ' "$pert_file"; then
    fail=1
  fi
done

if (( fail != 0 )); then
  exit 1
fi

printf 'repository documentation checks passed (%d Markdown, %d PERT examples)\n' \
  "${#markdown_files[@]}" "${#pert_examples[@]}"
