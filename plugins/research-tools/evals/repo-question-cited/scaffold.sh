#!/usr/bin/env bash
# Stage the sample repository for this case in the eval workspace (the current directory).
set -euo pipefail
cp -R "$(dirname "$0")/repo/." .
