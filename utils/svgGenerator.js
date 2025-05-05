const crypto = require('crypto');

/**
 * Utility for generating SVG visualizations for credentials and NFTs
 */

/**
 * Generate an SVG for a verifiable credential
 * @param {object} data - Credential data
 * @param {string} data.title - Credential title
 * @param {string} data.issuer - Issuer name
 * @param {string} data.issuanceDate - Date of issuance
 * @param {string} data.credentialType - Type of credential
 * @returns {string} SVG data URI
 */
function generateCredentialSvg(data, issuerName) {
  let title = data.title || data.metadata?.name || 'Verification Credential';
  let issuer = data.issuer || issuerName || 'Verified Issuer';
  let issuanceDate = data.issuanceDate || new Date().toISOString().split('T')[0];
  let credentialType = data.credentialType || 'Verification';
  
  // Extract from metadata if available
  if (data.metadata?.attributes) {
    const attributes = data.metadata.attributes;
    const typeAttr = attributes.find(attr => attr.trait_type === 'Credential Type' || attr.trait_type === 'Type');
    const dateAttr = attributes.find(attr => attr.trait_type === 'Issued Date' || attr.trait_type === 'Issuance Date');
    const issuerAttr = attributes.find(attr => attr.trait_type === 'Company Name' || attr.trait_type === 'Issuer');
    
    if (typeAttr) credentialType = typeAttr.value;
    if (dateAttr) issuanceDate = dateAttr.value;
    if (issuerAttr) issuer = issuerAttr.value;
  }
  
  // Generate random color for the border
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899'];
  const borderColor = colors[Math.floor(Math.random() * colors.length)];
  
  // Create the SVG
  const svg = `
  <svg width="400" height="600" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
    <!-- Background -->
    <rect width="400" height="600" fill="#FFFFFF" rx="15" ry="15" />
    
    <!-- Border -->
    <rect x="10" y="10" width="380" height="580" stroke="${borderColor}" stroke-width="5" fill="none" rx="10" ry="10" />
    
    <!-- Header -->
    <rect x="20" y="20" width="360" height="80" fill="${borderColor}" rx="5" ry="5" />
    <text x="200" y="70" font-family="Arial, sans-serif" font-size="24" font-weight="bold" text-anchor="middle" fill="#FFFFFF">
      ${title}
    </text>
    
    <!-- Verification Checkmark -->
    <circle cx="200" cy="150" r="40" fill="#4CAF50" />
    <path d="M180,150 L195,165 L220,135" stroke="#FFFFFF" stroke-width="8" fill="none" />
    
    <!-- Credential Type -->
    <text x="200" y="230" font-family="Arial, sans-serif" font-size="20" font-weight="bold" text-anchor="middle" fill="#333333">
      ${credentialType}
    </text>
    
    <!-- Issuer -->
    <text x="200" y="290" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#555555">
      Issued by:
    </text>
    <text x="200" y="320" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#333333">
      ${issuer}
    </text>
    
    <!-- Issuance Date -->
    <text x="200" y="370" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#555555">
      Issued on:
    </text>
    <text x="200" y="400" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#333333">
      ${issuanceDate}
    </text>
    
    <!-- Footer -->
    <text x="200" y="550" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="#888888">
      Verified on Blockchain
    </text>
  </svg>
  `;
  
  // Convert to data URI
  const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  return dataUri;
}

/**
 * Generate a simple NFT SVG image
 * @param {string} title - NFT title
 * @param {string} description - NFT description
 * @returns {string} SVG data URI
 */
function generateNftSvg(title, description) {
  const svg = `
  <svg width="500" height="500" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg">
    <!-- Background -->
    <rect width="500" height="500" fill="#F3F4F6" rx="15" ry="15" />
    
    <!-- Border -->
    <rect x="10" y="10" width="480" height="480" stroke="#3B82F6" stroke-width="5" fill="none" rx="10" ry="10" />
    
    <!-- Title -->
    <text x="250" y="80" font-family="Arial, sans-serif" font-size="28" font-weight="bold" text-anchor="middle" fill="#1F2937">
      ${title}
    </text>
    
    <!-- Icon -->
    <circle cx="250" cy="200" r="60" fill="#3B82F6" />
    <path d="M230,200 L245,215 L270,180" stroke="#FFFFFF" stroke-width="10" fill="none" />
    
    <!-- Description -->
    <text x="250" y="300" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="#4B5563">
      ${description}
    </text>
    
    <!-- Footer -->
    <text x="250" y="450" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="#6B7280">
      Powered by Crossmint
    </text>
  </svg>
  `;
  
  // Convert to data URI
  const dataUri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  return dataUri;
}

module.exports = {
  generateCredentialSvg,
  generateNftSvg
}; 