"use strict";

// Configuration variables
let maintenanceEnabled = false;
let maintenanceMessage = 'The site is currently undergoing maintenance. Please check back later.';
let allowedRoutes = [];

// Setup function to initialize maintenance mode with config
export const setupMaintenance = (config) => {
    maintenanceEnabled = config.maintenance?.enabled ?? false;
    maintenanceMessage = config.maintenance?.message || 'The site is currently undergoing maintenance. Please check back later.';
    allowedRoutes = config.maintenance?.allowedRoutes || [];
    
    if (maintenanceEnabled) {
        console.log('⚠️  Maintenance mode is ENABLED');
        console.log(`Allowed routes: ${allowedRoutes.length > 0 ? allowedRoutes.join(', ') : 'none'}`);
    }
};

// Middleware to check maintenance mode
export const maintenanceMiddleware = (req, res, next) => {
    // If maintenance mode is disabled, continue normally
    if (!maintenanceEnabled) {
        return next();
    }

    // Check if current route is in allowed routes
    const currentPath = req.path;
    const isAllowed = allowedRoutes.some(route => {
        // Exact match or starts with for wildcard routes
        return currentPath === route || currentPath.startsWith(route);
    });

    if (isAllowed) {
        return next();
    }

    // Return maintenance page
    return res.status(503).render('maintenance', { 
        message: maintenanceMessage 
    });
};

export default { setupMaintenance, maintenanceMiddleware };
