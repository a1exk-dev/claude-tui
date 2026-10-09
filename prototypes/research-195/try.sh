#!/bin/bash
# PROTOTYPE #195, throw away. Starts Claude Code in this terminal with the spike
# copy of ctui in place of the installed one: /ctui opens today's pane menu,
# /ctuiband the same menu in the band above the prompt.
# Settings it writes go to pluginConfigs["ctui@inline"], not your ctui's.
# Usage: try.sh [fullscreen 1|0]   (default 1). Log: log-try.txt.
P=$(cd "$(dirname "$0")" && pwd)
rm -rf "$P/run-try"; cp -r "$P/spike" "$P/run-try"
sed -i "s#__LOG__#$P/log-try.txt#" "$P/run-try/hooks/register.tsx"
CLAUDE_CODE_NO_FLICKER=${1:-1} exec claude --plugin-dir "$P/run-try" --settings '{"enabledPlugins":{"ctui@claude-tui":false}}' --model haiku
