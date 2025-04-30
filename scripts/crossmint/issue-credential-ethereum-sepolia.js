// Script to issue a credential directly to an Ethereum Sepolia wallet
const axios = require('axios');

// Configuration
const API_KEY = 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';
const BASE_URL = 'https://staging.crossmint.com/api';
const COLLECTION_ID = '9ead4bd2-b0bb-45c9-957c-a640752d0c68';

// Get recipient wallet address from command line arguments
const RECIPIENT_WALLET = process.argv[2];

// Validate inputs
if (!RECIPIENT_WALLET) {
  console.error('Please provide a recipient Ethereum Sepolia wallet address.');
  console.error('Usage: node issue-credential-ethereum-sepolia.js <wallet_address>');
  process.exit(1);
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000; // 3 seconds

// Function to delay execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function issueCredential(recipientWallet, retryCount = 0) {
  try {
    console.log('Issuing credential to Ethereum Sepolia wallet:', recipientWallet);
    
    // Use the NFT minting endpoint for the collection
    const response = await axios({
      method: 'POST',
      url: `${BASE_URL}/2022-06-09/collections/${COLLECTION_ID}/nfts`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      },
      data: {
        metadata: {
          name: "KYC Verification Credential",
          description: "Proof of successful KYC verification",
          image: "https://www.crossmint.com/assets/crossmint/logo.png",
          attributes: [
            {
              trait_type: "Verification Status",
              value: "Verified"
            },
            {
              trait_type: "Issued Date",
              value: new Date().toISOString().split('T')[0]
            },
            {
              trait_type: "Expiration Date",
              value: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            },
            {
              trait_type: "Applicant ID",
              value: "ethereum-sepolia-" + Date.now()
            }
          ]
        },
        recipient: `ethereum-sepolia:${recipientWallet}`
      }
    });
    
    console.log('Credential issued successfully!');
    console.log('NFT ID:', response.data.id);
    console.log('Action ID:', response.data.actionId || response.data.id);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error issuing credential:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
      await sleep(RETRY_DELAY);
      return issueCredential(recipientWallet, retryCount + 1);
    }
    
    throw error;
  }
}

// Execute the function
issueCredential(RECIPIENT_WALLET)
  .then(data => {
    console.log('Credential issuance complete!');
    console.log('');
    console.log('To check the credential status:');
    console.log(`node backend/scripts/crossmint/check-credential-status.js ${data.actionId || data.id}`);
  })
  .catch(err => {
    console.error('Failed to issue credential:', err.message);
    console.log('\nThe Crossmint API might be experiencing issues. Please try again later or contact Crossmint support.');
    process.exit(1);
  }); 