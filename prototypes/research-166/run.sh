#!/bin/bash
# usage: run.sh <name> <cols> <rows> <fullscreen 1|0>   (tmux session r166-<name> stays up; settings in run-<name>-home)
name=$1; W=$2; H=$3; FS=$4; S=r166-$name
P=$(cd "$(dirname "$0")" && pwd)
rm -rf "$P/run-$name" "$P/log-$name.txt"; cp -r "$P/spike" "$P/run-$name"
sed -i "s#__LOG__#$P/log-$name.txt#" "$P/run-$name/hooks/register.tsx"
tmux kill-session -t "$S" 2>/dev/null
tmux new-session -d -s "$S" -x "$W" -y "$H" -c "$P" "COLORTERM=truecolor CLAUDE_CODE_NO_FLICKER=$FS claude --plugin-dir $P/run-$name --model haiku"
