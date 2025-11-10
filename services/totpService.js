"use strict";
import speakeasy from 'speakeasy';

export const totpService = {
    // Generate a new TOTP secret
    generateSecret: () => {
        return speakeasy.generateSecret({
            name: 'SecureFiles',
            length: 20
        });
    },

    // Verify a TOTP code
    verifyToken: (secret, token, window = 2) => {
        return speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: window
        });
    },

    // Generate a TOTP code from a secret
    generateToken: (secret) => {
        return speakeasy.totp({
            secret: secret,
            encoding: 'base32'
        });
    }
};

export default totpService;
