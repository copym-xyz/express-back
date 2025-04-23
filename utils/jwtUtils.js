const { jwtVerify, importSPKI } = require('jose');

/**
 * Verifies a JWT token from Crossmint
 * @param {string} token - The JWT token to verify
 * @returns {Promise<Object>} - The verified payload and header
 */
async function verifyJWT(token) {
    try {
        if (!process.env.JWT_PUBLIC_KEY) {
            throw new Error('JWT_PUBLIC_KEY environment variable is not set');
        }

        // Decode the public key from base64 and import it
        const publicKeyPEM = Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf8');
        const publicKey = await importSPKI(publicKeyPEM, 'RS256');

        // Verify the JWT
        const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
            issuer: process.env.CROSSMINT_PROJECT_ID,
            audience: 'crossmint.com',
        });

        return { payload, protectedHeader };
    } catch (error) {
        console.error('Error verifying JWT:', error);
        throw error;
    }
}

/**
 * Middleware to verify Crossmint JWT tokens
 */
function verifyJWTMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    verifyJWT(token)
        .then(({ payload }) => {
            req.user = payload;
            next();
        })
        .catch(error => {
            console.error('JWT verification failed:', error);
            res.status(401).json({ error: 'Invalid token' });
        });
}

module.exports = {
    verifyJWT,
    verifyJWTMiddleware
}; 