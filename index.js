"use strict";
import express, { urlencoded } from 'express';
import multer, { memoryStorage } from 'multer';
import sqlite3 from 'sqlite3';
const { Database } = sqlite3;
import speakeasy from 'speakeasy';
import { randomBytes, createCipheriv, createDecipheriv, randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

// Polyfill __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load default config and ensure config.json exists
const configPath = join(__dirname, 'config.json');
const defaultConfigPath = join(__dirname, 'default-config.json');

const readJson = (file) => {
    try { return JSON.parse(readFileSync(file, 'utf8')); }
    catch { return null; }
};

// Ensure config.json exists and has a persistent encryptionKey
if (!existsSync(configPath)) {
    copyFileSync(defaultConfigPath, configPath);
}

let config = readJson(configPath) || {};
config.security = config.security || {};
if (!config.security.encryptionKey) {
    config.security.encryptionKey = randomBytes(32).toString('base64');
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Generated encryption key and saved to config.json.');
}

// Calculate max upload size in MB for display
const maxUploadMB = Math.floor((config.limits?.maxUploadBytes || 0) / (1024 * 1024));

// Initialize Express app
const app = express();
const port = config?.server?.port;

// Rate limiting configuration
// Rate limiting configuration sourced from config (prefer structured objects, fallback to legacy flat keys)
const buildRateLimiter = (defaults, cfg) => rateLimit({ ...defaults, ...Object.fromEntries(Object.entries(cfg || {}).filter(([, v]) => v !== undefined)) });

// Upload rate limiter
const uploadLimiter = buildRateLimiter(
    {
        windowMs: config.limits?.uploadWindowMs,
        max: config.limits?.uploadMax,
        message: 'Too many upload requests from this IP, please try again later.'
    },
);

// Download rate limiter
const downloadLimiter = buildRateLimiter(
    {
        windowMs: config.limits?.downloadWindowMs,
        max: config.limits?.downloadMax,
        message: 'Too many download requests from this IP, please try again later.'
    }
);

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', join(__dirname, config.paths?.viewsDir));

// Middleware
app.use(urlencoded({ extended: true }));

// Ensure required directories exist
const dataDir = join(__dirname, config.paths?.dataDir || 'data');
const uploadsDir = join(__dirname, config.paths?.uploadsDir || 'uploads');
if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
}
if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
}

// Initialize SQLite database
const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });

const get = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

const all = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

const exec = (sql) =>
    new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

const dbFilePath = join(__dirname, config.paths?.dbFile || 'data/securefiles.sqlite');
const db = new Database(dbFilePath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Database connected');
        db.run(`CREATE TABLE IF NOT EXISTS files (
            uuid TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            totp_secret TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Configure multer for file uploads
const storage = memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: config.limits?.maxUploadBytes }
});

// Encryption configuration
const ALGORITHM = config.security?.algorithm || 'aes-256-cbc';
const IV_LENGTH = config.security?.ivLength || 16;
const ENCRYPTION_KEY = (() => {
    if (process.env.ENCRYPTION_KEY) return Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
    return Buffer.from(config.security.encryptionKey, 'base64');
})();

// Helper function to encrypt file
const encryptFile = (buffer) => {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
}

// Helper function to decrypt file
const decryptFile = (buffer) => {
    const iv = buffer.slice(0, IV_LENGTH);
    const encrypted = buffer.slice(IV_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted;
}

// Routes

// Home page with upload form
app.get('/', (req, res) => {
    res.render('index', { message: null, error: null, maxUploadMB });
});

// File upload endpoint
app.post('/upload', uploadLimiter, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.render('index', { error: 'No file uploaded', message: null, maxUploadMB });
        }

        const fileName = req.body.filename || req.file.originalname;

        // Validate file is an encrypted archive
        const fileType = req.file.mimetype;
        switch (fileType) {
            case 'application/zip':
            case 'application/x-7z-compressed':
            case 'application/x-rar-compressed':
            case 'application/gzip':
            case 'application/x-tar':
            case 'application/x-xz':
            case 'application/x-bzip2':
                break;
            default: {
                console.error('Invalid file type uploaded:', fileType);
                return res.render('index', {
                    error: 'Only archive files (ZIP, 7Z, RAR, GZIP, TAR) are accepted',
                    message: null,
                    maxUploadMB
                });
            }
        }

        // Generate UUID and TOTP secret
        const uuid = randomUUID();
        const totpSecret = speakeasy.generateSecret({
            name: 'SecureFiles',
            length: 20
        });

        // Encrypt the file
        const encryptedBuffer = encryptFile(req.file.buffer);

        // Save encrypted file to disk
        const safeUuid = basename(uuid);
        const filePath = join(__dirname, 'uploads', safeUuid);
        writeFileSync(filePath, encryptedBuffer);

        // Use prepared statements via helper function
        await run('INSERT INTO files (uuid, filename, totp_secret) VALUES (?, ?, ?)',
            [uuid, fileName, totpSecret.base32]);

        // Pass the TOTP secret for the user to save
        res.render('upload-success', { uuid, totpSecret: totpSecret.base32, filename: fileName });
    } catch (error) {
        console.error('Upload error:', error);
        return res.render('index', { error: 'Error processing file upload: ' + error.message, message: null, maxUploadMB });
    }
});

// Download redirect (for the form on home page)
app.get('/download-redirect', (req, res) => {
    try {
        const { uuid } = req.query;
        if (!uuid) {
            return res.render('index', { error: 'UUID is required', message: null });
        }
        res.redirect(`/download/${uuid}`);
    } catch (error) {
        console.error('Download redirect error:', error);
        return res.render('index', { error: 'Error processing download redirect', message: null });
    }
});

// Download page
app.get('/download/:uuid', (req, res) => {
    try {
        const { uuid } = req.params;
        res.render('download', { uuid, error: null });
    } catch (error) {
        console.error('Download page error:', error);
        return res.render('index', { error: 'Error processing download page', message: null });
    }
});

// Download file endpoint
app.post('/download/:uuid', downloadLimiter, async (req, res) => {
    try {
        const { uuid } = req.params;
        const { totp } = req.body;

        // Validate UUID format to prevent path traversal
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(uuid)) {
            return res.render('download', { uuid, error: 'Invalid UUID format' });
        }

        if (!totp) {
            return res.render('download', { uuid, error: 'TOTP code is required' });
        }

        // Use prepared statements via helper function
        const row = await get('SELECT * FROM files WHERE uuid = ?', [uuid]);

        if (!row) {
            return res.render('download', { uuid, error: 'File not found' });
        }

        // Verify TOTP
        const userToken = req.body.totp; // the code user submitted

        const verified = speakeasy.totp.verify({
            secret: row.totp_secret,
            encoding: 'base32',
            token: userToken,
            window: 2
        });

        if (!verified) {
            return res.render('download', { uuid, error: 'Invalid TOTP code' });
        }

        // Read and decrypt file
        const safeUuid = basename(uuid);
        const filePath = join(__dirname, 'uploads', safeUuid);
        const encryptedBuffer = readFileSync(filePath);

        let decryptedBuffer;
        try {
            decryptedBuffer = decryptFile(encryptedBuffer);
        } catch (e) {
            console.error('Decrypt error:', e);
            const msg = e.code === 'ERR_OSSL_BAD_DECRYPT'
                ? 'Unable to decrypt file. The server encryption key may have changed since upload.'
                : 'Error decrypting file.';
            return res.render('download', { uuid, error: msg });
        }

        // Send file
        res.setHeader('Content-Disposition', `attachment; filename="${row.filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(decryptedBuffer);
    } catch (error) {
        console.error('Download endpoint error:', error);
        return res.render('download', { uuid: req.params.uuid, error: 'Error processing download request' });
    }
});

// TOTP test page
app.get('/totp-test', (req, res) => {
    res.render('totp-test', { code: null, error: null, secret: null });
});

// TOTP test generation
app.post('/totp-test', (req, res) => {
    try {
        const { secret } = req.body;

        if (!secret) {
            return res.render('totp-test', {
                code: null,
                error: 'Secret is required',
                secret: null
            });
        }
        // Generate TOTP code from the provided secret
        const token = speakeasy.totp({
            secret: secret,
            encoding: 'base32'
        });

        res.render('totp-test', {
            code: token,
            error: null,
            secret: secret
        });
    } catch (error) {
        res.render('totp-test', {
            code: null,
            error: 'Invalid secret format. Please ensure it is a valid Base32 encoded string.',
            secret: ''
        });
    }
});

// Multer error handler - add this BEFORE app.listen()
app.use((err, req, res, next) => {
    const maxUploadMB = Math.floor(config.limits?.maxUploadBytes / (1024 * 1024));

    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).render('index', {
                error: `File size exceeds the maximum allowed limit of ${maxUploadMB} MB. Please upload a smaller file.`,
                message: null,
                maxUploadMB
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).render('index', {
                error: 'Too many files uploaded. Please upload one file at a time.',
                message: null,
                maxUploadMB
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).render('index', {
                error: 'Unexpected file field. Please use the correct upload form.',
                message: null,
                maxUploadMB
            });
        }
        return res.status(400).render('index', {
            error: `Upload error: ${err.message}`,
            message: null,
            maxUploadMB
        });
    }

    // For other errors show generic message on index page
    return res.status(500).render('index', {
        error: 'An unexpected error occurred. Please try again later.',
        message: null,
        maxUploadMB
    });
});

// Start server
app.listen(port, () => {
    console.log(`SecureFiles server running on port ${port}`);
});
