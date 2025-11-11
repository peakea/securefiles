"use strict";
import express, { urlencoded } from 'express';
import multer, { memoryStorage } from 'multer';
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { randomBytes } from 'crypto';

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

// Import controllers
import { fileController } from './controllers/fileController.js';
import { viewController } from './controllers/viewController.js';
import fileModel from './models/fileModel.js';

let config = readJson(configPath);
if (!config) {
    throw new Error('Invalid JSON in config.json');
}

fileModel.setupDb(config);

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
const uploadsDir = join(__dirname, config.paths?.uploadsDir || 'uploads');
if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: config.limits?.maxUploadBytes }
});

// Routes

// Home page with upload form
app.get('/', viewController.showHomePage);

// File upload endpoint
app.post('/upload', uploadLimiter, upload.single('file'), fileController.uploadFile);

// Download redirect (for the form on home page)
app.get('/download-redirect', viewController.downloadRedirect);

// Download page
app.get('/download/:uuid', fileController.showDownloadPage);

// Download file endpoint
app.post('/download/:uuid', downloadLimiter, fileController.downloadFile);

// TOTP test page
app.get('/totp-test', viewController.showTotpTestPage);

// TOTP test generation
app.post('/totp-test', viewController.generateTotpTest);

// Multer error handler - add this BEFORE app.listen()
app.use((err, req, res) => {
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
