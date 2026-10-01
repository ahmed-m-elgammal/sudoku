#!/bin/bash
# T13 browser E2E — real placements through the tutorial's production input path
# (click the empty gridcell, press the digit on the keyboard listener).
set -u
pass=0; fail=0
place() { # row col digit
  local r=$1 c=$2 d=$3
  if agent-browser find role gridcell click --name "Row $r, column $c, empty" >/dev/null 2>&1; then
    if agent-browser press "$d" >/dev/null 2>&1; then pass=$((pass+1)); return 0; fi
  fi
  echo "  FAILED placement ($r,$c)=$d"; fail=$((fail+1)); return 1
}
# col 4 (col idx 3) — claim 1
place 1 4 6; place 4 4 4; place 5 4 1; sleep 1
# col 8 (col idx 7) — claim 2
place 3 8 4; place 4 8 5; place 8 8 1; sleep 1
# box 1 (idx 0) — claim 3
place 2 2 7; place 2 3 2; place 3 1 1; sleep 1
# box 6 (idx 5) — claim 4 (completes with 4,8 already filled)
place 5 9 6; place 6 7 4; sleep 1
# row 1 — claim 5 (buffer)
place 1 5 4; place 1 6 1; place 1 7 7; sleep 1.5
echo "placements: $pass ok, $fail failed"
