/**
 * Extracts user ID from external user ID string
 * @param {string} externalUserId - External user ID from Sumsub or other services
 * @returns {number|null} - Extracted user ID or null if not found
 */
function extractUserId(externalUserId) {
  if (!externalUserId) return null;
  
  // Check for userId- prefix
  if (externalUserId.startsWith('userId-')) {
    const id = externalUserId.split('userId-')[1];
    return parseInt(id, 10) || null;
  }
  
  // Check for email:username format
  if (externalUserId.includes(':')) {
    const parts = externalUserId.split(':');
    if (parts[0] === 'userId' && parts.length > 1) {
      return parseInt(parts[1], 10) || null;
    }
  }
  
  return null;
}

module.exports = extractUserId; 