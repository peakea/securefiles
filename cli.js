#!/usr/bin/env node
"use strict";
import { Command } from 'commander';
import { copyFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
    .name('securefiles')
    .description('Secure file upload and download service with TOTP authentication')
    .version('1.0.0');

// Start server command
program
    .command('start')
    .description('Start the SecureFiles server')
    .option('-p, --port <port>', 'Server port (overrides config)')
    .option('-c, --config <path>', 'Path to config file', 'config.json')
    .action(async (options) => {
        // Import and start the server
        const { startServer } = await import('./server.js');
        await startServer(options);
    });

// Create default config command
program
    .command('init')
    .description('Create default config.json file')
    .option('-f, --force', 'Overwrite existing config.json')
    .action((options) => {
        const configPath = join(__dirname, 'config.json');
        const defaultConfigPath = join(__dirname, 'default-config.json');

        if (existsSync(configPath) && !options.force) {
            console.log('❌ config.json already exists');
            console.log('   Use --force to overwrite');
            process.exit(1);
        }

        try {
            copyFileSync(defaultConfigPath, configPath);
            console.log('✅ Created config.json from default-config.json');
            console.log('   Edit config.json to customize your settings');
        } catch (error) {
            console.error('❌ Error creating config.json:', error.message);
            process.exit(1);
        }
    });

// Show config command
program
    .command('config')
    .description('Display current configuration')
    .action(async () => {
        const configPath = join(__dirname, 'config.json');
        
        if (!existsSync(configPath)) {
            console.log('❌ config.json not found');
            console.log('   Run: securefiles init');
            process.exit(1);
        }

        try {
            const { readFileSync } = await import('fs');
            const config = JSON.parse(readFileSync(configPath, 'utf8'));
            console.log('Current configuration:');
            console.log(JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('❌ Error reading config:', error.message);
            process.exit(1);
        }
    });

// Install systemd service command
program
    .command('install-service')
    .description('Install SecureFiles as a systemd service (requires sudo)')
    .option('-u, --user <username>', 'User to run the service as', process.env.USER || 'root')
    .option('-n, --name <name>', 'Service name', 'securefiles')
    .action(async (options) => {
        const { writeFileSync } = await import('fs');
        const { execSync } = await import('child_process');
        
        // Check if running as root
        if (process.getuid && process.getuid() !== 0) {
            console.log('❌ This command requires sudo privileges');
            console.log(`   Run: sudo node cli.js install-service --user ${options.user}`);
            process.exit(1);
        }

        const serviceName = options.name;
        const serviceFile = `/etc/systemd/system/${serviceName}.service`;
        const workingDir = __dirname;
        const nodeExec = process.execPath;
        const scriptPath = join(__dirname, 'server.js');
        
        console.log('🔧 Installing systemd service...\n');
        
        // Generate systemd service file content
        const serviceContent = `[Unit]
Description=SecureFiles - Secure file upload and download service
After=network.target

[Service]
Type=simple
User=${options.user}
WorkingDirectory=${workingDir}
ExecStart=${nodeExec} ${scriptPath}
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${serviceName}

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${workingDir}/data ${workingDir}/uploads ${workingDir}/config.json

[Install]
WantedBy=multi-user.target
`;

        try {
            // Write service file
            writeFileSync(serviceFile, serviceContent);
            console.log(`✅ Created systemd service file: ${serviceFile}`);

            // Reload systemd
            execSync('systemctl daemon-reload', { stdio: 'inherit' });
            console.log('✅ Reloaded systemd daemon');

            // Enable service
            execSync(`systemctl enable ${serviceName}`, { stdio: 'inherit' });
            console.log(`✅ Enabled ${serviceName} service`);

            console.log('\n📋 Service installed successfully!');
            console.log('\nUseful commands:');
            console.log(`  Start:   sudo systemctl start ${serviceName}`);
            console.log(`  Stop:    sudo systemctl stop ${serviceName}`);
            console.log(`  Status:  sudo systemctl status ${serviceName}`);
            console.log(`  Logs:    sudo journalctl -u ${serviceName} -f`);
            console.log(`  Restart: sudo systemctl restart ${serviceName}`);
        } catch (error) {
            console.error('❌ Error installing service:', error.message);
            process.exit(1);
        }
    });

// Uninstall systemd service command
program
    .command('uninstall-service')
    .description('Uninstall SecureFiles systemd service (requires sudo)')
    .option('-n, --name <name>', 'Service name', 'securefiles')
    .action(async (options) => {
        const { unlinkSync, existsSync } = await import('fs');
        const { execSync } = await import('child_process');
        
        // Check if running as root
        if (process.getuid && process.getuid() !== 0) {
            console.log('❌ This command requires sudo privileges');
            console.log('   Run: sudo node cli.js uninstall-service');
            process.exit(1);
        }

        const serviceName = options.name;
        const serviceFile = `/etc/systemd/system/${serviceName}.service`;

        console.log('🗑️  Uninstalling systemd service...\n');

        try {
            // Stop service if running
            try {
                execSync(`systemctl stop ${serviceName}`, { stdio: 'inherit' });
                console.log(`✅ Stopped ${serviceName} service`);
            } catch {
                console.log(`   Service not running or already stopped`);
            }

            // Disable service
            try {
                execSync(`systemctl disable ${serviceName}`, { stdio: 'inherit' });
                console.log(`✅ Disabled ${serviceName} service`);
            } catch {
                console.log(`   Service not enabled or already disabled`);
            }

            // Remove service file
            if (existsSync(serviceFile)) {
                unlinkSync(serviceFile);
                console.log(`✅ Removed service file: ${serviceFile}`);
            } else {
                console.log(`   Service file not found: ${serviceFile}`);
            }

            // Reload systemd
            execSync('systemctl daemon-reload', { stdio: 'inherit' });
            console.log('✅ Reloaded systemd daemon');

            console.log('\n✅ Service uninstalled successfully!');
        } catch (error) {
            console.error('❌ Error uninstalling service:', error.message);
            process.exit(1);
        }
    });

program.parse();
