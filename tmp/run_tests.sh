#!/bin/bash
NODE_EXE="/mnt/c/Program Files/nodejs/node.exe"
PROJ="/mnt/c/Users/何鑫城/Desktop/OpsHub"
TSX="$PROJ/node_modules/tsx/dist/cli.mjs"

# Start the server
"$NODE_EXE" "$TSX" "$PROJ/server/index.ts" &
SERVER_PID=$!

# Wait for the server to be ready by polling the port
for i in $(seq 1 30); do
  if ss -tlnp 2>/dev/null | grep -q ":3001 "; then
    echo "Port 3001 is listening after ${i} polls"
    break
  fi
  sleep 0.5
done

echo "=== Server PID: $SERVER_PID ==="
ss -tlnp 2>/dev/null | grep 3001 || echo "Port 3001 NOT listening"
echo ""

# Test all endpoints
endpoints=(
  "GET /api/v1/services"
  "GET /api/v1/admin/dict/device-types"
  "GET /api/v1/admin/logs"
  "GET /api/v1/printers"
  "GET /api/v1/devices"
  "GET /api/v1/operations"
  "GET /api/v1/computer-procurement"
  "GET /api/v1/phone-procurement"
  "GET /api/v1/admin/stats"
)

for ep in "${endpoints[@]}"; do
  path=$(echo "$ep" | awk '{print $2}')
  echo "--- Testing: $ep ---"
  response=$(curl -s -w "\n%{http_code}" --connect-timeout 3 "http://localhost:3001${path}" 2>&1)
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d' | head -c 300)
  echo "HTTP Status: $http_code"
  echo "Response Body: $body"
  echo ""
done

# Kill server
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
echo "=== Server stopped ==="
