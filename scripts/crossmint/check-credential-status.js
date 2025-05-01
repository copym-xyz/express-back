// Script to check the status of a credential issuance
const axios = require('axios');

// Configuration
const API_KEY = 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';
const BASE_URL = 'https://staging.crossmint.com/api';

// Get action ID from command line arguments
const ACTION_ID = process.argv[2];

// Validate inputs
if (!ACTION_ID) {
  console.error('Please provide an action ID.');
  console.error('Usage: node check-credential-status.js <action_id>');
  process.exit(1);
}

async function checkCredentialStatus(actionId) {
  try {
    console.log('Checking credential status for action ID:', actionId);
    
    // Use the actions endpoint to check status
    const response = await axios({
      method: 'GET',
      url: `${BASE_URL}/2022-06-09/actions/${actionId}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      }
    });
    
    console.log('Status:', response.data.status);
    console.log('Details:', JSON.stringify(response.data, null, 2));
    
    return response.data;
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
    console.log('');
    console.log(`Credential status check complete for ${ACTION_ID}`);
    
    // Provide next steps based on status
    if (data.status === 'success') {
      console.log('\nCredential issuance was successful!');
      console.log('The credential should now be visible in the recipient wallet');
    } else if (data.status === 'pending') {
      console.log('\nCredential issuance is still in progress.');
      console.log('Check again in a few moments:');
      console.log(`node backend/scripts/crossmint/check-credential-status.js ${ACTION_ID}`);
    } else if (data.status === 'failed') {
      console.log('\nCredential issuance failed.');
      console.log('Please check the error details above and try again.');
    }
  })
  .catch(err => {
    console.error('Failed to check credential status:', err.message);
    process.exit(1);
  }); 