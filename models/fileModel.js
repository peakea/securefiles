"use strict";
import { dbService } from '../services/dbService.js';

// File Model - CRUD operations
export const fileModel = {
    // Create a file record
    create: async (uuid, filename, totpSecret) => {
        return await dbService.run(
            'INSERT INTO files (uuid, filename, totp_secret) VALUES (?, ?, ?)',
            [uuid, filename, totpSecret]
        );
    },

    // Read a file record by UUID
    findByUuid: async (uuid) => {
        return await dbService.get('SELECT * FROM files WHERE uuid = ?', [uuid]);
    },

    // Read all file records
    findAll: async () => {
        return await dbService.all('SELECT * FROM files ORDER BY created_at DESC');
    },

    // Update a file record
    update: async (uuid, updates) => {
        const { filename, totp_secret } = updates;
        if (filename && totp_secret) {
            return await dbService.run(
                'UPDATE files SET filename = ?, totp_secret = ? WHERE uuid = ?',
                [filename, totp_secret, uuid]
            );
        } else if (filename) {
            return await dbService.run(
                'UPDATE files SET filename = ? WHERE uuid = ?',
                [filename, uuid]
            );
        } else if (totp_secret) {
            return await dbService.run(
                'UPDATE files SET totp_secret = ? WHERE uuid = ?',
                [totp_secret, uuid]
            );
        }
    },

    // Delete a file record
    delete: async (uuid) => {
        return await dbService.run('DELETE FROM files WHERE uuid = ?', [uuid]);
    }
};

export default fileModel;
