// Script to get existing credential templates
const axios = require('axios');

// Configuration
const API_KEY = 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';
const BASE_URL = 'https://staging.crossmint.com/api';

async function getCredentialTemplates() {
  try {
    console.log('Fetching credential templates...');
    
    const response = await axios({
      method: 'GET',
      url: `${BASE_URL}/v1-alpha1/credentials/templates`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      }
    });

    console.log('Templates fetched successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('Error fetching credential templates:');
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
getCredentialTemplates()
  .then(data => {
    console.log('Templates fetch complete!');
    
    // If templates exist, log them for reference
    if (data && data.templates && data.templates.length > 0) {
      console.log(`Found ${data.templates.length} templates. First template ID:`, data.templates[0].id);
    } else {
      console.log('No templates found.');
    }
  })
  .catch(err => {
    console.error('Failed to fetch templates:', err.message);
    process.exit(1);
  }); 