#!/bin/bash

# Jukebox Master Startup Script for Systemd
# This script starts the websocket server, API server, and Master.x86_64 in background for systemd

echo "Starting Jukebox Master System (Systemd Mode)..."

# Set audio environment variables
export XAUTHORITY=/home/arcade/.Xauthority
export PULSE_RUNTIME_PATH=/run/user/1000/pulse

# Helper to run sudo commands with password
SUDO_PASSWORD="Arcade123..."
run_sudo() {
    echo "$SUDO_PASSWORD" | sudo -S "$@"
}

cleanup_triggered=false
cleanup() {
    if [ "$cleanup_triggered" = true ]; then
        return
    fi
    cleanup_triggered=true

    echo "Cleaning up background processes..."

    if [ -n "${WEBSOCKET_PID:-}" ] && kill -0 "$WEBSOCKET_PID" 2>/dev/null; then
        echo "Stopping websocket server (PID: $WEBSOCKET_PID)..."
        run_sudo kill "$WEBSOCKET_PID" 2>/dev/null || true
    fi

    if [ -n "${API_PID:-}" ] && kill -0 "$API_PID" 2>/dev/null; then
        echo "Stopping API server (PID: $API_PID)..."
        run_sudo kill "$API_PID" 2>/dev/null || true
    fi

    if [ -n "${MASTER_PID:-}" ] && kill -0 "$MASTER_PID" 2>/dev/null; then
        echo "Stopping Master.x86_64 (PID: $MASTER_PID)..."
        kill "$MASTER_PID" 2>/dev/null || true
    fi

    # Give processes a moment to exit gracefully
    sleep 2

    # Force kill if still running
    if [ -n "${WEBSOCKET_PID:-}" ] && kill -0 "$WEBSOCKET_PID" 2>/dev/null; then
        run_sudo kill -9 "$WEBSOCKET_PID" 2>/dev/null || true
    fi
    if [ -n "${API_PID:-}" ] && kill -0 "$API_PID" 2>/dev/null; then
        run_sudo kill -9 "$API_PID" 2>/dev/null || true
    fi
    if [ -n "${MASTER_PID:-}" ] && kill -0 "$MASTER_PID" 2>/dev/null; then
        kill -9 "$MASTER_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT

# Wait for network connectivity
echo "Waiting for network connectivity..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if ping -c 1 -W 1 8.8.8.8 > /dev/null 2>&1; then
        echo "✅ Network is ready"
        break
    fi
    attempt=$((attempt + 1))
    echo "   Attempt $attempt/$max_attempts: Network not ready, waiting..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "⚠️  Warning: Network connectivity check timed out, proceeding anyway..."
fi

# Additional wait for DNS to be ready
echo "Waiting for DNS to be ready..."
sleep 3

# Set working directory
cd /home/arcade/Webapp/ || exit 1

# Start websocket server in background
echo "Starting websocket server..."
run_sudo node websocket-server.js > /tmp/websocket-server.log 2>&1 &
WEBSOCKET_PID=$!

# Verify websocket server started
if ! kill -0 $WEBSOCKET_PID 2>/dev/null; then
    echo "ERROR: Failed to start websocket server"
    exit 1
fi

echo "Websocket server started with PID: $WEBSOCKET_PID"

# Wait for websocket server to initialize
echo "Waiting for websocket server to initialize..."
sleep 3

# Start API server in background
echo "Starting API server..."
cd /home/arcade/Webapp/ || exit 1
run_sudo node api-server.js > /tmp/api-server.log 2>&1 &
API_PID=$!

# Verify API server started
if ! kill -0 $API_PID 2>/dev/null; then
    echo "ERROR: Failed to start API server"
    exit 1
fi

echo "API server started with PID: $API_PID"

# Wait for API server to initialize
echo "Waiting for API server to initialize..."
sleep 3

# Start Master.x86_64 in background
echo "Starting Master.x86_64..."
cd /home/arcade/Master/ || exit 1

# Check if file exists and has execute permissions
if [ ! -f "./Master.x86_64" ]; then
    echo "ERROR: Master.x86_64 not found in /home/arcade/Master/"
    exit 1
fi

if [ ! -x "./Master.x86_64" ]; then
    echo "WARNING: Master.x86_64 is not executable, attempting to fix..."
    chmod +x ./Master.x86_64
fi

# Start the executable
./Master.x86_64 > /tmp/master.log 2>&1 &
MASTER_PID=$!

# Wait a moment to see if it actually starts
sleep 1

# Verify Master started and is still running
if ! kill -0 $MASTER_PID 2>/dev/null; then
    echo "ERROR: Failed to start Master.x86_64"
    echo "Checking error log:"
    cat /tmp/master.log 2>/dev/null || echo "No log file found"
    exit 1
fi

# Check if it's still running after a brief moment (catches immediate exits)
sleep 1
if ! kill -0 $MASTER_PID 2>/dev/null; then
    echo "ERROR: Master.x86_64 started but exited immediately"
    echo "Error log:"
    cat /tmp/master.log 2>/dev/null || echo "No log file found"
    exit 1
fi

echo "Master.x86_64 started with PID: $MASTER_PID"

echo "Master system started!"
echo "Websocket Server PID: $WEBSOCKET_PID"
echo "API Server PID: $API_PID"
echo "Master.x86_64 PID: $MASTER_PID"

# Wait for Master.x86_64 to exit; when it does, clean up and exit so systemd restarts us
wait $MASTER_PID
EXIT_CODE=$?
echo "Master.x86_64 exited with code $EXIT_CODE. Cleaning up remaining processes..."

# Cleanup will be triggered by trap, but call explicitly to handle now
cleanup

# Wait for remaining background processes to terminate
wait $WEBSOCKET_PID 2>/dev/null
wait $API_PID 2>/dev/null

exit $EXIT_CODE