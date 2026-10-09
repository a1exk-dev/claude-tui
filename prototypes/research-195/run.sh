#!/bin/bash
# PROTOTYPE #195. usage: run.sh <name> <cols> <rows> <fullscreen 1|0>
# Copies spike/ to run-<name>/ and starts it in tmux r195-<name>, with the
# installed ctui turned off for that session. Log: log-<name>.txt.
name=$1; W=$2; H=$3; FS=$4; S=r195-$name
P=$(cd "$(dirname "$0")" && pwd)
rm -rf "$P/run-$name" "$P/log-$name.txt"; cp -r "$P/spike" "$P/run-$name"
sed -i "s#__LOG__#$P/log-$name.txt#" "$P/run-$name/hooks/register.tsx"
tmux kill-session -t "$S" 2>/dev/null
tmux new-session -d -s "$S" -x "$W" -y "$H" -c "$P" "COLORTERM=truecolor CLAUDE_CODE_NO_FLICKER=$FS claude --plugin-dir $P/run-$name --settings '{\"enabledPlugins\":{\"ctui@claude-tui\":false}}' --model haiku"
