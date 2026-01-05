#!/bin/bash

# Jukebox Slave Startup Script
# This script starts the tracklist monitor and Slave.x86_64 in separate terminals

echo "Starting Jukebox Slave System..."

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

# Start tracklist monitor in a new terminal
echo "Starting tracklist monitor in new terminal..."
open_terminal "Tracklist Monitor" "cd /home/arcade/Webapp/ && echo 'Arcade123...' | sudo -S node tracklist-monitor.js"

# Wait for tracklist monitor to initialize
echo "Waiting for tracklist monitor to initialize..."
sleep 5

# Start Slave.x86_64 in a new terminal
echo "Starting Slave.x86_64 in new terminal..."
open_terminal "Slave.x86_64" "cd /home/arcade/Slave/ && ./Slave.x86_64"

echo "Slave system started!"
echo "Both processes are running in separate terminals"
echo "You can close this terminal now"