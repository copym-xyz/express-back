const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Populate the issuer_credential_type table with data from related tables
 * 
 * @param {string} applicantId - The SumSub applicant ID
 * @param {number} userId - The user ID
 * @param {string|null} did - The DID associated with the credential type
 * @returns {Promise<Object>} - The created issuer_credential_type record
 */
async function createCredentialType(applicantId, userId, did = null) {
  try {
    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    // Get personal information from KYC data
    const personalInfo = await prisma.kyc_personal_info.findFirst({
      where: { applicant_id: applicantId }
    });

    // Get verification information
    const verification = await prisma.kycVerification.findFirst({
      where: { applicant_id: applicantId },
      orderBy: { created_at: 'desc' }
    });

    // Get address information for country of residence
    const addressInfo = await prisma.kyc_address_info.findFirst({
      where: { 
        applicant_id: applicantId,
        is_primary: true
      }
    });

    // Create the credential type record
    const credentialType = await prisma.issuer_credential_type.create({
      data: {
        applicant_id: applicantId,
        user_id: userId,
        first_name: personalInfo?.first_name || user.first_name,
        last_name: personalInfo?.last_name || user.last_name,
        email: personalInfo?.email || user.email,
        date_of_birth: personalInfo?.date_of_birth || null,
        verification_date: verification?.created_at || null,
        verification_status: verification?.review_status || null,
        review_result: verification?.review_result || null,
        country_of_residence: addressInfo?.country || personalInfo?.country || null,
        source: 'sumsub',
        did: did,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    return credentialType;
  } catch (error) {
    console.error('Error creating credential type:', error);
    throw error;
  }
}

/**
 * Updates an existing credential type record
 * 
 * @param {number} id - The ID of the credential type record to update
 * @param {Object} data - The data to update
 * @returns {Promise<Object>} - The updated credential type record
 */
async function updateCredentialType(id, data) {
  try {
    // Update the credential type record
    const credentialType = await prisma.issuer_credential_type.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date()
      }
    });

    return credentialType;
  } catch (error) {
    console.error('Error updating credential type:', error);
    throw error;
  }
}

/**
 * Fetch a credential type by applicant ID
 * 
 * @param {string} applicantId - The SumSub applicant ID
 * @returns {Promise<Object|null>} - The credential type record or null if not found
 */
async function getCredentialTypeByApplicantId(applicantId) {
  try {
    const credentialType = await prisma.issuer_credential_type.findFirst({
      where: { applicant_id: applicantId }
    });

    return credentialType;
  } catch (error) {
    console.error('Error fetching credential type:', error);
    throw error;
  }
}

module.exports = {
  createCredentialType,
  updateCredentialType,
  getCredentialTypeByApplicantId
}; 