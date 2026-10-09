#!/bin/bash
# usage: cap.sh <name> <label>
P=$(cd "$(dirname "$0")" && pwd)
tmux capture-pane -p -e -t "r195-$1" > "$P/capture-$1-$2.ansi"
tmux capture-pane -p -t "r195-$1" > "$P/capture-$1-$2.txt"
cat "$P/capture-$1-$2.txt"
