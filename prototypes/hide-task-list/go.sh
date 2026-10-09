#!/bin/bash
# usage: go.sh <mod|none> : start, send the prompt, capture at 22s and at the end
P=/home/a1exk/Projects/claude-tui/prototypes/hide-task-list
$P/run.sh $1 ${COLS:-200} 50
timeout 60 bash -c 'until tmux capture-pane -p -t r212 | grep -q "shortcuts\|effort"; do sleep 1; done'; sleep 4
tmux send-keys -t r212 -l 'Use TaskCreate to make 3 tasks: Alpha, Beta, Gamma. Then for each in turn: TaskUpdate it to in_progress, run `sleep 4` with Bash, TaskUpdate it to completed. Nothing else.'
sleep 0.5; tmux send-keys -t r212 Enter; sleep 22; $P/cap.sh $1-mid >/dev/null; sleep 20; $P/cap.sh $1-end >/dev/null
