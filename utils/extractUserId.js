/**
 * Utility function to extract numeric userId from various externalUserId formats
 * Handles the following formats:
 * - userId-123
 * - user-123
 * - issuer-123
 * - level-xxx (extracts level prefix as special case)
 * - 123
 * - temp-timestamp (returns null)
 * 
 * @param {string} externalUserId - The externalUserId from Sumsub
 * @returns {number|null} - The numeric user ID or null if not found
 */
function extractUserId(externalUserId) {
  if (!externalUserId || typeof externalUserId !== 'string') {
    console.log(`Invalid externalUserId: ${externalUserId}`);
    return null;
  }

  console.log(`Extracting userId from: ${externalUserId}`);

  // Check for test or temporary IDs
  if (externalUserId.startsWith('temp-') || externalUserId.startsWith('test-')) {
    console.log('Temporary or test ID detected, skipping extraction');
    return null;
  }

  // Check for level-based IDs (used in SDK)
  if (externalUserId.startsWith('level-')) {
    console.log('Level-based ID detected, not a direct user reference');
    // These are not user IDs, they're generated per verification session
    return null;
  }

  // Check for the standard format "userId-123"
  const standardFormat = externalUserId.match(/^userId[-_](\d+)$/i);
  if (standardFormat && standardFormat[1]) {
    const id = parseInt(standardFormat[1], 10);
    console.log(`Extracted userId ${id} from standard format`);
    return id;
  }

  // Check for the legacy format "user-123"
  const legacyFormat = externalUserId.match(/^user[-_](\d+)$/i);
  if (legacyFormat && legacyFormat[1]) {
    const id = parseInt(legacyFormat[1], 10);
    console.log(`Extracted userId ${id} from legacy format`);
    return id;
  }

  // Check for the issuer format "issuer-123"
  const issuerFormat = externalUserId.match(/^issuer[-_](\d+)$/i);
  if (issuerFormat && issuerFormat[1]) {
    const id = parseInt(issuerFormat[1], 10);
    console.log(`Extracted userId ${id} from issuer format`);
    return id;
  }

  // Check if the entire string is numeric
  if (/^\d+$/.test(externalUserId)) {
    const id = parseInt(externalUserId, 10);
    console.log(`Extracted userId ${id} from numeric format`);
    return id;
  }

  // Check for any numeric part in the string - only as last resort
  const anyNumeric = externalUserId.match(/(\d+)/);
  if (anyNumeric && anyNumeric[1]) {
    // Only use this as a last resort, and only if the number is likely a user ID
    // (e.g., not just a single digit or very large number)
    const potentialId = parseInt(anyNumeric[1], 10);
    if (potentialId > 10 && potentialId < 1000000) {
      console.log(`Extracted userId ${potentialId} from partial match (low confidence)`);
      return potentialId;
    }
  }

  console.log(`No valid userId found in: ${externalUserId}`);
  return null;
}

module.exports = extractUserId; 