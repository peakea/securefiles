"use strict";
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

// Encryption configuration variables
let ALGORITHM = 'aes-256-cbc';
let IV_LENGTH = 16;
let ENCRYPTION_KEY = null;

// Setup function to initialize encryption with config
export const setupEncryption = (config) => {
    ALGORITHM = config.security?.algorithm || 'aes-256-cbc';
    IV_LENGTH = config.security?.ivLength || 16;
    
    if (process.env.ENCRYPTION_KEY) {
        ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
    } else if (config.security?.encryptionKey) {
        ENCRYPTION_KEY = Buffer.from(config.security.encryptionKey, 'base64');
    } else {
        throw new Error('Encryption key not configured');
    }
};

export const encryptionService = {
    // Encrypt a file buffer
    encryptFile: (buffer) => {
        if (!ENCRYPTION_KEY) {
            throw new Error('Encryption service not initialized. Call setupEncryption first.');
        }
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
        return Buffer.concat([iv, encrypted]);
    },

    // Decrypt a file buffer
    decryptFile: (buffer) => {
        if (!ENCRYPTION_KEY) {
            throw new Error('Encryption service not initialized. Call setupEncryption first.');
        }
        const iv = buffer.slice(0, IV_LENGTH);
        const encrypted = buffer.slice(IV_LENGTH);
        const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted;
    }
};

export default encryptionService;
