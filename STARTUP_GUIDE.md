# Jukebox System Startup Guide

This guide will help you set up the Jukebox Slave and Master systems to run automatically on Linux startup.

## Files Created

### Original Scripts
1. `slave-startup.sh` - Starts tracklist monitor and Slave.x86_64
2. `master-startup.sh` - Starts websocket server, API server, and Master.x86_64
3. `jukebox-slave.service` - Systemd service for slave system
4. `jukebox-master.service` - Systemd service for master system

### Simplified Scripts (Recommended)
5. `slave-startup-simple.sh` - Simplified slave startup script
6. `master-startup-simple.sh` - Simplified master startup script
7. `jukebox-slave-simple.service` - Simplified systemd service for slave
8. `jukebox-master-simple.service` - Simplified systemd service for master

## Prerequisites

Make sure you have the following directories and files:
- `/home/arcade/Webapp/` (with tracklist-monitor.js, websocket-server.js, api-server.js)
- `/home/arcade/Slave/Slave.x86_64`
- `/home/arcade/Master/Master.x86_64`

## Installation Steps

### Option 1: Simplified Installation (Recommended)

**Step 1: Make Scripts Executable**
```bash
sudo chmod +x /home/arcade/Webapp/slave-startup-simple.sh
sudo chmod +x /home/arcade/Webapp/master-startup-simple.sh
```

**Step 2: Install Simplified Systemd Services**
```bash
sudo cp jukebox-slave-simple.service /etc/systemd/system/jukebox-slave.service
sudo cp jukebox-master-simple.service /etc/systemd/system/jukebox-master.service
```

**Step 3: Reload Systemd and Enable Services**
```bash
sudo systemctl daemon-reload
sudo systemctl enable jukebox-slave.service
sudo systemctl enable jukebox-master.service
```

**Step 4: Start Services**
```bash
sudo systemctl start jukebox-slave.service
sudo systemctl start jukebox-master.service
```

### Option 2: Original Installation

**Step 1: Make Scripts Executable**
```bash
sudo chmod +x /home/arcade/Webapp/slave-startup.sh
sudo chmod +x /home/arcade/Webapp/master-startup.sh
```

**Step 2: Install Systemd Services**
```bash
sudo cp jukebox-slave.service /etc/systemd/system/
sudo cp jukebox-master.service /etc/systemd/system/
```

**Step 3: Reload Systemd and Enable Services**
```bash
sudo systemctl daemon-reload
sudo systemctl enable jukebox-slave.service
sudo systemctl enable jukebox-master.service
```

**Step 4: Start Services**
```bash
sudo systemctl start jukebox-slave.service
sudo systemctl start jukebox-master.service
```

## Management Commands

### Check Service Status
```bash
# Check slave status
sudo systemctl status jukebox-slave.service

# Check master status
sudo systemctl status jukebox-master.service
```

### View Logs
```bash
# View slave logs
sudo journalctl -u jukebox-slave.service -f

# View master logs
sudo journalctl -u jukebox-master.service -f
```

### Stop Services
```bash
# Stop slave system
sudo systemctl stop jukebox-slave.service

# Stop master system
sudo systemctl stop jukebox-master.service
```

### Restart Services
```bash
# Restart slave system
sudo systemctl restart jukebox-slave.service

# Restart master system
sudo systemctl restart jukebox-master.service
```

### Disable Services (prevent startup)
```bash
# Disable slave from starting on boot
sudo systemctl disable jukebox-slave.service

# Disable master from starting on boot
sudo systemctl disable jukebox-master.service
```

## Manual Script Execution

If you prefer to run the scripts manually instead of using systemd:

### Run Slave Script
```bash
cd /home/arcade/Webapp
./slave-startup.sh
```

### Run Master Script
```bash
cd /home/arcade/Webapp
./master-startup.sh
```

## Troubleshooting

### Common Issues and Solutions

**1. Service fails to start with "control process exited with error code"**

Check the service status:
```bash
sudo systemctl status jukebox-slave.service
```

Check detailed logs:
```bash
sudo journalctl -xeu jukebox-slave.service --no-pager
```

**2. Script Permission Issues**
```bash
sudo chmod +x /home/arcade/Webapp/slave-startup.sh
sudo chmod +x /home/arcade/Webapp/master-startup.sh
```

**3. Path Issues**
Make sure all paths exist:
```bash
ls -la /home/arcade/Webapp/tracklist-monitor.js
ls -la /home/arcade/Slave/Slave.x86_64
ls -la /home/arcade/Master/Master.x86_64
```

**4. Alternative Systemd-Compatible Script**
If the original script doesn't work, try the systemd-compatible version:
```bash
# Copy the systemd-compatible script
sudo cp /home/arcade/Webapp/slave-startup-systemd.sh /home/arcade/Webapp/slave-startup.sh

# Update the service file to use the new script
sudo systemctl daemon-reload
sudo systemctl restart jukebox-slave.service
```

### Check if services are running
```bash
sudo systemctl is-active jukebox-slave.service
sudo systemctl is-active jukebox-master.service
```

### Check if services are enabled
```bash
sudo systemctl is-enabled jukebox-slave.service
sudo systemctl is-enabled jukebox-master.service
```

### View detailed logs
```bash
sudo journalctl -u jukebox-slave.service --no-pager
sudo journalctl -u jukebox-master.service --no-pager
```

### Check process status
```bash
ps aux | grep -E "(tracklist-monitor|websocket-server|api-server|Slave|Master)"
```

### Manual Testing
Test the scripts manually before using systemd:
```bash
# Test slave script
cd /home/arcade/Webapp
./slave-startup.sh

# Test master script
cd /home/arcade/Webapp
./master-startup.sh
```

## Security Notes

- The scripts contain the password "Arcade123..." in plain text
- Consider using sudoers file with NOPASSWD for better security
- Ensure proper file permissions on the scripts and executables

## Alternative: Using sudoers for Passwordless sudo

For better security, you can configure passwordless sudo for specific commands:

1. Edit sudoers file:
```bash
sudo visudo
```

2. Add these lines:
```
arcade ALL=(ALL) NOPASSWD: /usr/bin/node /home/arcade/Webapp/tracklist-monitor.js
arcade ALL=(ALL) NOPASSWD: /usr/bin/node /home/arcade/Webapp/websocket-server.js
arcade ALL=(ALL) NOPASSWD: /usr/bin/node /home/arcade/Webapp/api-server.js
```

3. Update the startup scripts to remove the password and use direct sudo commands.

## System Requirements

- Linux system with systemd
- Node.js installed
- Proper permissions for arcade user
- Network connectivity for websocket and API servers
