"use strict";
import { randomUUID } from 'crypto';
import { fileModel } from '../models/fileModel.js';
import { encryptionService } from '../services/encryptionService.js';
import { totpService } from '../services/totpService.js';
import { fileStorageService } from '../services/fileStorageService.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
const configPath = join(__dirname, '../config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const uploadsDir = join(__dirname, '..', config.paths?.uploadsDir || 'uploads');
const maxUploadMB = Math.floor((config.limits?.maxUploadBytes || 0) / (1024 * 1024));

export const fileController = {
    // Create - Upload a file
    uploadFile: async (req, res) => {
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
            const totpSecret = totpService.generateSecret();

            // Encrypt the file
            const encryptedBuffer = encryptionService.encryptFile(req.file.buffer);

            // Save encrypted file to disk
            fileStorageService.saveFile(uuid, encryptedBuffer, uploadsDir);

            // Save file record to database
            await fileModel.create(uuid, fileName, totpSecret.base32);

            // Pass the TOTP secret for the user to save
            res.render('upload-success', { uuid, totpSecret: totpSecret.base32, filename: fileName });
        } catch (error) {
            console.error('Upload error:', error);
            return res.render('index', { 
                error: 'Error processing file upload: ' + error.message, 
                message: null, 
                maxUploadMB 
            });
        }
    },

    // Read - Show download page
    showDownloadPage: (req, res) => {
        try {
            const { uuid } = req.params;
            res.render('download', { uuid, error: null });
        } catch (error) {
            console.error('Download page error:', error);
            return res.render('index', { 
                error: 'Error processing download page', 
                message: null,
                maxUploadMB
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
                return res.render('download', { uuid, error: 'Invalid UUID format' });
            }

            if (!totp) {
                return res.render('download', { uuid, error: 'TOTP code is required' });
            }

            // Get file record from database
            const fileRecord = await fileModel.findByUuid(uuid);

            if (!fileRecord) {
                return res.render('download', { uuid, error: 'File not found' });
            }

            // Verify TOTP
            const verified = totpService.verifyToken(fileRecord.totp_secret, totp, 2);

            if (!verified) {
                return res.render('download', { uuid, error: 'Invalid TOTP code' });
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
                return res.render('download', { uuid, error: msg });
            }

            // Send file
            res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.filename}"`);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.send(decryptedBuffer);
        } catch (error) {
            console.error('Download endpoint error:', error);
            return res.render('download', { 
                uuid: req.params.uuid, 
                error: 'Error processing download request' 
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
