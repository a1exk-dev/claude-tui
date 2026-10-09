#!/bin/bash
# PROTOTYPE #212. usage: run.sh <mod|none> [cols rows]   tmux session r212, cwd /home/a1exk/.claude/jobs/2925df56/tmp/work
P=/home/a1exk/Projects/claude-tui/prototypes/hide-task-list
tmux kill-session -t r212 2>/dev/null
M=${1:-none}; C=${2:-200}; R=${3:-50}
X=""; [ "$M" != none ] && X="--plugin-dir $P/$M"
tmux new-session -d -s r212 -x $C -y $R -c /home/a1exk/.claude/jobs/2925df56/tmp/work "CLAUDE_CODE_ENABLE_TODO_TOOLS=1 COLORTERM=truecolor /home/a1exk/Projects/claude-tui/node_modules/.bin/claude --plugin-dir /home/a1exk/Projects/claude-tui/ctui $X 2>$P/stderr-$M.txt"
