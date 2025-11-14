"use strict";
import { totpService } from '../services/totpService.js';
import { captchaService } from '../services/captchaService.js';
import { captchaModel } from '../models/captchaModel.js';
import { CaptchaGenerator } from 'captcha-canvas';

// Configuration variables
let maxUploadMB = 100;
let captchaExpiryMs = 300000; // Default 5 minutes
let captchaDisplayConfig = {
    colorMode: false,
    font: 'Arial',
    size: 60,
    width: 150,
    height: 450,
    skew: false,
    rotate: 0,
    colors: ['#32cf7e'],
    traceColor: '#32cf7e',
    traceSize: 2
};

// Setup function to initialize controller with config
export const setupViewController = (config) => {
    maxUploadMB = Math.floor((config.limits?.maxUploadBytes || 0) / (1024 * 1024));
    captchaExpiryMs = config.captcha?.expiryMs || 300000;
    captchaDisplayConfig = {
        colorMode: config.captcha?.colorMode ?? false,
        font: config.captcha?.font || 'Arial',
        size: config.captcha?.size || 60,
        width: config.captcha?.width || 150,
        height: config.captcha?.height || 450,
        skew: config.captcha?.skew ?? false,
        rotate: config.captcha?.rotate || 0,
        colors: config.captcha?.colors || ['#32cf7e'],
        traceColor: config.captcha?.traceColor || '#32cf7e',
        traceSize: config.captcha?.traceSize || 2
    };
};

export const viewController = {
    // Show home page
    showHomePage: async (req, res) => {
        try {
            // Generate captcha
            const captcha = await captchaService.generate();
            
            // Store captcha in database
            await captchaModel.create(captcha.key, captcha.text, captcha.createdAt);
            
            // Render page with captcha key
            res.render('index', { 
                message: null, 
                error: null, 
                maxUploadMB,
                captchaKey: captcha.key
            });
        } catch (error) {
            console.error('Error generating captcha:', error);
            res.render('index', { 
                message: null, 
                error: 'Error loading page', 
                maxUploadMB,
                captchaKey: null
            });
        }
    },

    // Serve captcha image
    serveCaptchaImage: async (req, res) => {
        try {
            const { key } = req.params;
            
            // Find captcha in database
            const captcha = await captchaModel.findByKey(key);
            
            if (!captcha) {
                return res.status(404).send('Captcha not found or expired');
            }
            
            // Check if expired based on creation time
            if (captchaService.isExpired(captcha.created_at, captchaExpiryMs)) {
                await captchaModel.delete(key);
                return res.status(404).send('Captcha expired');
            }
            
            // Generate image from stored text using configured appearance
            const generator = new CaptchaGenerator()
                .setDimension(captchaDisplayConfig.width, captchaDisplayConfig.height)
                .setDecoy({ opacity: 0.5 });

            // Configure captcha appearance based on color mode
            if (captchaDisplayConfig.colorMode) {
                generator.setCaptcha({
                    text: captcha.text,
                    font: captchaDisplayConfig.font,
                    size: captchaDisplayConfig.size,
                    colors: captchaDisplayConfig.colors,
                    skew: captchaDisplayConfig.skew,
                    rotate: captchaDisplayConfig.rotate
                });
            } else {
                generator.setCaptcha({
                    text: captcha.text,
                    size: captchaDisplayConfig.size
                });
            }

            generator.setTrace({
                color: captchaDisplayConfig.traceColor,
                size: captchaDisplayConfig.traceSize
            });
            
            const buffer = await generator.generate();
            
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.send(buffer);
        } catch (error) {
            console.error('Error serving captcha:', error);
            res.status(500).send('Error generating captcha image');
        }
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
