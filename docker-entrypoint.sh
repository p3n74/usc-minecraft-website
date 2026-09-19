#!/bin/sh
set -eu

# Runtime config for browser (server address only — never put OAuth secrets here)
export STATIC_ROOT="${STATIC_ROOT:-dist}"
exec node server/index.js
