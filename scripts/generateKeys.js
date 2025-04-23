const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateKeyPair() {
    // Generate key pair
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    // Convert to base64
    const privateKeyBase64 = Buffer.from(privateKey).toString('base64');
    const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

    // Update .env file
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Replace or add JWT keys
    envContent = envContent.replace(/JWT_PRIVATE_KEY=.*\n/, '');
    envContent = envContent.replace(/JWT_PUBLIC_KEY=.*\n/, '');
    
    envContent += `\n# JWT Keys\nJWT_PRIVATE_KEY=${privateKeyBase64}\nJWT_PUBLIC_KEY=${publicKeyBase64}\n`;

    fs.writeFileSync(envPath, envContent);

    console.log('RSA key pair generated and saved to .env file');
    console.log('Public Key (base64):', publicKeyBase64);
}

generateKeyPair(); 