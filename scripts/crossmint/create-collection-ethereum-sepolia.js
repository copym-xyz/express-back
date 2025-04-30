// Script to create a collection in Crossmint for Ethereum Sepolia
const apiKey = 'sk_staging_666stoe1iL5FLscksmnoFJMDfD5FhivjjSfSJixawaVc81r9TRPoH6uaXiECY9P4zKsAv2HHpPcnsXHAhUrgSwBcjw6Hb1dpGLixfQTTJZZKttvaFU61dUThuCWhsahHLoKAXfeBa4XWHtjAQLzYgG4H62tSNyN2pweC8vMMvb5yPYrehZMgZUb5Skvbpe3z9RLfCXMjPDWoB8eZTZW6PW2P';

async function createCollection() {
  console.log('Using API Key:', apiKey.substring(0, 20) + '...');
  const response = await fetch(
    'https://staging.crossmint.com/api/2022-06-09/collections',
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'COPYm KYC Collection',
        description: 'Collection for KYC verification credentials on Ethereum Sepolia',
        chain: 'ethereum-sepolia',
        metadata: {
          name: 'COPYm KYC Collection',
          description: 'Collection for KYC verification credentials',
          image: 'https://i.imgur.com/Bzey91X.png',
        }
      }),
    }
  );

  const data = await response.json();
  
  if (!response.ok) {
    console.error('Error creating collection:', data);
    throw new Error(data.message || 'Failed to create collection');
  }
  
  console.log('Collection created successfully!');
  console.log('Collection ID:', data.id);
  return data;
}

// Execute the function
createCollection()
  .then(data => {
    console.log('Collection creation process completed!');
    console.log('Now update create-template-ethereum-sepolia.js with this collection ID:', data.id);
  })
  .catch(error => {
    console.error('Failed to create collection:', error);
  }); 