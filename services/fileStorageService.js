"use strict";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join, basename } from 'path';

export const fileStorageService = {
    // Save a file buffer to disk
    saveFile: (uuid, buffer, uploadsDir) => {
        const safeUuid = basename(uuid);
        const filePath = join(uploadsDir, safeUuid);
        writeFileSync(filePath, buffer);
        return filePath;
    },

    // Read a file from disk
    readFile: (uuid, uploadsDir) => {
        const safeUuid = basename(uuid);
        const filePath = join(uploadsDir, safeUuid);
        return readFileSync(filePath);
    },

    // Delete a file from disk
    deleteFile: (uuid, uploadsDir) => {
        const safeUuid = basename(uuid);
        const filePath = join(uploadsDir, safeUuid);
        if (existsSync(filePath)) {
            unlinkSync(filePath);
            return true;
        }
        return false;
    },

    // Check if a file exists
    fileExists: (uuid, uploadsDir) => {
        const safeUuid = basename(uuid);
        const filePath = join(uploadsDir, safeUuid);
        return existsSync(filePath);
    }
};

export default fileStorageService;
