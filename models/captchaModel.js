"use strict";
import { run, get } from '../services/databaseService.js';

export const captchaModel = {
    // Create a captcha record
    create: async (key, text, createdAt) => {
        return await run(
            'INSERT INTO captchas (key, text, created_at) VALUES (?, ?, ?)',
            [key, text, createdAt]
        );
    },

    // Find a captcha by key
    findByKey: async (key) => {
        return await get('SELECT * FROM captchas WHERE key = ?', [key]);
    },

    // Delete a captcha after it's been used
    delete: async (key) => {
        return await run('DELETE FROM captchas WHERE key = ?', [key]);
    },

    // Clean up expired captchas based on creation time and expiry duration
    cleanExpired: async (expiryMs) => {
        const cutoffTime = Date.now() - expiryMs;
        const result = await run('DELETE FROM captchas WHERE created_at < ?', [cutoffTime]);
        return result.changes || 0;
    },

    // Get count of captchas (for debugging/monitoring)
    count: async () => {
        const result = await get('SELECT COUNT(*) as count FROM captchas');
        return result.count;
    }
};

export default captchaModel;
