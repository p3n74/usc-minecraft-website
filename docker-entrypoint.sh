#!/bin/sh
set -eu

export STATIC_ROOT="${STATIC_ROOT:-dist}"
exec node server/index.js
