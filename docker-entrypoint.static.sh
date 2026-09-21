#!/bin/sh
set -eu

# Join addresses are hard-coded in the static site (not env).
exec nginx -g "daemon off;"
