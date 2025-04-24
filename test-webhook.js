/**
 * Test script for Sumsub webhooks
 * This script simulates different webhook payloads and sends them to the webhook endpoint
 */
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Configuration
const WEBHOOK_URL = 'http://localhost:5000/webhooks/sumsub';
const USER_ID = '16'; // Change this to a valid user ID in your database

// Create a unique applicant ID for this test run
const uniqueId = () => {
  // Generate timestamp-based unique ID to avoid conflicts with previous test runs
  const timestamp = Date.now();
  return `test-${timestamp}`;
};

// Function to send a webhook
async function sendWebhook(payload) {
  console.log('Sending test webhook to', WEBHOOK_URL);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response:', response.status, response.statusText);
    console.log('Response data:', response.data);
    return response;
  } catch (error) {
    console.error('Error sending webhook:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Test webhook for applicantCreated
async function testApplicantCreated() {
  console.log('\n===== Testing applicantCreated webhook =====');
  const applicantId = uniqueId();
  
  const payload = {
    type: 'applicantCreated',
    applicantId,
    externalUserId: `user-${USER_ID}`,
    info: {
      firstName: 'John',
      lastName: 'Doe',
      nationality: 'US',
      email: 'john@example.com',
      phone: '+1234567890'
    }
  };
  
  return await sendWebhook(payload);
}

// Test webhook for applicantReviewed
async function testApplicantReviewed() {
  console.log('\n===== Testing applicantReviewed webhook =====');
  const applicantId = uniqueId();
  
  const payload = {
    type: 'applicantReviewed',
    applicantId,
    externalUserId: `user-${USER_ID}`,
    reviewStatus: 'completed',
    createdAtMs: new Date().toISOString(),
    reviewResult: {
      reviewAnswer: 'GREEN',
      rejectType: null,
      rejectLabels: []
    },
    info: {
      firstName: 'John',
      lastName: 'Doe',
      nationality: 'US',
      email: 'john@example.com',
      phone: '+1234567890',
      dob: '1990-01-01',
      gender: 'M',
      addresses: [
        {
          country: 'US',
          state: 'California',
          city: 'San Francisco',
          street: '123 Main St',
          postcode: '94105',
          buildingNumber: '42',
          flatNumber: '101'
        }
      ]
    }
  };
  
  return await sendWebhook(payload);
}

// Run all tests
async function runTests() {
  const testId = uniqueId();
  console.log(`Using unique applicant ID: ${testId}`);
  
  // Test scenario: Create an applicant
  const createResponse = await testApplicantCreated();
  
  // Test scenario: Review and approve the applicant
  if (createResponse && createResponse.status === 200) {
    await testApplicantReviewed();
  }
}

// Execute tests
runTests().catch(console.error);

