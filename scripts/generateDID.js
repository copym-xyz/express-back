/**
 * Generate a DID for an issuer - CLI utility
 * 
 * Usage:
 * node generateDID.js [issuerId]
 */
require('dotenv').config();
const { generateDIDForIssuer } = require('../utils/didUtils');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const issuerId = args[0] ? parseInt(args[0]) : null;

async function main() {
  try {
    console.log('DID Generation Utility');
    console.log('=====================');
    
    if (!issuerId) {
      // If no issuer ID provided, list all verified issuers
      console.log('No issuer ID provided. Listing all verified issuers:');
      const verifiedIssuers = await prisma.issuer.findMany({
        where: { verification_status: true },
        include: {
          users: true
        },
        orderBy: { id: 'asc' }
      });
      
      if (verifiedIssuers.length === 0) {
        console.log('No verified issuers found.');
        return;
      }
      
      console.log('\nVerified Issuers:');
      console.log('----------------');
      verifiedIssuers.forEach(issuer => {
        console.log(`ID: ${issuer.id}, Name: ${issuer.users.first_name} ${issuer.users.last_name}, Email: ${issuer.users.email}`);
        console.log(`Company: ${issuer.company_name}, DID: ${issuer.did || 'Not generated yet'}`);
        console.log('----------------');
      });
      
      console.log('\nTo generate a DID for an issuer, run:');
      console.log('node generateDID.js [issuerId]');
      return;
    }
    
    // If issuer ID provided, generate DID for that issuer
    console.log(`Generating DID for issuer ID: ${issuerId}`);
    
    // Check if issuer exists and is verified
    const issuer = await prisma.issuer.findUnique({
      where: { id: issuerId },
      include: {
        users: true
      }
    });
    
    if (!issuer) {
      console.error(`Error: Issuer with ID ${issuerId} not found.`);
      return;
    }
    
    if (!issuer.verification_status) {
      console.error(`Error: Issuer with ID ${issuerId} is not verified. Only verified issuers can have DIDs.`);
      return;
    }
    
    // Generate DID
    const result = await generateDIDForIssuer(issuerId);
    
    if (result.success) {
      console.log('\nDID generated successfully:');
      console.log(result.did);
      console.log('\nIssuer details:');
      console.log(`Name: ${issuer.users.first_name} ${issuer.users.last_name}`);
      console.log(`Email: ${issuer.users.email}`);
      console.log(`Company: ${issuer.company_name}`);
    } else {
      console.error(`\nError generating DID: ${result.error}`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 