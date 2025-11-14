"use strict";
import { CaptchaGenerator } from 'captcha-canvas';
import { randomBytes } from 'crypto';

// Configuration variables
let captchaConfig = {
    colorMode: false,
    characters: 6,
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

// Setup function to initialize captcha service with config
export const setupCaptchaService = (config) => {
    captchaConfig = {
        colorMode: config.captcha?.colorMode ?? false,
        characters: config.captcha?.characters || 6,
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

export const captchaService = {
    // Generate a new captcha
    generate: async () => {
        const generator = new CaptchaGenerator()
            .setDimension(captchaConfig.width, captchaConfig.height)
            .setDecoy({ opacity: 0.5 });

        // Configure captcha appearance based on color mode
        if (captchaConfig.colorMode) {
            generator.setCaptcha({
                characters: captchaConfig.characters,
                font: captchaConfig.font,
                size: captchaConfig.size,
                colors: captchaConfig.colors,
                skew: captchaConfig.skew,
                rotate: captchaConfig.rotate
            });
        } else {
            generator.setCaptcha({
                characters: captchaConfig.characters,
                size: captchaConfig.size
            });
        }

        // Set trace
        generator.setTrace({
            color: captchaConfig.traceColor,
            size: captchaConfig.traceSize
        });
        
        const buffer = await generator.generate();
        const key = randomBytes(16).toString('hex');
        
        return {
            key,
            text: generator.text,
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
