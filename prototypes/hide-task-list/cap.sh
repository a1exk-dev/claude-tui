#!/bin/bash
# usage: cap.sh <label>
tmux capture-pane -p -t r212 > /home/a1exk/Projects/claude-tui/prototypes/hide-task-list/cap/$1.txt; tmux capture-pane -p -e -t r212 > /home/a1exk/Projects/claude-tui/prototypes/hide-task-list/cap/$1.ansi; cat /home/a1exk/Projects/claude-tui/prototypes/hide-task-list/cap/$1.txt
