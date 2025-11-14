"use strict";
import { captchaModel } from '../models/captchaModel.js';

let cleanupInterval = null;
let captchaExpiryMs = 300000; // Default 5 minutes

export const startCaptchaCleanup = (config) => {
    try {
        if (cleanupInterval) {
            console.log('Captcha cleanup already running');
            return;
        }

        const intervalMs = config.captcha?.cleanupIntervalMs || 600000; // Default 10 minutes
        captchaExpiryMs = config.captcha?.expiryMs || 300000; // Default 5 minutes

        console.log(`Starting captcha cleanup task (every ${intervalMs / 1000 / 60} minutes, expiry: ${captchaExpiryMs / 1000 / 60} minutes)`);

        // Then run on interval
        cleanupInterval = setInterval(async () => {
            await cleanExpiredCaptchas();
        }, intervalMs);
    } catch (error) {
        console.error('Error starting captcha cleanup task:', error);
    }
};

export const stopCaptchaCleanup = () => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        console.log('Captcha cleanup task stopped');
    }
};

const cleanExpiredCaptchas = async () => {
    try {
        const deleted = await captchaModel.cleanExpired(captchaExpiryMs);
        const remaining = await captchaModel.count();
        console.log(`Captcha cleanup: Removed ${deleted} expired captcha(s), ${remaining} remaining`);
    } catch (error) {
        console.error('Error cleaning expired captchas:', error);
    }
};

export default { startCaptchaCleanup, stopCaptchaCleanup };
