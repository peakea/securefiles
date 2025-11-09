const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const speakeasy = require('speakeasy');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { fileTypeFromBuffer } = require('file-type');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting configuration
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 upload requests per windowMs
  message: 'Too many upload requests from this IP, please try again later.'
});

const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 download requests per windowMs
  message: 'Too many download requests from this IP, please try again later.'
});

// Set up EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite database
const db = new sqlite3.Database('./data/securefiles.db', (err) => {
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

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Encryption configuration
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32); // In production, use env variable
const IV_LENGTH = 16;

// Helper function to encrypt file
function encryptFile(buffer) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, encrypted]);
}

// Helper function to decrypt file
function decryptFile(buffer) {
  const iv = buffer.slice(0, IV_LENGTH);
  const encrypted = buffer.slice(IV_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted;
}

// Helper function to check if file is an encrypted archive
async function isEncryptedArchive(buffer) {
  try {
    // Check for ZIP signature first (both encrypted and unencrypted)
    const header = buffer.slice(0, 4);
    // ZIP files start with PK (0x504B0304 or 0x504B0506 or 0x504B0708)
    if (header[0] === 0x50 && header[1] === 0x4B) {
      return true;
    }
    
    // Try to detect file type
    const type = await fileTypeFromBuffer(buffer);
    if (type) {
      // Check for common archive types
      return type.mime === 'application/zip' || 
             type.mime === 'application/x-7z-compressed' ||
             type.mime === 'application/x-rar-compressed' ||
             type.mime === 'application/gzip' ||
             type.mime === 'application/x-tar';
    }
    
    // If we can't detect a type and no ZIP signature, reject
    return false;
  } catch (e) {
    // If detection fails, reject for safety
    return false;
  }
}

// Routes

// Home page with upload form
app.get('/', (req, res) => {
  res.render('index', { message: null, error: null });
});

// File upload endpoint
app.post('/upload', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.render('index', { error: 'No file uploaded', message: null });
    }

    const fileName = req.body.filename || req.file.originalname;
    
    // Validate file is an encrypted archive
    const isArchive = await isEncryptedArchive(req.file.buffer);
    if (!isArchive) {
      return res.render('index', { 
        error: 'Only encrypted archives (ZIP with password) are accepted', 
        message: null 
      });
    }

    // Generate UUID and TOTP secret
    const uuid = crypto.randomUUID();
    const totpSecret = speakeasy.generateSecret({ length: 20 });

    // Encrypt the file
    const encryptedBuffer = encryptFile(req.file.buffer);

    // Save encrypted file to disk
    // Use basename to prevent any potential path traversal
    const safeUuid = path.basename(uuid);
    const filePath = path.join(__dirname, 'uploads', safeUuid);
    fs.writeFileSync(filePath, encryptedBuffer);

    // Store in database
    db.run(
      'INSERT INTO files (uuid, filename, totp_secret) VALUES (?, ?, ?)',
      [uuid, fileName, totpSecret.base32],
      (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.render('index', { error: 'Error saving file', message: null });
        }

        // Generate current TOTP code
        const token = speakeasy.totp({
          secret: totpSecret.base32,
          encoding: 'base32'
        });

        res.render('upload-success', { uuid, token, filename: fileName });
      }
    );
  } catch (error) {
    console.error('Upload error:', error);
    res.render('index', { error: 'Error processing file upload', message: null });
  }
});

// Download redirect (for the form on home page)
app.get('/download-redirect', (req, res) => {
  const { uuid } = req.query;
  if (!uuid) {
    return res.render('index', { error: 'UUID is required', message: null });
  }
  res.redirect(`/download/${uuid}`);
});

// Download page
app.get('/download/:uuid', (req, res) => {
  const { uuid } = req.params;
  res.render('download', { uuid, error: null });
});

// Download file endpoint
app.post('/download/:uuid', downloadLimiter, (req, res) => {
  const { uuid } = req.params;
  const { totp } = req.body;

  // Validate UUID format to prevent path traversal
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    return res.render('download', { uuid, error: 'Invalid UUID format' });
  }

  if (!totp) {
    return res.render('download', { uuid, error: 'TOTP code is required' });
  }

  // Get file info from database
  db.get('SELECT * FROM files WHERE uuid = ?', [uuid], (err, row) => {
    if (err || !row) {
      return res.render('download', { uuid, error: 'File not found' });
    }

    // Verify TOTP
    const verified = speakeasy.totp.verify({
      secret: row.totp_secret,
      encoding: 'base32',
      token: totp,
      window: 2 // Allow 2 time steps tolerance
    });

    if (!verified) {
      return res.render('download', { uuid, error: 'Invalid TOTP code' });
    }

    // Read and decrypt file
    // Use basename to prevent path traversal attacks
    const safeUuid = path.basename(uuid);
    const filePath = path.join(__dirname, 'uploads', safeUuid);
    try {
      const encryptedBuffer = fs.readFileSync(filePath);
      const decryptedBuffer = decryptFile(encryptedBuffer);

      // Send file
      res.setHeader('Content-Disposition', `attachment; filename="${row.filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(decryptedBuffer);
    } catch (error) {
      console.error('Download error:', error);
      res.render('download', { uuid, error: 'Error retrieving file' });
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`SecureFiles server running on port ${PORT}`);
});
