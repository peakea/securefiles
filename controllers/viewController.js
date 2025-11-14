"use strict";
import { totpService } from '../services/totpService.js';
import { captchaService } from '../services/captchaService.js';
import { captchaModel } from '../models/captchaModel.js';
import { createCanvas } from 'canvas';

// Configuration variables
let maxUploadMB = 100;
let captchaExpiryMs = 300000; // Default 5 minutes
let siteTitle = 'SecureFiles';
let siteDescription = 'Upload encrypted archives securely with TOTP authentication';
let captchaDisplayConfig = {
    colorMode: false,
    font: 'Arial',
    size: 60,
    width: 350,
    height: 150,
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
    siteTitle = config.site?.title || 'SecureFiles';
    siteDescription = config.site?.description || 'Upload encrypted archives securely with TOTP authentication';
    captchaDisplayConfig = {
        colorMode: config.captcha?.colorMode ?? false,
        font: config.captcha?.font || 'Arial',
        size: config.captcha?.size || 60,
        width: config.captcha?.width || 350,
        height: config.captcha?.height || 150,
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
                captchaKey: captcha.key,
                captchaExpiryMinutes: Math.floor(captchaExpiryMs / 60000),
                siteTitle,
                siteDescription
            });
        } catch (error) {
            console.error('Error generating captcha:', error);
            res.render('index', { 
                message: null, 
                error: 'Error loading page', 
                maxUploadMB,
                captchaKey: null,
                captchaExpiryMinutes: Math.floor(captchaExpiryMs / 60000),
                siteTitle,
                siteDescription
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
            const canvas = createCanvas(captchaDisplayConfig.width, captchaDisplayConfig.height);
            const ctx = canvas.getContext('2d');
            
            const text = captcha.text;
            
            // Background
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, captchaDisplayConfig.width, captchaDisplayConfig.height);
            
            // Add noise lines
            for (let i = 0; i < 5; i++) {
                ctx.strokeStyle = captchaDisplayConfig.traceColor;
                ctx.lineWidth = captchaDisplayConfig.traceSize;
                ctx.beginPath();
                ctx.moveTo(Math.random() * captchaDisplayConfig.width, Math.random() * captchaDisplayConfig.height);
                ctx.lineTo(Math.random() * captchaDisplayConfig.width, Math.random() * captchaDisplayConfig.height);
                ctx.stroke();
            }
            
            // Draw text
            ctx.font = `${captchaDisplayConfig.size}px ${captchaDisplayConfig.font}`;
            ctx.textBaseline = 'middle';
            
            const charSpacing = captchaDisplayConfig.width / (text.length + 1);
            
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const x = charSpacing * (i + 1);
                const y = captchaDisplayConfig.height / 2;
                
                ctx.save();
                ctx.translate(x, y);
                
                if (captchaDisplayConfig.rotate) {
                    const rotation = (Math.random() - 0.5) * (captchaDisplayConfig.rotate * Math.PI / 180);
                    ctx.rotate(rotation);
                }
                
                if (captchaDisplayConfig.skew) {
                    const skewX = (Math.random() - 0.5) * 0.3;
                    const skewY = (Math.random() - 0.5) * 0.3;
                    ctx.transform(1, skewY, skewX, 1, 0, 0);
                }
                
                // Set color
                if (captchaDisplayConfig.colorMode && captchaDisplayConfig.colors.length > 0) {
                    ctx.fillStyle = captchaDisplayConfig.colors[Math.floor(Math.random() * captchaDisplayConfig.colors.length)];
                } else {
                    ctx.fillStyle = captchaDisplayConfig.colors[0];
                }
                
                ctx.fillText(char, -ctx.measureText(char).width / 2, 0);
                ctx.restore();
            }
            
            // Add noise dots
            for (let i = 0; i < 50; i++) {
                const color = captchaDisplayConfig.colorMode && captchaDisplayConfig.colors.length > 0
                    ? captchaDisplayConfig.colors[Math.floor(Math.random() * captchaDisplayConfig.colors.length)]
                    : captchaDisplayConfig.colors[0];
                ctx.fillStyle = color;
                ctx.fillRect(
                    Math.random() * captchaDisplayConfig.width,
                    Math.random() * captchaDisplayConfig.height,
                    2,
                    2
                );
            }
            
            const buffer = canvas.toBuffer('image/png');
            
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.send(buffer);
        } catch (error) {
            console.error('Error serving captcha:', error);
            res.status(500).send('Error generating captcha image');
        }
    },

    // Download redirect (for the form on home page)
    downloadRedirect: async (req, res) => {
        try {
            const { uuid } = req.query;
            if (!uuid) {
                const captcha = await captchaService.generate();
                await captchaModel.create(captcha.key, captcha.text, captcha.createdAt);
                
                return res.render('index', { 
                    error: 'UUID is required', 
                    message: null,
                    maxUploadMB,
                    captchaKey: captcha.key,
                    captchaExpiryMinutes: Math.floor(captchaExpiryMs / 60000),
                    siteTitle,
                    siteDescription
                });
            }
            res.redirect(`/download/${uuid}`);
        } catch (error) {
            console.error('Download redirect error:', error);
            const captcha = await captchaService.generate();
            await captchaModel.create(captcha.key, captcha.text, captcha.createdAt);
            
            return res.render('index', { 
                error: 'Error processing download redirect', 
                message: null,
                maxUploadMB,
                captchaKey: captcha.key,
                captchaExpiryMinutes: Math.floor(captchaExpiryMs / 60000),
                siteTitle,
                siteDescription
            });
        }
    },

    // Show TOTP test page
    showTotpTestPage: (req, res) => {
        res.render('totp-test', { code: null, error: null, secret: null, siteTitle });
    },

    // Generate TOTP test code
    generateTotpTest: (req, res) => {
        try {
            const { secret } = req.body;

            if (!secret) {
                return res.render('totp-test', {
                    code: null,
                    error: 'Secret is required',
                    secret: null,
                    siteTitle
                });
            }

            // Generate TOTP code from the provided secret
            const token = totpService.generateToken(secret);

            res.render('totp-test', {
                code: token,
                error: null,
                secret: secret,
                siteTitle
            });
        } catch {
            res.render('totp-test', {
                code: null,
                error: 'Invalid secret format. Please ensure it is a valid Base32 encoded string.',
                secret: '',
                siteTitle
            });
        }
    }
};

export default viewController;
