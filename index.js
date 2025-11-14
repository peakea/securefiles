/**
 * SecureFiles - Legacy entry point
 * 
 * This file is kept for backwards compatibility.
 * For new deployments, use: npm start or node cli.js start
 */
import { startServer } from './server.js';

console.log('⚠️  Starting via legacy index.js');
console.log('   Consider using: npm start or node cli.js start\n');

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});