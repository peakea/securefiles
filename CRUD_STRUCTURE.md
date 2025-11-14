# CRUD Structure Documentation

This document explains the new CRUD (Create, Read, Update, Delete) structure of the SecureFiles application.

## Architecture Overview

The application has been refactored into a modular MVC-like structure with the following layers:

```
securefiles/
├── index.js                    # Main entry point with routes
├── controllers/                # Business logic handlers
│   ├── fileController.js      # File upload/download operations (CRUD)
│   └── viewController.js      # View rendering controllers
├── models/                     # Data access layer
│   └── fileModel.js           # Database operations for files
└── services/                   # Business services
    ├── encryptionService.js   # File encryption/decryption
    ├── totpService.js         # TOTP generation/verification
    └── fileStorageService.js  # File system operations
```

## Layer Responsibilities

### 1. **index.js** (Router)
- Application initialization and configuration
- Route definitions (all routes remain here as requested)
- Middleware setup (rate limiting, multer, error handling)
- Express app configuration

### 2. **Controllers** (`controllers/`)
Controllers handle HTTP requests and responses, orchestrating calls to services and models.

#### **fileController.js**
Implements CRUD operations for files:
- **Create**: `uploadFile()` - Handle file upload, encryption, and storage
- **Read**: `showDownloadPage()`, `downloadFile()` - Display download page and serve files
- **Update**: `updateFile()` - Placeholder for future file updates
- **Delete**: `deleteFile()` - Placeholder for future file deletion

#### **viewController.js**
Handles view-related operations:
- `showHomePage()` - Render home page
- `downloadRedirect()` - Handle download form submission
- `showTotpTestPage()` - Render TOTP test page
- `generateTotpTest()` - Generate test TOTP codes

### 3. **Models** (`models/`)
Models provide data access abstraction and database operations.

#### **fileModel.js**
Database CRUD operations for file records:
- `create(uuid, filename, totpSecret)` - Insert new file record
- `findByUuid(uuid)` - Retrieve file record by UUID
- `findAll()` - Retrieve all file records
- `update(uuid, updates)` - Update file record
- `delete(uuid)` - Delete file record

### 4. **Services** (`services/`)
Services contain reusable business logic that can be used across controllers.

#### **encryptionService.js**
- `encryptFile(buffer)` - Encrypt file buffer using AES-256-CBC
- `decryptFile(buffer)` - Decrypt file buffer

#### **totpService.js**
- `generateSecret()` - Generate new TOTP secret
- `verifyToken(secret, token, window)` - Verify TOTP code
- `generateToken(secret)` - Generate TOTP code from secret

#### **fileStorageService.js**
- `saveFile(uuid, buffer, uploadsDir)` - Save file to disk
- `readFile(uuid, uploadsDir)` - Read file from disk
- `deleteFile(uuid, uploadsDir)` - Delete file from disk
- `fileExists(uuid, uploadsDir)` - Check if file exists

## Benefits of This Structure

1. **Separation of Concerns**: Each layer has a specific responsibility
2. **Reusability**: Services can be used by multiple controllers
3. **Testability**: Each module can be tested independently
4. **Maintainability**: Easy to locate and modify specific functionality
5. **Scalability**: Easy to add new features following the same pattern

## Data Flow

```
Request → Route (index.js) 
        → Controller 
        → Service/Model 
        → Response
```

Example for file upload:
```
POST /upload → uploadLimiter → multer 
             → fileController.uploadFile()
             → totpService.generateSecret()
             → encryptionService.encryptFile()
             → fileStorageService.saveFile()
             → fileModel.create()
             → Render success page
```

## Future Enhancements

The CRUD structure is ready for additional features:

1. **Update Operations**: Implement file metadata updates
2. **Delete Operations**: Add file deletion functionality with authentication
3. **List Operations**: Add file listing/management interface
4. **API Layer**: Easy to add REST API endpoints alongside web routes
5. **Additional Services**: Add logging, metrics, notifications, etc.

## Route Mapping

All routes remain in `index.js` as requested:

| Method | Route | Controller Method |
|--------|-------|------------------|
| GET | `/` | `viewController.showHomePage` |
| POST | `/upload` | `fileController.uploadFile` |
| GET | `/download-redirect` | `viewController.downloadRedirect` |
| GET | `/download/:uuid` | `fileController.showDownloadPage` |
| POST | `/download/:uuid` | `fileController.downloadFile` |
| GET | `/totp-test` | `viewController.showTotpTestPage` |
| POST | `/totp-test` | `viewController.generateTotpTest` |
