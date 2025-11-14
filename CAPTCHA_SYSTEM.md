# Captcha System Documentation

## Overview
A captcha verification system has been implemented to prevent automated file uploads. The system uses visual captcha images with 6-character codes that expire after 5 minutes.

## Components Created

### 1. **Services**

#### `/services/captchaService.js`
- `setupCaptchaService(config)` - Initialize captcha service with configuration and start cleanup
- `generate()` - Generates a new captcha with a unique key, text, image buffer, and creation time
- `verify(userAnswer, storedAnswer)` - Verifies if the user's answer matches the stored captcha text
- `isExpired(createdAt, expiryMs)` - Checks if a captcha has expired
- `stopCaptchaCleanup()` - Stops the cleanup task
- Includes automatic cleanup that runs periodically and logs statistics

### 2. **Models**

#### `/models/captchaModel.js`
- `create(key, text, expiresAt)` - Stores a captcha in the database
- `findByKey(key)` - Retrieves a captcha by its unique key
- `delete(key)` - Deletes a captcha (after use or expiration)
- `cleanExpired()` - Removes all expired captchas from database
- `count()` - Returns count of active captchas (for monitoring)

### 3. **Database**

#### New Table: `captchas`
```sql
CREATE TABLE IF NOT EXISTS captchas (
    key TEXT PRIMARY KEY,           -- Unique 32-character hex key
    text TEXT NOT NULL,             -- The captcha answer (6 characters)
    created_at INTEGER NOT NULL     -- Unix timestamp (Date.now())
)
```

**Note:** Expiration is calculated dynamically based on `created_at` + configured `expiryMs` (default 5 minutes)

### 4. **Routes**

- `GET /` - Home page with captcha generation
- `GET /captcha/:key` - Serves captcha image for a given key
- `POST /upload` - Validates captcha before processing file upload

## Workflow

### Upload Flow:
1. User visits home page (`GET /`)
2. Server generates captcha and stores it in database with 5-minute expiration
3. Captcha key is passed to the view and image is displayed via `/captcha/:key` route
4. User fills form and enters captcha answer
5. On submission (`POST /upload`):
   - Server verifies captcha key exists and hasn't expired
   - Compares user's answer with stored text (case-insensitive)
   - If valid: processes upload and deletes captcha from database
   - If invalid/expired: shows error and generates new captcha

### Cleanup Process:
- Runs automatically at configured interval (default: every 10 minutes)
- Deletes all captchas where `created_at < (Date.now() - expiryMs)`
- Expiration calculated dynamically based on configured `expiryMs`
- Logs statistics: number deleted and remaining count

## Security Features

1. **One-time use**: Captchas are deleted immediately after verification attempt
2. **Time-limited**: 5-minute expiration prevents reuse
3. **Unique keys**: 32-character random hex keys prevent guessing
4. **Automatic cleanup**: Prevents database bloat from abandoned captchas
5. **No caching**: Captcha images have `Cache-Control: no-cache` header

## Error Handling

All error scenarios generate a new captcha for retry:
- Missing captcha fields
- Captcha not found
- Expired captcha
- Incorrect answer
- File validation errors
- Upload errors
- Multer errors (file size, etc.)

## Configuration

Captcha settings in `default-config.json`:
```json
"captcha": {
    "expiryMs": 300000,              // 5 minutes (300000ms)
    "cleanupIntervalMs": 600000,     // 10 minutes (600000ms)
    "colorMode": true,               // Enable colorful captcha mode
    "characters": 6,                 // Number of characters
    "font": "Comic Sans MS",         // Font family (used in color mode)
    "size": 60,                      // Font size
    "width": 150,                    // Image width
    "height": 400,                   // Image height
    "skew": true,                    // Enable character skewing (color mode)
    "rotate": 25,                    // Character rotation degrees (color mode)
    "colors": [                      // 8 pre-selected colors for random selection
        "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4",
        "#ffeaa7", "#a29bfe", "#fd79a8", "#fdcb6e"
    ],
    "traceColor": "#2d3436",         // Trace line color
    "traceSize": 3                   // Trace line size
}
```

### Color Modes:

**Color Mode Enabled (`colorMode: true`):**
- Uses colorful, randomly colored characters from the `colors` array
- Characters are skewed and rotated for extra security
- Custom font is applied (e.g., "Comic Sans MS")
- More visually appealing and harder to OCR

**Color Mode Disabled (`colorMode: false`):**
- Simple black text on white background
- No skewing or rotation
- Uses default font
- Simpler but still effective

### Pre-selected Colors:
The system uses 8 carefully chosen colors that provide good contrast and readability:
- `#ff6b6b` - Red
- `#4ecdc4` - Teal
- `#45b7d1` - Blue
- `#96ceb4` - Mint Green
- `#ffeaa7` - Yellow
- `#a29bfe` - Purple
- `#fd79a8` - Pink
- `#fdcb6e` - Orange

**How it works:**
- Captchas are stored with only their creation timestamp (`created_at`)
- Expiration is calculated dynamically: `Date.now() > (created_at + expiryMs)`
- This allows changing the expiry duration in config without database migration
- Cleanup task uses the same `expiryMs` value to determine which captchas to delete
- When regenerating captcha images, the same configuration is used for consistency

## Monitoring

Check console logs for:
- "Starting captcha cleanup task (every X minutes)" - on server start
- "Captcha cleanup: Removed X expired captcha(s), Y remaining" - every 10 minutes
