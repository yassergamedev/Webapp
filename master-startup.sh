#!/bin/bash

# Jukebox Master Startup Script
# This script starts the websocket server, API server, and Master.x86_64 in separate terminals

echo "Starting Jukebox Master System..."

# Function to detect and use available terminal
open_terminal() {
    local title="$1"
    local command="$2"
    
    if command -v gnome-terminal >/dev/null 2>&1; then
        gnome-terminal --title="$title" -- bash -c "$command; exec bash"
    elif command -v xterm >/dev/null 2>&1; then
        xterm -title "$title" -e bash -c "$command; exec bash" &
    elif command -v konsole >/dev/null 2>&1; then
        konsole --title "$title" -e bash -c "$command; exec bash" &
    elif command -v xfce4-terminal >/dev/null 2>&1; then
        xfce4-terminal --title="$title" --execute bash -c "$command; exec bash" &
    elif command -v mate-terminal >/dev/null 2>&1; then
        mate-terminal --title="$title" -e bash -c "$command; exec bash" &
    elif command -v lxterminal >/dev/null 2>&1; then
        lxterminal --title="$title" -e bash -c "$command; exec bash" &
    else
        echo "No terminal emulator found. Starting processes in background..."
        eval "$command" &
    fi
}

# Start websocket server in a new terminal
echo "Starting websocket server in new terminal..."
open_terminal "Websocket Server" "cd /home/arcade/Webapp/ && echo 'Arcade123...' | sudo -S node websocket-server.js"

# Wait for websocket server to initialize
echo "Waiting for websocket server to initialize..."
sleep 3

# Start API server in a new terminal
echo "Starting API server in new terminal..."
open_terminal "API Server" "cd /home/arcade/Webapp/ && echo 'Arcade123...' | sudo -S node api-server.js"

# Wait for API server to initialize
echo "Waiting for API server to initialize..."
sleep 3

# Start Master.x86_64 in a new terminal
echo "Starting Master.x86_64 in new terminal..."
open_terminal "Master.x86_64" "cd /home/arcade/Master/ && ./Master.x86_64"

echo "Master system started!"
echo "All processes are running in separate terminals"
echo "You can close this terminal now"