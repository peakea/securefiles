"use strict";
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
const configPath = join(__dirname, '../config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

// Encryption configuration
const ALGORITHM = config.security?.algorithm || 'aes-256-cbc';
const IV_LENGTH = config.security?.ivLength || 16;
const ENCRYPTION_KEY = (() => {
    if (process.env.ENCRYPTION_KEY) return Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
    return Buffer.from(config.security.encryptionKey, 'base64');
})();

export const encryptionService = {
    // Encrypt a file buffer
    encryptFile: (buffer) => {
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
        return Buffer.concat([iv, encrypted]);
    },

    // Decrypt a file buffer
    decryptFile: (buffer) => {
        const iv = buffer.slice(0, IV_LENGTH);
        const encrypted = buffer.slice(IV_LENGTH);
        const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted;
    }
};

export default encryptionService;
