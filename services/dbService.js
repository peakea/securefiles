"use strict";
import sqlite3 from 'sqlite3';
const { Database } = sqlite3;
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

// Database helper functions
const run = (sql, params = []) =>
    new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });

const get = (sql, params = []) =>
    new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

const all = (sql, params = []) =>
    new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

// Initialize database with provided config
const setupDb = (config) => {
    return new Promise((resolve, reject) => {
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
                reject(err);
            } else {
                console.log('Database connected');
                db.run(`CREATE TABLE IF NOT EXISTS files (
                    uuid TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    totp_secret TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) {
                        console.error('Error creating table', err);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            }
        });
    });
};

export const dbService = {
    setupDb,
    run,
    get,
    all
};

export default dbService;
