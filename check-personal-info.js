const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPersonalInfo() {
  console.log('Checking for personal information records in the database...');
  
  try {
    // Check for personal info records
    const personalInfoRecords = await prisma.kyc_personal_info.findMany({
      include: {
        kyc_applicant: true
      }
    });
    
    console.log(`Found ${personalInfoRecords.length} personal information records:`);
    
    if (personalInfoRecords.length > 0) {
      personalInfoRecords.forEach((record, index) => {
        console.log(`\nRecord #${index + 1}:`);
        console.log(`ID: ${record.id}`);
        console.log(`Applicant ID: ${record.applicant_id}`);
        console.log(`First Name: ${record.first_name || 'N/A'}`);
        console.log(`Last Name: ${record.last_name || 'N/A'}`);
        console.log(`Middle Name: ${record.middle_name || 'N/A'}`);
        console.log(`DOB: ${record.dob || 'N/A'}`);
        console.log(`Gender: ${record.gender || 'N/A'}`);
        console.log(`Nationality: ${record.nationality || 'N/A'}`);
        console.log(`ID Type: ${record.id_type || 'N/A'}`);
        console.log(`ID Number: ${record.id_number || 'N/A'}`);
        console.log(`ID Issue Date: ${record.id_issue_date || 'N/A'}`);
        console.log(`ID Expiry Date: ${record.id_expiry_date || 'N/A'}`);
        console.log(`Country: ${record.country || 'N/A'}`);
        console.log(`State: ${record.state || 'N/A'}`);
        console.log(`Town: ${record.town || 'N/A'}`);
        console.log(`Street: ${record.street || 'N/A'}`);
        console.log(`Postcode: ${record.postcode || 'N/A'}`);
        console.log(`Building Number: ${record.building_number || 'N/A'}`);
        console.log(`Flat Number: ${record.flat_number || 'N/A'}`);
        console.log(`Created At: ${record.created_at}`);
        console.log(`Updated At: ${record.updated_at}`);
        
        if (record.kyc_applicant) {
          console.log(`Associated with Applicant:`);
          console.log(`  Applicant ID: ${record.kyc_applicant.id}`);
          console.log(`  User ID: ${record.kyc_applicant.user_id}`);
          console.log(`  Status: ${record.kyc_applicant.status}`);
          console.log(`  Sumsub ID: ${record.kyc_applicant.sumsub_applicant_id}`);
        } else {
          console.log(`No associated applicant found!`);
        }
      });
    }
    
    // Check for applicants without personal information
    const applicantsWithoutInfo = await prisma.kyc_applicant.findMany({
      where: {
        kyc_personal_info: {
          none: {}
        }
      }
    });
    
    console.log(`\nFound ${applicantsWithoutInfo.length} applicants without personal information:`);
    
    if (applicantsWithoutInfo.length > 0) {
      applicantsWithoutInfo.forEach((applicant, index) => {
        console.log(`\nApplicant #${index + 1}:`);
        console.log(`ID: ${applicant.id}`);
        console.log(`User ID: ${applicant.user_id}`);
        console.log(`Status: ${applicant.status}`);
        console.log(`Sumsub ID: ${applicant.sumsub_applicant_id}`);
        console.log(`Created At: ${applicant.created_at}`);
        console.log(`Updated At: ${applicant.updated_at}`);
      });
    }
    
  } catch (error) {
    console.error('Error checking personal information:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPersonalInfo()
  .catch(error => {
    console.error('Script execution failed:', error);
    process.exit(1);
  }); 