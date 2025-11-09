# SecureFiles

A secure file upload and download service that uses TOTP authentication and AES encryption.

## Features

- **Secure Upload**: Upload encrypted archives (ZIP with password) anonymously
- **TOTP Authentication**: Each file is protected with a unique Time-based One-Time Password (TOTP)
- **AES Encryption**: All uploaded files are encrypted at rest using AES-256-CBC
- **SQLite Database**: Simple single-table database storing UUID, filename, and TOTP secret
- **HTML-Only Frontend**: Pure HTML interface with no JavaScript or CSS
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

3. (Optional) Set encryption key environment variable:
```bash
export ENCRYPTION_KEY=$(openssl rand -hex 32)
```

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

- Only encrypted archives (ZIP files) are accepted
- Files are encrypted at rest using AES-256-CBC
- Each file has a unique TOTP secret stored in the database
- TOTP codes rotate every 30 seconds
- Anonymous uploads - no user accounts required

## Database Schema

The SQLite database contains a single table:

```sql
CREATE TABLE files (
  uuid TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  totp_secret TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

## License

ISC
