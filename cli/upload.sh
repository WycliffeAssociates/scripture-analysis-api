#!/usr/bin/env bash
# Upload a report directory to the Scripture Analysis API.
#
# Usage:
#   ./upload.sh <report-directory>
#
# Required env vars:
#   SCRIPTURE_API_URL   e.g. http://localhost:8787
#   SCRIPTURE_API_KEY   Bearer token

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <report-directory>" >&2
  exit 1
fi

DIR="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

: "${SCRIPTURE_API_URL:?Error: SCRIPTURE_API_URL is not set}"
: "${SCRIPTURE_API_KEY:?Error: SCRIPTURE_API_KEY is not set}"

node "$SCRIPT_DIR/dist/index.js" \
  --url "$SCRIPTURE_API_URL" \
  --key "$SCRIPTURE_API_KEY" \
  upload "$DIR"
