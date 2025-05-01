// Script to test credential issuance
require('dotenv').config();
const { issueVerificationCredential, checkCredentialStatus } = require('../../utils/issuerVcUtils');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get issuer ID from command line arguments or use a test ID
const ISSUER_ID = process.argv[2];

// Validate inputs
if (!ISSUER_ID) {
  console.error('Please provide an issuer ID.');
  console.error('Usage: node test-issue-credential.js <issuer_id>');
  process.exit(1);
}

async function testIssueCredential() {
  try {
    console.log('===== Verifiable Credential Issuance Test =====');
    console.log(`Issuing credential to issuer with ID: ${ISSUER_ID}`);
    
    // Display environment info
    console.log('\nEnvironment Information:');
    console.log(`Collection ID: ${process.env.COLLECTION_ID || '9ead4bd2-b0bb-45c9-957c-a640752d0c68'}`);
    console.log(`Template ID: ${process.env.TEMPLATE_ID || '1fb3506d-38cd-4fcb-95b9-b8aabef80797'}`);
    
    // First, get issuer details
    const issuer = await prisma.issuer.findFirst({
      where: { id: ISSUER_ID },
      include: {
        users: {
          include: {
            wallet: true
          }
        }
      }
    });
    
    if (!issuer) {
      console.error(`\nError: Issuer not found with ID: ${ISSUER_ID}`);
      process.exit(1);
    }
    
    console.log('\nIssuer Details:');
    console.log(`Company: ${issuer.company_name}`);
    console.log(`User ID: ${issuer.user_id}`);
    console.log(`Verification Status: ${issuer.verification_status ? 'Verified' : 'Not Verified'}`);
    
    if (issuer.users.wallet) {
      console.log(`Wallet Address: ${issuer.users.wallet.address}`);
      console.log(`Chain: ${issuer.users.wallet.chain || 'ethereum-sepolia'}`);
    } else {
      console.log('Wallet: Not created yet');
    }
    
    // Check verification status
    if (!issuer.verification_status) {
      console.error('\nError: Issuer is not verified. Verification is required to issue credentials.');
      console.log('Update the issuer verification status in the database or complete KYC first.');
      process.exit(1);
    }
    
    // Issue the credential
    console.log('\nIssuing credential...');
    const result = await issueVerificationCredential(ISSUER_ID);
    
    if (!result.success) {
      console.error('\nError issuing credential:');
      console.error(result.error);
      console.error('Details:', result.details);
      process.exit(1);
    }
    
    console.log('\nCredential issuance initiated successfully!');
    console.log(`ID: ${result.id}`);
    console.log(`Action ID: ${result.actionId}`);
    
    // Check the status
    console.log('\nChecking initial credential status...');
    const statusResult = await checkCredentialStatus(result.actionId);
    
    console.log(`\nCurrent Status: ${statusResult.success ? statusResult.status : 'Error'}`);
    
    console.log('\nTo check status later, run:');
    console.log(`node backend/scripts/crossmint/check-credential-status.js ${result.actionId}`);
    
    console.log('\nProcess completed successfully!');
    
    return result;
  } catch (error) {
    console.error('Error in test script:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testIssueCredential()
  .then(() => {
    console.log('\nTest completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  }); 