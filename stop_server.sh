#!/usr/bin/env bash
set -euo pipefail

PID_FILE=".server.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "No PID file found. Server may already be stopped."
  exit 0
fi

PID="$(cat "$PID_FILE" 2>/dev/null || true)"
if [[ -z "$PID" ]]; then
  echo "PID file is empty. Cleaning up."
  rm -f "$PID_FILE"
  exit 0
fi

if ! kill -0 "$PID" 2>/dev/null; then
  echo "Process $PID is not running. Cleaning up PID file."
  rm -f "$PID_FILE"
  exit 0
fi

echo "Stopping server (PID $PID) ..."
kill "$PID"

for _ in {1..20}; do
  if kill -0 "$PID" 2>/dev/null; then
    sleep 0.2
  else
    rm -f "$PID_FILE"
    echo "Server stopped."
    exit 0
  fi
done

echo "Server did not stop in time; forcing stop."
kill -9 "$PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "Server stopped."
