#!/bin/bash

# Move to the directory where THIS script is located
cd "$(dirname "$0")"

# Now 'node server.js' and 'pnpm' will find their files correctly
echo "Starting session storage server..."
node server.js &
SERVER_PID=$!

echo "Starting Vite development server..."
pnpm dev

# Cleanup
kill $SERVER_PID
echo "All servers stopped."
