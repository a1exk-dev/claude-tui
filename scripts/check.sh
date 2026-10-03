#!/usr/bin/env bash
# Repo checks. Run locally and in CI.
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
warn() { echo "warning: $*" >&2; }

# Plugin and marketplace manifests, once they exist. CI has no claude CLI yet.
if [ -d ctui ] || [ -f .claude-plugin/marketplace.json ]; then
  if command -v claude >/dev/null; then
    [ -d ctui ] && { claude plugin validate ctui --strict || fail=1; }
    [ -f .claude-plugin/marketplace.json ] && { claude plugin validate . --strict || fail=1; }
  else
    warn "claude not installed, skipping plugin validation"
  fi
fi

if command -v typos >/dev/null; then typos || fail=1; else warn "typos not installed, skipping spell check"; fi
if command -v shellcheck >/dev/null; then
  find . -name '*.sh' -not -path './.git/*' -not -path './prototypes/*' -exec shellcheck {} + || fail=1
else
  warn "shellcheck not installed, skipping script lint"
fi

exit "$fail"
