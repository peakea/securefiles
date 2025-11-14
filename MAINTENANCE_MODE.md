# Maintenance Mode Documentation

## Overview
Maintenance mode allows you to temporarily disable access to SecureFiles while performing updates, maintenance, or troubleshooting. When enabled, users will see a maintenance page instead of the normal application.

## Configuration

Settings in `config.json`:
```json
"maintenance": {
    "enabled": false,
    "message": "SecureFiles is currently undergoing maintenance. Please check back later.",
    "allowedRoutes": ["/totp-test"]
}
```

### Options:

- **`enabled`** (boolean) - Toggle maintenance mode on/off
  - `true` - Maintenance mode active, users see maintenance page
  - `false` - Normal operation (default)

- **`message`** (string) - Custom message displayed on maintenance page
  - Default: "SecureFiles is currently undergoing maintenance. Please check back later."
  - Can be customized to provide specific information (e.g., expected downtime)

- **`allowedRoutes`** (array) - Routes that remain accessible during maintenance
  - Default: `["/totp-test"]`
  - Useful for admin pages, status checks, or utility routes
  - Supports exact matches and prefix matching

## How It Works

### Middleware Flow:
1. Request comes in
2. Maintenance middleware checks if maintenance mode is enabled
3. If disabled → Normal request processing continues
4. If enabled → Check if route is in allowed list
   - Allowed route → Request continues
   - Blocked route → Returns 503 status with maintenance page

### HTTP Status:
- Returns **503 Service Unavailable** during maintenance
- Indicates temporary unavailability to search engines and monitoring tools

## Usage Examples

### Enable Maintenance Mode:
```json
"maintenance": {
    "enabled": true,
    "message": "We're upgrading our servers. Back online in 2 hours!",
    "allowedRoutes": ["/totp-test"]
}
```

### Disable Maintenance Mode:
```json
"maintenance": {
    "enabled": false,
    "message": "SecureFiles is currently undergoing maintenance. Please check back later.",
    "allowedRoutes": ["/totp-test"]
}
```

### Allow Multiple Routes:
```json
"maintenance": {
    "enabled": true,
    "message": "Scheduled maintenance in progress.",
    "allowedRoutes": ["/totp-test", "/health", "/status"]
}
```

### Block Everything:
```json
"maintenance": {
    "enabled": true,
    "message": "Critical maintenance underway. All features temporarily disabled.",
    "allowedRoutes": []
}
```

## Features

### ✅ Blocked During Maintenance:
- Home page (`/`)
- File uploads (`/upload`)
- File downloads (`/download/:uuid`)
- Download pages
- Captcha generation

### ✅ Allowed by Default:
- TOTP test page (`/totp-test`)
  - Useful for administrators to verify their TOTP codes during maintenance

### ✅ Customizable:
- Add any routes to `allowedRoutes` array
- Change maintenance message
- Toggle on/off without code changes

## Maintenance Page

The maintenance page features:
- Clean, professional design
- Animated wrench icon 🔧
- Custom message display
- Purple gradient background
- Responsive layout
- 503 HTTP status code

## Console Output

When maintenance mode is enabled, the server logs:
```
⚠️  Maintenance mode is ENABLED
Allowed routes: /totp-test
```

When disabled:
```
(no maintenance message)
```

## Best Practices

1. **Plan Ahead**: Announce maintenance windows to users
2. **Custom Messages**: Provide specific timing information
3. **Keep Testing Routes**: Always allow TOTP test page for admin access
4. **Quick Toggle**: Keep maintenance config easily accessible
5. **Monitor Logs**: Check console for maintenance status on startup

## Troubleshooting

### Stuck in Maintenance Mode?
- Check `config.json` - ensure `"enabled": false`
- Restart the server after changing config
- Verify config.json is valid JSON

### Need Admin Access?
- Add admin routes to `allowedRoutes` array
- Example: `["/totp-test", "/admin", "/health"]`

### Users Not Seeing Maintenance Page?
- Verify `"enabled": true` in config
- Check middleware is loaded (see console on startup)
- Ensure server was restarted after config change

## Emergency Disable

If you need to quickly disable maintenance mode:

1. Edit `config.json`
2. Set `"enabled": false`
3. Restart the server: `Ctrl+C` then `npm start`

Or temporarily rename the config file to use defaults (maintenance disabled).
