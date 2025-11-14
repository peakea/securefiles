"use strict";
import { randomUUID } from 'crypto';
import { fileModel } from '../models/fileModel.js';
import { captchaModel } from '../models/captchaModel.js';
import { encryptionService } from '../services/encryptionService.js';
import { totpService } from '../services/totpService.js';
import { captchaService } from '../services/captchaService.js';
import { fileStorageService } from '../services/fileStorageService.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration variables
let uploadsDir = 'uploads';
let maxUploadMB = 100;
let captchaExpiryMs = 300000; // Default 5 minutes
let captchaExpiryMinutes = 5; // Default 5 minutes
let siteTitle = 'SecureFiles';
let siteDescription = 'Upload encrypted archives securely with TOTP authentication';

// Setup function to initialize controller with config
export const setupFileController = (config) => {
    uploadsDir = join(__dirname, '..', config.paths?.uploadsDir || 'uploads');
    maxUploadMB = Math.floor((config.limits?.maxUploadBytes || 0) / (1024 * 1024));
    captchaExpiryMs = config.captcha?.expiryMs || 300000;
    captchaExpiryMinutes = Math.floor(captchaExpiryMs / 60000);
    siteTitle = config.site?.title || 'SecureFiles';
    siteDescription = config.site?.description || 'Upload encrypted archives securely with TOTP authentication';
};

export const fileController = {
    // Create - Upload a file
    uploadFile: async (req, res) => {
        try {
            // Verify captcha first
            const { captchaKey, captchaAnswer } = req.body;
            
            if (!captchaKey || !captchaAnswer) {
                // Generate new captcha for retry
                const captcha = await captchaService.generate();
                await captchaModel.create(captcha.key, captcha.text, captcha.createdAt);
                
                return res.render('index', { 
                    error: 'Captcha verification required', 
                    message: null, 
                    maxUploadMB,
                    captchaKey: captcha.key,
                    captchaExpiryMinutes,
                    siteTitle,
                    siteDescription
                });
            }
            
            // Find captcha in database
            const storedCaptcha = await captchaModel.findByKey(captchaKey);
            
            if (!storedCaptcha) {
                // Generate new captcha for retry
                const captcha = await captchaService.generate();
                await captchaModel.create(captcha.key, captcha.text, captcha.createdAt);
                
                return res.render('index', { 
                    error: 'Captcha not found or already used', 
                    message: null, 
                    maxUploadMB,
                    captchaKey: captcha.key,
                    captchaExpiryMinutes,
                    siteTitle,
                    siteDescription
                });
            }
            
            // Check if captcha is expired based on creation time
            if (captchaService.isExpired(storedCaptcha.created_at, captchaExpiryMs)) {
                await captchaModel.delete(captchaKey);
                
                // Generate new captcha for retry
                const captcha = await captchaService.generate();
                await captchaModel.create(captcha.key, captcha.text, captcha.createdAt);
                
                return res.render('index', { 
                    error: 'Captcha expired. Please try again.', 
                    message: null, 
                    maxUploadMB,
                    captchaKey: captcha.key,
                    captchaExpiryMinutes,
                    siteTitle,
                    siteDescription
                });
            }
            
            // Verify captcha answer
            if (!captchaService.verify(captchaAnswer, storedCaptcha.text)) {
                // Delete used captcha
                await captchaModel.delete(captchaKey);
                
                // Generate new captcha for retry
                const captcha = await captchaService.generate();
                await captchaModel.create(captcha.key, captcha.text, captcha.createdAt);
                
                return res.render('index', { 
                    error: 'Incorrect captcha answer. Please try again.', 
                    message: null, 
                    maxUploadMB,
                    captchaKey: captcha.key,
                    captchaExpiryMinutes,
                    siteTitle,
                    siteDescription
                });
            }
            
            // Delete used captcha after successful verification
            await captchaModel.delete(captchaKey);
            
            if (!req.file) {
                // Generate new captcha for retry
                const captcha = await captchaService.generate();
                await captchaModel.create(captcha.key, captcha.text, captcha.createdAt);
                
                return res.render('index', { 
                    error: 'No file uploaded', 
                    message: null, 
                    maxUploadMB,
                    captchaKey: captcha.key,
                    captchaExpiryMinutes,
                    siteTitle,
                    siteDescription
                });
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
                    
                    // Generate new captcha for retry
                    const captcha = await captchaService.generate();
                    await captchaModel.create(captcha.key, captcha.text, captcha.createdAt);
                    
                    return res.render('index', {
                        error: 'Only archive files (ZIP, 7Z, RAR, GZIP, TAR) are accepted',
                        message: null,
                        maxUploadMB,
                        captchaKey: captcha.key,
                        captchaExpiryMinutes,
                    siteTitle,
                    siteDescription
                    });
                }
            }

            // Generate UUID and TOTP secret
            const uuid = randomUUID();
            const totpSecret = totpService.generateSecret();

            // Encrypt the file
            const encryptedBuffer = encryptionService.encryptFile(req.file.buffer);

            // Save encrypted file to disk
            fileStorageService.saveFile(uuid, encryptedBuffer, uploadsDir);

            // Save file record to database
            await fileModel.create(uuid, fileName, totpSecret.base32);

            // Pass the TOTP secret for the user to save
            res.render('upload-success', { uuid, totpSecret: totpSecret.base32, filename: fileName, siteTitle });
        } catch (error) {
            console.error('Upload error:', error);
            
            // Generate new captcha for retry
            const captcha = await captchaService.generate();
            await captchaModel.create(captcha.key, captcha.text, captcha.createdAt);
            
            return res.render('index', { 
                error: 'Error processing file upload: ' + error.message, 
                message: null, 
                maxUploadMB,
                captchaKey: captcha.key,
                captchaExpiryMinutes,
                    siteTitle,
                    siteDescription
            });
        }
    },

    // Read - Show download page
    showDownloadPage: async (req, res) => {
        try {
            const { uuid } = req.params;
            res.render('download', { uuid, error: null, siteTitle });
        } catch (error) {
            console.error('Download page error:', error);
            
            // Generate captcha for error page
            const captcha = await captchaService.generate();
            await captchaModel.create(captcha.key, captcha.text, captcha.createdAt);
            
            return res.render('index', { 
                error: 'Error processing download page', 
                message: null,
                maxUploadMB,
                captchaKey: captcha.key,
                captchaExpiryMinutes,
                    siteTitle,
                    siteDescription
            });
        }
    },

    // Read - Download a file
    downloadFile: async (req, res) => {
        try {
            const { uuid } = req.params;
            const { totp } = req.body;

            // Validate UUID format to prevent path traversal
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(uuid)) {
                return res.render('download', { uuid, error: 'Invalid UUID format', siteTitle });
            }

            if (!totp) {
                return res.render('download', { uuid, error: 'TOTP code is required', siteTitle });
            }

            // Get file record from database
            const fileRecord = await fileModel.findByUuid(uuid);

            if (!fileRecord) {
                return res.render('download', { uuid, error: 'File not found', siteTitle });
            }

            // Verify TOTP
            const verified = totpService.verifyToken(fileRecord.totp_secret, totp, 2);

            if (!verified) {
                return res.render('download', { uuid, error: 'Invalid TOTP code', siteTitle });
            }

            // Read and decrypt file
            const encryptedBuffer = fileStorageService.readFile(uuid, uploadsDir);

            let decryptedBuffer;
            try {
                decryptedBuffer = encryptionService.decryptFile(encryptedBuffer);
            } catch (e) {
                console.error('Decrypt error:', e);
                const msg = e.code === 'ERR_OSSL_BAD_DECRYPT'
                    ? 'Unable to decrypt file. The server encryption key may have changed since upload.'
                    : 'Error decrypting file.';
                return res.render('download', { uuid, error: msg, siteTitle });
            }

            // Send file
            res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.filename}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.send(decryptedBuffer);
        } catch (error) {
            console.error('Download endpoint error:', error);
            return res.render('download', { 
                uuid: req.params.uuid, 
                error: 'Error processing download request',
                siteTitle
            });
        }
    },

    // Update - Not implemented yet (could update filename or regenerate TOTP)
    updateFile: async (req, res) => {
        // Placeholder for future implementation
        res.status(501).json({ error: 'Update operation not implemented' });
    },

    // Delete - Not implemented yet (could delete file and record)
    deleteFile: async (req, res) => {
        // Placeholder for future implementation
        res.status(501).json({ error: 'Delete operation not implemented' });
    }
};

export default fileController;
