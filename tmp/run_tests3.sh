#!/bin/bash
NODE_EXE="/mnt/c/Program Files/nodejs/node.exe"
PROJ="/mnt/c/Users/何鑫城/Desktop/OpsHub"
TSX="$PROJ/node_modules/tsx/dist/cli.mjs"
"$NODE_EXE" "$TSX" "$PROJ/server/index.ts" &
SERVER_PID=$!
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
  if ss -tlnp 2>/dev/null | grep -q ':3001 '; then
    echo "Port 3001 is listening after $i polls"
    break
  fi
  sleep 0.5
done
echo "=== Server PID: $SERVER_PID ==="
ss -tlnp 2>/dev/null | grep 3001 || echo "Port 3001 NOT listening"
echo ""
for ep in "1|/api/v1/services" "2|/api/v1/admin/dict/device-types" "3|/api/v1/admin/logs" "4|/api/v1/printers" "5|/api/v1/devices" "6|/api/v1/operations" "7|/api/v1/computer-procurement" "8|/api/v1/phone-procurement" "9|/api/v1/admin/stats"; do
  num="${ep%%|*}"
  path="${ep#*|}"
  echo "--- $num. GET $path ---"
  response=$(curl -s -w '\n%{http_code}' --connect-timeout 3 "http://localhost:3001${path}" 2>&1)
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d' | head -c 300)
  echo "HTTP Status: $http_code"
  echo "Response: $body"
  echo ""
done
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
echo "=== Server stopped ==="
