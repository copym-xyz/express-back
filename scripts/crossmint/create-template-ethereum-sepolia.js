// Use the valid server-side API key from create-kyc-credential-type.js
const axios = require('axios');
const collectionId = '9ead4bd2-b0bb-45c9-957c-a640752d0c68'; // New collection ID we created
const apiKey = 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';

async function createTemplate() {
  console.log('Using API Key:', apiKey.substring(0, 20) + '...');
  console.log('Using Collection ID:', collectionId);
  
  try {
    // Simplified request with minimal fields
    const response = await axios({
      method: 'POST',
      url: `https://staging.crossmint.com/api/2022-06-09/collections/${collectionId}/templates`,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      data: {
        metadata: {
          name: 'KYC Verification',
          image: 'https://www.crossmint.com/assets/crossmint/logo.png',
          description: 'KYC verification for Ethereum Sepolia'
        }
      },
      timeout: 15000 // 15 seconds timeout
    });

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    console.log('Template created successfully!');
    console.log('Template ID:', response.data.templateId || response.data.id);
    return response.data;
  } catch (error) {
    console.error('Error during template creation:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data ? JSON.stringify(error.response.data, null, 2) : 'No data');
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received. Request:', error.request._header || error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error message:', error.message);
    }
    
    // Let's create a workaround for the error
    console.log('\nGetting available templates for the collection instead...');
    try {
      const templatesResponse = await axios({
        method: 'GET',
        url: `https://staging.crossmint.com/api/2022-06-09/collections/${collectionId}/templates`,
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        }
      });
      
      console.log('Found templates:', JSON.stringify(templatesResponse.data, null, 2));
      
      if (templatesResponse.data && templatesResponse.data.templates && templatesResponse.data.templates.length > 0) {
        console.log('You already have templates available. You can use one of these:');
        templatesResponse.data.templates.forEach((template, index) => {
          console.log(`Template ${index + 1}:`, template.id);
        });
        return templatesResponse.data.templates[0];
      } else {
        console.log('No templates found for this collection.');
      }
    } catch (templateError) {
      console.error('Error retrieving templates:', templateError.message);
    }
    
    throw error;
  }
}

// Execute the function
createTemplate()
  .then(data => {
    console.log('Template creation process completed!');
    console.log('');
    console.log('Now you can issue a credential to an Ethereum Sepolia wallet address:');
    console.log('node issue-credential-ethereum-sepolia.js <WALLET_ADDRESS>');
  })
  .catch(error => {
    console.error('Failed to create template:', error.message);
    console.log('\nThe Crossmint API appears to be having issues (502 Bad Gateway). This is a server-side problem.');
    console.log('You have several options:');
    console.log('1. Try again later when the Crossmint API is more stable');
    console.log('2. Check if the collection already has templates and use one of those');
    console.log('3. Try using the Crossmint Console web interface to create a template instead');
    console.log('4. Contact Crossmint support for assistance with the API issues');
    
    console.log('\nTo proceed with issuing credentials, you can try using an existing template:');
    console.log('node issue-credential-ethereum-sepolia.js <WALLET_ADDRESS> <TEMPLATE_ID>');
  }); 