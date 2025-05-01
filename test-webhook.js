/**
 * Test script for the Crossmint webhook handler
 * This script simulates a webhook event from Crossmint
 */
const axios = require('axios');
const crypto = require('crypto');

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://2854-103-175-137-7.ngrok-free.app/webhooks/crossmint';
const WEBHOOK_SECRET = process.env.CROSSMINT_WEBHOOK_SECRET || 'whsec_wnSCMaGf3uCDYpdXciDBZB30IEMCWt8E';
const LOCAL_TEST_URL = 'http://localhost:5000/webhooks/crossmint';

// Generate a sample webhook payload for an NFT minting event
const payload = {
  event: 'test-event-nfts.create.succeeded',
  data: {
    id: `test-nft-${Date.now()}`,
    name: 'Test NFT',
    description: 'This is a test NFT created via webhook simulation',
    onChain: {
      status: 'confirmed',
      chain: 'ethereum-sepolia',
      contractAddress: '0xb3c7330d1C0BC8b191Db59f65a0F34A3B07CA219',
      tokenId: '123456',
      transactionHash: '0xabc123'
    },
    image: 'https://www.crossmint.com/assets/crossmint/logo.png',
    recipient: 'ethereum-sepolia:0xd427918cF8265F8D82E9d3d5d6eF281405059B3C',
    metadata: {
      name: 'Test NFT',
      description: 'This is a test NFT created via webhook simulation',
      image: 'https://www.crossmint.com/assets/crossmint/logo.png',
      attributes: [
        {
          trait_type: 'Test Trait',
          value: 'Test Value'
        }
      ]
    }
  },
  timestamp: new Date().toISOString()
};

// Generate a signature for the webhook
const generateSignature = (payload, secret) => {
  const hmac = crypto.createHmac('sha256', secret);
  return hmac.update(JSON.stringify(payload)).digest('hex');
};

// Test function that sends the webhook to both the local and remote endpoints
const testWebhooks = async () => {
  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, WEBHOOK_SECRET);
  
  // Test the local endpoint
  try {
    console.log('Testing webhook against local endpoint...');
    const localResponse = await axios.post(LOCAL_TEST_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature
      }
    });
    
    console.log('Local webhook test response:', localResponse.data);
    console.log('Local webhook test successful!');
  } catch (localError) {
    console.error('Local webhook test failed:', localError.message);
    if (localError.response) {
      console.error('Response data:', localError.response.data);
      console.error('Response status:', localError.response.status);
    }
  }
  
  // Test the remote/ngrok endpoint
  try {
    console.log('\nTesting webhook against remote endpoint...');
    const remoteResponse = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature
      }
    });
    
    console.log('Remote webhook test response:', remoteResponse.data);
    console.log('Remote webhook test successful!');
  } catch (remoteError) {
    console.error('Remote webhook test failed:', remoteError.message);
    if (remoteError.response) {
      console.error('Response data:', remoteError.response.data);
      console.error('Response status:', remoteError.response.status);
    }
  }
};

// Run the tests
testWebhooks().catch(error => {
  console.error('Error running tests:', error);
});


