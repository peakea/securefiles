# SecureFiles

A secure file upload and download service that uses TOTP authentication and AES encryption.

## Features

- **Secure Upload**: Upload encrypted archives (ZIP with password) anonymously
- **TOTP Authentication**: Each file is protected with a unique Time-based One-Time Password (TOTP)
- **AES Encryption**: All uploaded files are encrypted at rest using AES-256-CBC
- **Captcha Protection**: Colorful captcha system prevents automated abuse
- **Rate Limiting**: Configurable upload/download rate limits
- **Maintenance Mode**: Easy toggle for scheduled maintenance
- **SQLite Database**: Lightweight database with automatic cleanup
- **EJS Templates**: Server-side rendering with Express and EJS

## Requirements

- Node.js (v14 or higher)
- npm

## Installation

1. Clone the repository:
```bash
git clone https://github.com/peakea/securefiles.git
cd securefiles
```

2. Install dependencies:
```bash
npm install
```

**Raspberry Pi Users:** Build dependencies from source on Raspberry Pi:
```bash
sudo apt install build-essential python3 libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
npm install sqlite3 --build-from-source
npm install canvas --build-from-source
```

3. Initialize configuration:
```bash
npm run init
# Or: node cli.js init
```

4. (Optional) Set encryption key environment variable:
```bash
export ENCRYPTION_KEY=$(openssl rand -hex 32)
```

## CLI Commands

SecureFiles now includes a command-line interface:

```bash
# Start the server
npm start
# Or: node cli.js start

# Start with custom port
node cli.js start --port 8080

# Initialize config.json from default
npm run init
# Or: node cli.js init

# Force overwrite existing config
node cli.js init --force

# View current configuration
npm run config
# Or: node cli.js config

# Show help
node cli.js --help
```

## Linux Service Installation

For production environments, you can install SecureFiles as a systemd service for automatic startup:

```bash
# Install service (runs as current user by default)
sudo node cli.js install-service

# Install service with specific user
sudo node cli.js install-service --user www-data

# Manage the service
sudo systemctl start securefiles
sudo systemctl stop securefiles
sudo systemctl restart securefiles
sudo systemctl status securefiles

# View logs
sudo journalctl -u securefiles -f

# Uninstall service
sudo node cli.js uninstall-service
```

**Note:** Service installation requires sudo privileges. The service will automatically start on system boot.

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser to `http://localhost:3000`

3. Upload a file:
   - Select an encrypted archive (ZIP with password)
   - Optionally provide a custom filename
   - Submit the form
   - Save the UUID and TOTP code displayed

4. Download a file:
   - Navigate to the download page using the UUID
   - Enter the current TOTP code (changes every 30 seconds)
   - Download your decrypted file

## Security Features

- Only encrypted archives (ZIP, 7Z, RAR, GZIP, TAR) are accepted
- Files are encrypted at rest using AES-256-CBC
- Each file has a unique TOTP secret stored in the database
- TOTP codes rotate every 30 seconds
- Captcha verification prevents automated uploads
- Rate limiting on uploads and downloads
- Anonymous uploads - no user accounts required
- Maintenance mode for secure updates

## Configuration

SecureFiles uses `config.json` for configuration. Key settings:

- **Server**: Port configuration
- **Security**: Encryption algorithm and key settings
- **Captcha**: Visual captcha appearance and behavior
  - Color mode with 8 pre-selected colors
  - Configurable dimensions, fonts, and effects
- **Maintenance**: Easy toggle for maintenance mode
- **Rate Limits**: Upload and download throttling
- **Paths**: Custom directories for data, uploads, views

See `default-config.json` for all available options.

For detailed documentation:
- [Captcha System](CAPTCHA_SYSTEM.md)
- [Maintenance Mode](MAINTENANCE_MODE.md)
- [Systemd Service Installation](SYSTEMD_SERVICE.md)

## Database Schema

The SQLite database contains two tables:

```sql
CREATE TABLE files (
  uuid TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  totp_secret TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE captchas (
  key TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

## File Structure

```
securefiles/
├── index.js           # Main application server
├── package.json       # Node.js dependencies
├── views/            # EJS templates
│   ├── index.ejs     # Upload page
│   ├── upload-success.ejs  # Success page with UUID and TOTP
│   └── download.ejs  # Download page
├── uploads/          # Encrypted files storage (gitignored)
└── data/            # SQLite database (gitignored)
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `ENCRYPTION_KEY`: 32-byte encryption key for AES (auto-generated if not provided)

