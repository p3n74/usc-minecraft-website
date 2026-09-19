#!/bin/sh
set -eu

JAVA_ADDRESS="${VITE_JAVA_ADDRESS:-mc-direct.citadel-codex.com}"
BEDROCK_ADDRESS="${VITE_BEDROCK_ADDRESS:-bedrock.citadel-codex.com}"

escape_js() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

JAVA_ESC="$(escape_js "$JAVA_ADDRESS")"
BEDROCK_ESC="$(escape_js "$BEDROCK_ADDRESS")"

cat > /usr/share/nginx/html/config.js <<EOF
window.__USC_CONFIG__ = {
  server: "${JAVA_ESC}",
  java: "${JAVA_ESC}",
  bedrock: "${BEDROCK_ESC}"
};
EOF

exec nginx -g "daemon off;"
