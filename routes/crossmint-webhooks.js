/**
 * This is a backward compatibility module to handle the old import path in server.js
 * It simply re-exports the routes from the new location
 */
module.exports = require('./crossmint/crossmint-webhooks.routes'); 