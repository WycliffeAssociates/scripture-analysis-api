#!/usr/bin/env bash
# Dry-run upload: validate a report directory without sending anything to the API.
# No credentials required.
#
# Usage:
#   ./upload-dry.sh <report-directory>

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <report-directory>" >&2
  exit 1
fi

DIR="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

node "$SCRIPT_DIR/dist/index.js" upload --dry-run "$DIR"
