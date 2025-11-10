"use strict";
import sqlite3 from 'sqlite3';
const { Database } = sqlite3;
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
const configPath = join(__dirname, '../config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

// Ensure data directory exists
const dataDir = join(__dirname, '..', config.paths?.dataDir || 'data');
if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const dbFilePath = join(__dirname, '..', config.paths?.dbFile || 'data/securefiles.sqlite');
const db = new Database(dbFilePath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Database connected');
        db.run(`CREATE TABLE IF NOT EXISTS files (
            uuid TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            totp_secret TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Database helper functions
const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });

const get = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

const all = (sql, params = []) =>
    new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

// File Model - CRUD operations
export const fileModel = {
    // Create a file record
    create: async (uuid, filename, totpSecret) => {
        return await run(
            'INSERT INTO files (uuid, filename, totp_secret) VALUES (?, ?, ?)',
            [uuid, filename, totpSecret]
        );
    },

    // Read a file record by UUID
    findByUuid: async (uuid) => {
        return await get('SELECT * FROM files WHERE uuid = ?', [uuid]);
    },

    // Read all file records
    findAll: async () => {
        return await all('SELECT * FROM files ORDER BY created_at DESC');
    },

    // Update a file record
    update: async (uuid, updates) => {
        const { filename, totp_secret } = updates;
        if (filename && totp_secret) {
            return await run(
                'UPDATE files SET filename = ?, totp_secret = ? WHERE uuid = ?',
                [filename, totp_secret, uuid]
            );
        } else if (filename) {
            return await run(
                'UPDATE files SET filename = ? WHERE uuid = ?',
                [filename, uuid]
            );
        } else if (totp_secret) {
            return await run(
                'UPDATE files SET totp_secret = ? WHERE uuid = ?',
                [totp_secret, uuid]
            );
        }
    },

    // Delete a file record
    delete: async (uuid) => {
        return await run('DELETE FROM files WHERE uuid = ?', [uuid]);
    }
};

export default fileModel;
