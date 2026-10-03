#!/usr/bin/env bash
# Repo checks. Run locally and in CI.
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
warn() { echo "warning: $*" >&2; }
error() { echo "error: $*" >&2; fail=1; }

# Plugin and marketplace manifests. CI has no claude CLI yet.
if command -v claude >/dev/null; then
  claude plugin validate ctui --strict || fail=1
  claude plugin validate . --strict || fail=1
else
  warn "claude not installed, skipping plugin validation"
fi

# Type check against vendor/claude-code-types. validate misses unbound tags in
# imported Sidebar plugin views; tsc catches them.
if [ -x node_modules/.bin/tsc ]; then
  node_modules/.bin/tsc -p . || fail=1
else
  error "tsc not installed, run npm ci"
fi

# Registry consistency.
manifest=ctui/.claude-plugin/plugin.json
same() { [ "$2" = "$3" ] || error "$1 differ: [$2] vs [$3]"; }
folders=$(find ctui/plugins -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort | xargs)
imports=$(sed -nE "s|^import [a-z]+ from '\./([a-z]+)'$|\1|p" ctui/plugins/index.ts | sort | xargs)
keys=$(jq -r '.userConfig | keys[] | select(endswith("_enable")) | sub("_enable$"; "")' "$manifest" | sort | xargs)
same "Sidebar plugin folders and ctui/plugins/index.ts imports" "$folders" "$imports"
same "Sidebar plugin folders and <id>_enable keys" "$folders" "$keys"
themes=inherit
if [ -d ctui/themes ]; then
  themes="$themes $(find ctui/themes -maxdepth 1 -name '*.json' -printf '%f\n' | sed 's/\.json$//')"
fi
same "themes/*.json slugs plus inherit and theme options" \
  "$(echo "$themes" | xargs -n1 | sort | xargs)" \
  "$(jq -r '.userConfig.theme.options[]' "$manifest" | sort | xargs)"
same "plugin.json and ctui/package.json versions" \
  "$(jq -r .version "$manifest")" "$(jq -r .version ctui/package.json)"

if command -v typos >/dev/null; then typos || fail=1; else warn "typos not installed, skipping spell check"; fi
if command -v shellcheck >/dev/null; then
  find . -name '*.sh' -not -path './.git/*' -not -path './prototypes/*' -not -path './node_modules/*' -exec shellcheck {} + || fail=1
else
  warn "shellcheck not installed, skipping script lint"
fi

exit "$fail"
