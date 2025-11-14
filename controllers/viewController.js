"use strict";
import { totpService } from '../services/totpService.js';

// Configuration variables
let maxUploadMB = 100;

// Setup function to initialize controller with config
export const setupViewController = (config) => {
    maxUploadMB = Math.floor((config.limits?.maxUploadBytes || 0) / (1024 * 1024));
};

export const viewController = {
    // Show home page
    showHomePage: (req, res) => {
        res.render('index', { message: null, error: null, maxUploadMB });
    },

    // Download redirect (for the form on home page)
    downloadRedirect: (req, res) => {
        try {
            const { uuid } = req.query;
            if (!uuid) {
                return res.render('index', { 
                    error: 'UUID is required', 
                    message: null,
                    maxUploadMB
                });
            }
            res.redirect(`/download/${uuid}`);
        } catch (error) {
            console.error('Download redirect error:', error);
            return res.render('index', { 
                error: 'Error processing download redirect', 
                message: null,
                maxUploadMB
            });
        }
    },

    // Show TOTP test page
    showTotpTestPage: (req, res) => {
        res.render('totp-test', { code: null, error: null, secret: null });
    },

    // Generate TOTP test code
    generateTotpTest: (req, res) => {
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
            const token = totpService.generateToken(secret);

            res.render('totp-test', {
                code: token,
                error: null,
                secret: secret
            });
        } catch {
            res.render('totp-test', {
                code: null,
                error: 'Invalid secret format. Please ensure it is a valid Base32 encoded string.',
                secret: ''
            });
        }
    }
};

export default viewController;
