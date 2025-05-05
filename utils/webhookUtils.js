/**
 * Webhook utility functions
 * Provides common functionality for webhook handling across different providers
 */
const crypto = require('crypto');

/**
 * Verify a webhook signature
 * @param {string} payload - Raw webhook payload
 * @param {string} signature - Signature from the webhook headers
 * @param {string} secretKey - Secret key for verification
 * @param {string} algorithm - Signature algorithm (default: HMAC_SHA256_HEX) 
 * @returns {boolean} - Whether the signature is valid
 */
const verifyWebhookSignature = (payload, signature, secretKey, algorithm = 'HMAC_SHA256_HEX') => {
  if (!payload || !signature || !secretKey) {
    return false;
  }

  try {
    let hmac;
    
    // Handle different algorithm formats
    if (algorithm === 'HMAC_SHA256_HEX' || algorithm === 'sha256') {
      hmac = crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
      
      // Crossmint prefixes with "sha256="
      if (signature.startsWith('sha256=')) {
        return crypto.timingSafeEqual(
          Buffer.from(`sha256=${hmac}`, 'utf8'),
          Buffer.from(signature, 'utf8')
        );
      }
      
      // SumSub doesn't prefix
      return crypto.timingSafeEqual(
        Buffer.from(hmac, 'utf8'),
        Buffer.from(signature, 'utf8')
      );
    } else {
      console.warn(`Unsupported signature algorithm: ${algorithm}`);
      return false;
    }
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
};

/**
 * Create middleware for webhook signature verification
 * @param {string} secretKey - Secret key for verification
 * @param {string} signatureHeaderName - Header containing the signature
 * @param {function} onInvalid - Callback for invalid signatures
 */
const createWebhookVerificationMiddleware = (secretKey, signatureHeaderName, onInvalid) => {
  return (req, res, next) => {
    // Store raw body for signature verification
    const rawBody = req.rawBody || (Buffer.isBuffer(req.body) 
      ? req.body.toString('utf8') 
      : typeof req.body === 'object' ? JSON.stringify(req.body) : req.body);
    
    const signature = req.headers[signatureHeaderName.toLowerCase()];
    
    if (process.env.NODE_ENV !== 'production') {
      // Skip verification in development
      return next();
    }
    
    const isValid = verifyWebhookSignature(rawBody, signature, secretKey);
    
    if (!isValid) {
      return onInvalid 
        ? onInvalid(req, res) 
        : res.status(403).json({ success: false, message: 'Invalid signature' });
    }
    
    next();
  };
};

module.exports = {
  verifyWebhookSignature,
  createWebhookVerificationMiddleware
}; 