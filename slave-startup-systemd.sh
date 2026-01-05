#!/bin/bash

# Jukebox Slave Startup Script for Systemd
# This script starts the tracklist monitor and Slave.x86_64 in background for systemd

echo "Starting Jukebox Slave System (Systemd Mode)..."

# Set display and input environment variables
export XAUTHORITY=/home/arcade/.Xauthority
export PULSE_RUNTIME_PATH=/run/user/1000/pulse

# Start tracklist monitor in background
echo "Starting tracklist monitor..."
cd /home/arcade/Webapp/
echo "Arcade123..." | sudo -S node tracklist-monitor.js &
TRACKLIST_PID=$!

# Wait for tracklist monitor to initialize
echo "Waiting for tracklist monitor to initialize..."
sleep 5

# Start Slave.x86_64 in background
echo "Starting Slave.x86_64..."
cd /home/arcade/Slave/
./Slave.x86_64 &
SLAVE_PID=$!

echo "Slave system started!"
echo "Tracklist Monitor PID: $TRACKLIST_PID"
echo "Slave.x86_64 PID: $SLAVE_PID"

# Wait for both processes (script stays alive)
# If either process exits, the script will exit and systemd will restart it
wait $TRACKLIST_PID $SLAVE_PID