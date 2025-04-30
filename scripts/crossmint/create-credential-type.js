// Script to create a KYC verification credential type in Crossmint
const axios = require('axios');

// Configuration
const API_KEY = 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';
const BASE_URL = 'https://staging.crossmint.com/api';
const TYPE_NAME = 'KYCVerification' + Date.now();

async function createCredentialType() {
  try {
    console.log('Creating KYC verification credential type with name:', TYPE_NAME);
    
    const response = await axios({
      method: 'PUT',
      url: `${BASE_URL}/v1-alpha1/credentials/types/${TYPE_NAME}`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      },
      data: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        title: "KYC Verification",
        description: "Schema for KYC verification credentials",
        type: "object",
        properties: {
          credentialSubject: {
            type: "object",
            properties: {
              applicantId: {
                type: "string",
                description: "Unique identifier of the applicant in the KYC system"
              },
              userId: {
                type: "string",
                description: "User ID in the platform system"
              },
              firstName: {
                type: "string",
                description: "First name of the verified user"
              },
              lastName: {
                type: "string",
                description: "Last name of the verified user"
              },
              email: {
                type: "string",
                format: "email",
                description: "Email address of the verified user"
              },
              dateOfBirth: {
                type: "string",
                format: "date",
                description: "Date of birth of the verified user"
              },
              verificationDate: {
                type: "string",
                format: "date-time",
                description: "Date and time of verification"
              },
              verificationStatus: {
                type: "string",
                enum: ["pending", "verified", "rejected"],
                description: "Status of the verification process"
              },
              reviewResult: {
                type: "string",
                enum: ["GREEN", "YELLOW", "RED"],
                description: "Result of the KYC review"
              },
              countryOfResidence: {
                type: "string",
                description: "Country of residence of the verified user"
              },
              source: {
                type: "string",
                description: "Source of the KYC verification (e.g., 'Sumsub')"
              },
              id: {
                type: "string",
                description: "DID of the credential subject"
              }
            },
            required: ["applicantId", "firstName", "lastName", "verificationStatus"],
            additionalProperties: false
          }
        }
      }
    });

    console.log('Credential type created successfully!');
    console.log('Type ID:', response.data.id);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return response.data.id;
  } catch (error) {
    console.error('Error creating credential type:');
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
createCredentialType()
  .then(typeId => {
    console.log('Type creation complete! Type ID:', typeId);
  })
  .catch(err => {
    console.error('Failed to create credential type:', err.message);
    process.exit(1);
  }); 