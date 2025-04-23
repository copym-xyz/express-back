const crypto = require('crypto');

/**
 * Verifies a webhook signature using HMAC
 * @param {string} signature - The signature from the webhook header
 * @param {string} payload - The stringified payload
 * @param {string} secret - The webhook secret key
 * @returns {boolean} - Whether the signature is valid
 */
function verifySignature(signature, payload, secret) {
    try {
        if (!signature || !secret) {
            console.warn('Missing signature or secret key for webhook verification');
            return false;
        }

        // Calculate HMAC
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(payload);
        const calculatedSignature = hmac.digest('hex');

        // Use constant-time comparison
        return crypto.timingSafeEqual(
            Buffer.from(calculatedSignature, 'hex'),
            Buffer.from(signature, 'hex')
        );
    } catch (error) {
        console.error('Error verifying webhook signature:', error);
        return false;
    }
}

module.exports = {
    verifySignature
}; 