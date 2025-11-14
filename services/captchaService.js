"use strict";
import { createCanvas } from 'canvas';
import { randomBytes } from 'crypto';
import { captchaModel } from '../models/captchaModel.js';

// Configuration variables
let captchaConfig = {
    colorMode: false,
    characters: 6,
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

let cleanupInterval = null;
let captchaExpiryMs = 300000; // Default 5 minutes
let cleanupIntervalMs = 600000; // Default 10 minutes

// Setup function to initialize captcha service with config
export const setupCaptchaService = (config) => {
    captchaConfig = {
        colorMode: config.captcha?.colorMode ?? false,
        characters: config.captcha?.characters || 6,
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

    captchaExpiryMs = config.captcha?.expiryMs || 300000;
    cleanupIntervalMs = config.captcha?.cleanupIntervalMs || 600000;

    console.log('Captcha service initialized');
    
    // Start cleanup task
    startCleanup();
};

// Cleanup functions
const startCleanup = () => {
    if (cleanupInterval) {
        console.log('Captcha cleanup already running');
        return;
    }

    console.log(`Captcha cleanup: every ${cleanupIntervalMs / 1000 / 60} minutes, expiry: ${captchaExpiryMs / 1000 / 60} minutes`);

    // Run on interval
    cleanupInterval = setInterval(async () => {
        await cleanExpiredCaptchas();
    }, cleanupIntervalMs);
};

const cleanExpiredCaptchas = async () => {
    try {
        const deleted = await captchaModel.cleanExpired(captchaExpiryMs);
        const remaining = await captchaModel.count();
        console.log(`Captcha cleanup: removed ${deleted} expired, ${remaining} remaining`);
    } catch (error) {
        console.error('Captcha cleanup error:', error);
    }
};

export const stopCaptchaCleanup = () => {
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
        console.log('Captcha cleanup stopped');
    }
};

// Helper function to generate random captcha text
const generateCaptchaText = (length) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes similar looking chars
    let text = '';
    for (let i = 0; i < length; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
};

// Helper function to get random color from config
const getRandomColor = () => {
    if (captchaConfig.colorMode && captchaConfig.colors.length > 0) {
        return captchaConfig.colors[Math.floor(Math.random() * captchaConfig.colors.length)];
    }
    return captchaConfig.colors[0];
};

export const captchaService = {
    // Generate a new captcha
    generate: async () => {
        const canvas = createCanvas(captchaConfig.width, captchaConfig.height);
        const ctx = canvas.getContext('2d');
        
        // Generate captcha text
        const text = generateCaptchaText(captchaConfig.characters);
        
        // Background
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, captchaConfig.width, captchaConfig.height);
        
        // Add noise lines
        for (let i = 0; i < 5; i++) {
            ctx.strokeStyle = captchaConfig.traceColor;
            ctx.lineWidth = captchaConfig.traceSize;
            ctx.beginPath();
            ctx.moveTo(Math.random() * captchaConfig.width, Math.random() * captchaConfig.height);
            ctx.lineTo(Math.random() * captchaConfig.width, Math.random() * captchaConfig.height);
            ctx.stroke();
        }
        
        // Draw text
        ctx.font = `${captchaConfig.size}px ${captchaConfig.font}`;
        ctx.textBaseline = 'middle';
        
        const charSpacing = captchaConfig.width / (captchaConfig.characters + 1);
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const x = charSpacing * (i + 1);
            const y = captchaConfig.height / 2;
            
            ctx.save();
            
            // Apply transformations
            ctx.translate(x, y);
            
            if (captchaConfig.rotate) {
                const rotation = (Math.random() - 0.5) * (captchaConfig.rotate * Math.PI / 180);
                ctx.rotate(rotation);
            }
            
            if (captchaConfig.skew) {
                const skewX = (Math.random() - 0.5) * 0.3;
                const skewY = (Math.random() - 0.5) * 0.3;
                ctx.transform(1, skewY, skewX, 1, 0, 0);
            }
            
            // Set color
            ctx.fillStyle = getRandomColor();
            
            // Draw character centered
            ctx.fillText(char, -ctx.measureText(char).width / 2, 0);
            
            ctx.restore();
        }
        
        // Add noise dots
        for (let i = 0; i < 50; i++) {
            ctx.fillStyle = getRandomColor();
            ctx.fillRect(
                Math.random() * captchaConfig.width,
                Math.random() * captchaConfig.height,
                2,
                2
            );
        }
        
        const buffer = canvas.toBuffer('image/png');
        const key = randomBytes(16).toString('hex');
        
        return {
            key,
            text,
            buffer,
            createdAt: Date.now()
        };
    },

    // Verify a captcha answer
    verify: (userAnswer, storedAnswer) => {
        if (!userAnswer || !storedAnswer) return false;
        return userAnswer.toLowerCase().trim() === storedAnswer.toLowerCase().trim();
    },

    // Check if a captcha is expired based on creation time and expiry duration
    isExpired: (createdAt, expiryMs) => {
        return Date.now() > (createdAt + expiryMs);
    }
};

export default captchaService;
