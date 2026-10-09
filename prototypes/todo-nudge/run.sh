#!/usr/bin/env bash
# PROTOTYPE #220: one live run. usage: run.sh <variant> <job> <n>
set -u
V=$1 J=$2 N=$3
ROOT=/home/a1exk/Projects/claude-tui
HERE=$ROOT/prototypes/todo-nudge
OUT=$HERE/runs/$V-$J-$N; rm -rf "$OUT"; mkdir -p "$OUT/work"
cp "$HERE/fixture-calc.py" "$OUT/work/calc.py"
case $J in
  j208) P="Use the Agent tool (general-purpose) to have a subagent read calc.py and report its bugs in one line. Then fix both bugs in calc.py and add a third function sub(a,b). Be brief." ;;
  j6) P="In calc.py: fix the bugs in add and mul, add sub(a,b) and div(a,b) where div raises ValueError on zero, add a docstring to every function, write pytest tests in test_calc.py covering all four, then run the tests and fix any failures." ;;
  jq) P="What does mul in calc.py return for 2 and 3? Answer only." ;;
  j1) P="Fix the bug in add in calc.py." ;;
esac
cd "$OUT/work"
CLAUDE_CODE_ENABLE_TODO_TOOLS=1 R220_V=$V timeout 600 "$ROOT/node_modules/.bin/claude" -p --model claude-opus-5-5 \
  --plugin-dir "$HERE/spike" --permission-mode bypassPermissions \
  --output-format stream-json --verbose "$P" > "$OUT/stream.jsonl" 2> "$OUT/stderr.txt"
jq -r 'select(.type=="assistant" and .parent_tool_use_id==null) | .message.content[]? | select(.type=="tool_use") | .name' "$OUT/stream.jsonl" > "$OUT/tools.txt"
C=$(grep -cx TaskCreate "$OUT/tools.txt"); U=$(grep -cx TaskUpdate "$OUT/tools.txt")
echo "$V $J $N TaskCreate=$C TaskUpdate=$U tools=$(paste -sd, "$OUT/tools.txt")" | tee "$OUT/summary.txt"
