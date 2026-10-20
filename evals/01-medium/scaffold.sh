# Copies the pristine fixture into this run's sandbox working directory.
# `claude plugin eval` runs this with `bash <this file>` from that directory,
# so the fixture itself stays untouched between runs and arms.
set -eu
cp "$(dirname "$0")/../calc.ts" ./calc.ts
