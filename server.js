"use strict";
import express, { urlencoded } from 'express';
import multer, { memoryStorage } from 'multer';
import { existsSync, mkdirSync, readFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';

// Polyfill __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import controllers and services setup
import { fileController, setupFileController } from './controllers/fileController.js';
import { viewController, setupViewController } from './controllers/viewController.js';
import { setupDatabase } from './services/databaseService.js';
import { setupEncryption } from './services/encryptionService.js';
import { setupCaptchaService } from './services/captchaService.js';
import { setupMaintenance, maintenanceMiddleware } from './middleware/maintenanceMiddleware.js';

/**
 * Helper function to read and parse JSON files
 */
const readJson = (file) => {
    try { return JSON.parse(readFileSync(file, 'utf8')); }
    catch { return null; }
};

/**
 * Start the SecureFiles server
 * @param {Object} options - Server options
 * @param {string} options.config - Path to config file
 * @param {number} options.port - Port to override config
 */
export const startServer = async (options = {}) => {
    // Load configuration
    const configPath = options.config ? join(process.cwd(), options.config) : join(__dirname, 'config.json');
    const defaultConfigPath = join(__dirname, 'default-config.json');

    // Ensure config.json exists
    if (!existsSync(configPath)) {
        console.log('⚠️  config.json not found, creating from default...');
        copyFileSync(defaultConfigPath, configPath);
        console.log('✅ Created config.json');
    }

    // Load and validate config
    let config = readJson(configPath);
    if (!config) {
        throw new Error('Invalid JSON in config.json');
    }

    // Override port if provided via CLI
    if (options.port) {
        config.server.port = parseInt(options.port);
    }

    const port = config?.server?.port || 3000;

    // Initialize services and controllers
    console.log('Initializing services...');
    setupDatabase(config);
    setupEncryption(config);
    setupCaptchaService(config); // Includes cleanup task
    setupFileController(config);
    setupViewController(config);
    setupMaintenance(config);

    // Initialize Express app
    const app = express();

    // Build rate limiters from config
    const buildRateLimiter = (defaults, cfg) => rateLimit({ 
        ...defaults, 
        ...Object.fromEntries(Object.entries(cfg || {}).filter(([, v]) => v !== undefined)) 
    });

    // Upload rate limiter
    const uploadLimiter = buildRateLimiter({
        windowMs: config.limits?.uploadWindowMs,
        max: config.limits?.uploadMax,
        message: 'Too many upload requests from this IP, please try again later.'
    });

    // Download rate limiter
    const downloadLimiter = buildRateLimiter({
        windowMs: config.limits?.downloadWindowMs,
        max: config.limits?.downloadMax,
        message: 'Too many download requests from this IP, please try again later.'
    });

    // Set up EJS view engine
    app.set('view engine', 'ejs');
    app.set('views', join(__dirname, config.paths?.viewsDir));

    // Apply middleware
    app.use(urlencoded({ extended: true }));
    app.use(maintenanceMiddleware); // Check maintenance mode on all routes

    // Ensure required directories exist
    const uploadsDir = join(__dirname, config.paths?.uploadsDir || 'uploads');
    if (!existsSync(uploadsDir)) {
        mkdirSync(uploadsDir, { recursive: true });
        console.log('Created uploads directory');
    }

    // Configure multer for file uploads
    const storage = memoryStorage();
    const upload = multer({
        storage: storage,
        limits: { fileSize: config.limits?.maxUploadBytes }
    });

    // Routes
    app.get('/', viewController.showHomePage);
    app.get('/captcha/:key', viewController.serveCaptchaImage);
    app.post('/upload', uploadLimiter, upload.single('file'), fileController.uploadFile);
    app.get('/download-redirect', viewController.downloadRedirect);
    app.get('/download/:uuid', fileController.showDownloadPage);
    app.post('/download/:uuid', downloadLimiter, fileController.downloadFile);
    app.get('/totp-test', viewController.showTotpTestPage);
    app.post('/totp-test', viewController.generateTotpTest);

    // Multer error handler
    app.use(async (err, req, res) => {
        const maxUploadMB = Math.floor(config.limits?.maxUploadBytes / (1024 * 1024));
        
        // Generate new captcha for retry
        const { captchaService } = await import('./services/captchaService.js');
        const { captchaModel } = await import('./models/captchaModel.js');
        const captcha = await captchaService.generate();
        await captchaModel.create(captcha.key, captcha.text, captcha.createdAt);

        if (err instanceof multer.MulterError) {
            // Handle specific multer errors
            const errorMessages = {
                'LIMIT_FILE_SIZE': `File size exceeds the maximum allowed limit of ${maxUploadMB} MB. Please upload a smaller file.`,
                'LIMIT_FILE_COUNT': 'Too many files uploaded. Please upload one file at a time.',
                'LIMIT_UNEXPECTED_FILE': 'Unexpected file field. Please use the correct upload form.'
            };

            return res.status(400).render('index', {
                error: errorMessages[err.code] || `Upload error: ${err.message}`,
                message: null,
                maxUploadMB,
                captchaKey: captcha.key
            });
        }

        // Generic error handler
        return res.status(500).render('index', {
            error: 'An unexpected error occurred. Please try again later.',
            message: null,
            maxUploadMB,
            captchaKey: captcha.key
        });
    });

    // Start server
    return new Promise((resolve) => {
        const server = app.listen(port, () => {
            console.log(`\n🚀 SecureFiles server running on http://localhost:${port}`);
            console.log('   Press Ctrl+C to stop\n');
            resolve(server);
        });
    });
};

// If run directly (not imported), start the server
if (import.meta.url === `file://${process.argv[1]}`) {
    startServer().catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}
