// Script to check existing credential types and templates
const axios = require('axios');

// Configuration
const API_KEY = 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';
const BASE_URL = 'https://staging.crossmint.com/api';
const PROJECT_ID = '883f05c8-c651-417e-bdc2-6cd3a7ffe8dd';

async function checkCredentialTypes() {
  try {
    console.log('Checking for credential types in project:', PROJECT_ID);
    
    // Search with project ID prefix
    const searchPrefix = `crossmint:${PROJECT_ID}:`;
    console.log('Searching with prefix:', searchPrefix);
    
    const response = await axios({
      method: 'GET',
      url: `${BASE_URL}/v1-alpha1/credentials/types`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      }
    });

    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Filter types by our project ID
    const projectTypes = response.data.types.filter(type => 
      type.id && type.id.startsWith(searchPrefix)
    );
    
    console.log(`Found ${projectTypes.length} credential types in this project.`);
    
    // Check each type for templates
    for (const type of projectTypes) {
      console.log(`\nChecking templates for type: ${type.id}`);
      
      try {
        const templatesResponse = await axios({
          method: 'GET',
          url: `${BASE_URL}/v1-alpha1/credentials/types/${type.id}/templates`,
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': API_KEY
          }
        });
        
        if (templatesResponse.data && templatesResponse.data.templates) {
          console.log(`Found ${templatesResponse.data.templates.length} templates for this type.`);
          
          // Log templates for reference
          if (templatesResponse.data.templates.length > 0) {
            console.log('Templates:');
            templatesResponse.data.templates.forEach(template => {
              console.log(`- ID: ${template.id}`);
            });
          }
        }
      } catch (templateError) {
        console.error(`Error fetching templates for type ${type.id}:`, templateError.message);
      }
    }
    
    return projectTypes;
  } catch (error) {
    console.error('Error checking credential types:');
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
checkCredentialTypes()
  .then(types => {
    console.log('\nSummary:');
    console.log(`Found ${types.length} credential types in project ${PROJECT_ID}`);
    
    if (types.length > 0) {
      console.log('');
      console.log('To issue a credential with an existing type:');
      console.log(`node issue-credential.js ${types[0].id}`);
    }
  })
  .catch(err => {
    console.error('Failed to check credential types:', err.message);
    process.exit(1);
  }); 