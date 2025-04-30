// Script to check the status of a credential using the action ID
const axios = require('axios');

// Configuration
const API_KEY = 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';
const BASE_URL = 'https://staging.crossmint.com/api';

// Get the action ID from the command line arguments
const ACTION_ID = process.argv[2];

if (!ACTION_ID) {
  console.error('Please provide an action ID as a command line argument.');
  console.error('Usage: node check-credential-status.js <action_id>');
  process.exit(1);
}

async function checkCredentialStatus(actionId) {
  try {
    console.log('Checking credential status for action ID:', actionId);
    
    // First, check the action status
    const actionResponse = await axios({
      method: 'GET',
      url: `${BASE_URL}/v1-alpha1/credentials/actions/${actionId}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      }
    });
    
    console.log('Action status:', actionResponse.data.status);
    console.log('Action details:', JSON.stringify(actionResponse.data, null, 2));
    
    // If the action is successful and has a credential ID, check the credential details
    if (actionResponse.data.status === 'succeeded' && actionResponse.data.credentialId) {
      const credentialId = actionResponse.data.credentialId;
      console.log('Credential ID found:', credentialId);
      
      // Fetch the credential details
      const credentialResponse = await axios({
        method: 'GET',
        url: `${BASE_URL}/v1-alpha1/credentials/${credentialId}`,
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': API_KEY
        }
      });
      
      console.log('Credential status:', credentialResponse.data.status);
      console.log('Credential details:', JSON.stringify(credentialResponse.data, null, 2));
      
      // Check if the credential is for Ethereum Sepolia
      if (credentialResponse.data.recipient && credentialResponse.data.recipient.includes('ethereum-sepolia:')) {
        console.log('This credential is issued for an Ethereum Sepolia wallet.');
        const walletAddress = credentialResponse.data.recipient.split(':')[1];
        console.log('Wallet address:', walletAddress);
      }
      
      return credentialResponse.data;
    }
    
    return actionResponse.data;
  } catch (error) {
    console.error('Error checking credential status:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

// Execute the function
checkCredentialStatus(ACTION_ID)
  .then(data => {
    console.log('Credential status check complete!');
  })
  .catch(err => {
    console.error('Failed to check credential status:', err.message);
    process.exit(1);
  }); 