# Systemd Service Installation

SecureFiles can be installed as a systemd service for automatic startup on Linux systems.

## Installation

Install the service with sudo privileges:

```bash
sudo node cli.js install-service
```

Or specify a custom user:

```bash
sudo node cli.js install-service --user www-data
```

### What Happens During Installation

1. Creates a systemd service file at `/etc/systemd/system/securefiles.service`
2. Reloads the systemd daemon to recognize the new service
3. Enables the service to start automatically on boot
4. Does NOT start the service immediately (you control when to start)

## Service Configuration

The generated service file includes:

- **User**: Runs as the specified user (default: current user)
- **Working Directory**: Set to the SecureFiles installation directory
- **Auto-restart**: Service restarts automatically if it crashes
- **Logging**: Output sent to systemd journal
- **Security Hardening**:
  - `NoNewPrivileges=true`: Prevents privilege escalation
  - `PrivateTmp=true`: Isolated temporary directory
  - `ProtectSystem=strict`: Read-only system directories
  - `ProtectHome=read-only`: Read-only home directory
  - `ReadWritePaths`: Write access only to data/, uploads/, and config.json

## Managing the Service

After installation, use standard systemd commands:

```bash
# Start the service
sudo systemctl start securefiles

# Stop the service
sudo systemctl stop securefiles

# Restart the service
sudo systemctl restart securefiles

# Check service status
sudo systemctl status securefiles

# View logs (follow mode)
sudo journalctl -u securefiles -f

# View logs (last 100 lines)
sudo journalctl -u securefiles -n 100

# Check if service is enabled
sudo systemctl is-enabled securefiles
```

## Uninstallation

Remove the service completely:

```bash
sudo node cli.js uninstall-service
```

### What Happens During Uninstallation

1. Stops the service if it's running
2. Disables the service so it won't start on boot
3. Removes the service file from `/etc/systemd/system/`
4. Reloads the systemd daemon

## Custom Service Names

You can install multiple instances with different names:

```bash
# Install with custom name
sudo node cli.js install-service --name securefiles-dev --user devuser

# Uninstall by name
sudo node cli.js uninstall-service --name securefiles-dev
```

## Troubleshooting

### Service Won't Start

Check the logs for errors:
```bash
sudo journalctl -u securefiles -n 50
```

Common issues:
- Missing `config.json` file (run `node cli.js init` first)
- Port already in use (change port in `config.json`)
- Permission issues (ensure user has access to working directory)

### Service Starts but Immediately Fails

Check if the application runs manually:
```bash
cd /home/ashley/git/securefiles
node server.js
```

If it works manually but not as a service, check file permissions and user configuration.

### Viewing Real-time Logs

```bash
# Follow logs in real-time
sudo journalctl -u securefiles -f

# Filter by priority (errors only)
sudo journalctl -u securefiles -p err -f
```

## Requirements

- **Systemd**: Standard on most modern Linux distributions (Ubuntu 16.04+, Fedora, CentOS 7+, Debian 8+)
- **Sudo Access**: Required for installing/uninstalling services
- **Node.js**: Must be installed and accessible to the service user

## Security Considerations

1. **User Permissions**: Run the service as a non-root user when possible
2. **File Access**: The service user needs read/write access to:
   - `data/` directory (SQLite database)
   - `uploads/` directory (encrypted files)
   - `config.json` file
3. **Port Binding**: Ports below 1024 require root or CAP_NET_BIND_SERVICE capability
4. **Network Access**: Ensure firewall allows traffic on the configured port

## Example Workflow

Complete setup from scratch:

```bash
# Clone and install
git clone https://github.com/peakea/securefiles.git
cd securefiles
npm install

# Initialize configuration
node cli.js init

# Edit config.json as needed
nano config.json

# Install as service
sudo node cli.js install-service --user www-data

# Start the service
sudo systemctl start securefiles

# Verify it's running
sudo systemctl status securefiles

# View logs
sudo journalctl -u securefiles -f
```

## Service vs Manual Start

| Method | Auto-start | Logging | Management | Use Case |
|--------|------------|---------|------------|----------|
| Service | ✅ On boot | systemd journal | systemctl commands | Production |
| Manual | ❌ Manual only | Terminal output | Terminal control | Development |

Choose the service installation for production environments where you need reliable, automatic startup and centralized logging.
