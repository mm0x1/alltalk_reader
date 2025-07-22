#!/bin/bash

# Start the session storage server
echo "Starting session storage server..."
node server.js &
SERVER_PID=$!

# Start the Vite development server
echo "Starting Vite development server..."
pnpm dev

# When the Vite server is stopped, also stop the session server
kill $SERVER_PID
echo "All servers stopped."
