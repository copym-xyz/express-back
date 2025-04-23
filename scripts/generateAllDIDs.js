/**
 * Generate DIDs for all verified issuers who don't have one yet
 * 
 * Usage:
 * node generateAllDIDs.js
 */
require('dotenv').config();
const { generateDIDForIssuer } = require('../utils/didUtils');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateAllDIDs() {
  try {
    console.log('Batch DID Generation Utility');
    console.log('===========================');
    
    // Find all verified issuers without DIDs
    const issuersWithoutDIDs = await prisma.issuer.findMany({
      where: { 
        verification_status: true,
        did: null
      },
      include: {
        users: {
          include: {
            wallet: true
          }
        }
      },
      orderBy: { id: 'asc' }
    });
    
    if (issuersWithoutDIDs.length === 0) {
      console.log('No verified issuers without DIDs found. All verified issuers already have DIDs.');
      return;
    }
    
    console.log(`Found ${issuersWithoutDIDs.length} verified issuers without DIDs.`);
    console.log('Processing...\n');
    
    // Generate DIDs for each issuer
    const results = {
      success: 0,
      failed: 0,
      skipped: 0
    };
    
    for (const issuer of issuersWithoutDIDs) {
      console.log(`Processing issuer ID: ${issuer.id}, Name: ${issuer.users.first_name} ${issuer.users.last_name}`);
      
      // Skip issuers without wallets
      if (!issuer.users.wallet) {
        console.log(`  Skipped: No wallet found for this issuer`);
        results.skipped++;
        continue;
      }
      
      // Generate DID
      const result = await generateDIDForIssuer(issuer.id);
      
      if (result.success) {
        console.log(`  Success: DID generated - ${result.did}`);
        results.success++;
      } else {
        console.log(`  Failed: ${result.error}`);
        results.failed++;
      }
      
      console.log('-------------------');
    }
    
    // Show summary
    console.log('\nBatch DID Generation Summary:');
    console.log(`  Total processed: ${issuersWithoutDIDs.length}`);
    console.log(`  Successfully generated: ${results.success}`);
    console.log(`  Failed: ${results.failed}`);
    console.log(`  Skipped (no wallet): ${results.skipped}`);
    
  } catch (error) {
    console.error('Error during batch DID generation:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\nBatch DID generation process completed.');
  }
}

// Execute the function
generateAllDIDs(); 