"use strict";
import sqlite3 from 'sqlite3';
const { Database } = sqlite3;
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

export const setupDatabase = (config) => {
    // Ensure data directory exists
    const dataDir = join(__dirname, '..', config.paths?.dataDir || 'data');
    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
    }

    // Initialize database
    const dbFilePath = join(__dirname, '..', config.paths?.dbFile || 'data/securefiles.sqlite');
    db = new Database(dbFilePath, (err) => {
        if (err) {
            console.error('Error opening database', err);
        } else {
            console.log('Database connected');
            
            // Create files table
            db.run(`CREATE TABLE IF NOT EXISTS files (
                uuid TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                totp_secret TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`, (fileErr) => {
                if (fileErr) {
                    console.error('Database error (files table):', fileErr);
                } else {
                    console.log('Files table initialized');
                }
            });
            
            // Drop old captchas table if it exists (migration)
            db.run(`DROP TABLE IF EXISTS captchas`, (dropErr) => {
                if (dropErr) {
                    console.error('Database error (dropping captchas):', dropErr);
                } else {
                    // Create new captchas table with correct schema
                    db.run(`CREATE TABLE captchas (
                        key TEXT PRIMARY KEY,
                        text TEXT NOT NULL,
                        created_at INTEGER NOT NULL)`, (createErr) => {
                        if (createErr) {
                            console.error('Database error (captchas table):', createErr);
                        } else {
                            console.log('Captchas table initialized');
                        }
                    });
                }
            });
        }
    });

    return db;
};

export const getDatabase = () => {
    if (!db) {
        throw new Error('Database not initialized. Call setupDatabase first.');
    }
    return db;
};

// Database helper functions
export const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
        const db = getDatabase();
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });

export const get = (sql, params = []) =>
    new Promise((resolve, reject) => {
        const db = getDatabase();
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

export const all = (sql, params = []) =>
    new Promise((resolve, reject) => {
        const db = getDatabase();
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

export default { setupDatabase, getDatabase, run, get, all };
