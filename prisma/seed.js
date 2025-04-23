const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed process...');
  
  // Skip deletion to avoid foreign key issues
  
  // Create sample admin accounts
  const adminUsers = [
    {
      email: 'admin1@example.com',
      password: 'Admin123!',
      first_name: 'John',
      last_name: 'Admin',
      department: 'IT',
      position: 'System Administrator',
    },
    {
      email: 'admin2@example.com',
      password: 'Admin123!',
      first_name: 'Sarah',
      last_name: 'Manager',
      department: 'Operations',
      position: 'Operations Manager',
    },
    {
      email: 'admin3@example.com',
      password: 'Admin123!',
      first_name: 'Michael',
      last_name: 'Director',
      department: 'Executive',
      position: 'IT Director',
    },
  ];

  // Create sample issuer accounts
  const issuerUsers = [
    {
      email: 'issuer1@example.com',
      password: 'Issuer123!',
      first_name: 'David',
      last_name: 'Smith',
      company_name: 'Tech Innovations Ltd',
      company_registration_number: 'REG123456',
      jurisdiction: 'United States',
    },
    {
      email: 'issuer2@example.com',
      password: 'Issuer123!',
      first_name: 'Emma',
      last_name: 'Johnson',
      company_name: 'Green Energy Corp',
      company_registration_number: 'REG789012',
      jurisdiction: 'United Kingdom',
    },
    {
      email: 'issuer3@example.com',
      password: 'Issuer123!',
      first_name: 'James',
      last_name: 'Wilson',
      company_name: 'Future Finance Inc',
      company_registration_number: 'REG345678',
      jurisdiction: 'Singapore',
    },
  ];

  // Create sample investor accounts
  const investorUsers = [
    {
      email: 'investor1@example.com',
      password: 'Investor123!',
      first_name: 'Robert',
      last_name: 'Brown',
      investor_type: 'INDIVIDUAL',
    },
    {
      email: 'investor2@example.com',
      password: 'Investor123!',
      first_name: 'Lisa',
      last_name: 'Anderson',
      investor_type: 'INSTITUTIONAL',
    },
    {
      email: 'investor3@example.com',
      password: 'Investor123!',
      first_name: 'Thomas',
      last_name: 'Taylor',
      investor_type: 'CORPORATE',
    },
  ];

  console.log('Creating/updating admin users...');
  // Create or update admin users
  for (const admin of adminUsers) {
    try {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(admin.password, salt);
  
      const existingUser = await prisma.users.findUnique({
        where: { email: admin.email }
      });
  
      if (existingUser) {
        console.log(`Updating existing admin user: ${admin.email}`);
        await prisma.users.update({
          where: { id: existingUser.id },
          data: { 
            password: password_hash,
            first_name: admin.first_name,
            last_name: admin.last_name,
            is_verified: true
          }
        });
        
        // Check if user has admin role, if not create it
        const existingRole = await prisma.userrole.findFirst({
          where: { 
            user_id: existingUser.id,
            role: 'ADMIN'
          }
        });
        
        if (!existingRole) {
          console.log(`Adding ADMIN role to user: ${admin.email}`);
          await prisma.userrole.create({
            data: {
              user_id: existingUser.id,
              role: 'ADMIN'
            }
          });
        }
        
        // Check if user has admin profile, if not create it
        const existingProfile = await prisma.admin.findUnique({
          where: { user_id: existingUser.id }
        });
        
        if (!existingProfile) {
          console.log(`Creating admin profile for: ${admin.email}`);
          await prisma.admin.create({
            data: {
              user_id: existingUser.id,
              department: admin.department,
              position: admin.position
            }
          });
        }
      } else {
        console.log(`Creating new admin user: ${admin.email}`);
        const newUser = await prisma.users.create({
          data: {
            email: admin.email,
            password: password_hash,
            first_name: admin.first_name,
            last_name: admin.last_name,
            is_verified: true,
            updated_at: new Date(),
            created_at: new Date()
          },
        });
        
        // Create the role separately
        await prisma.userrole.create({
          data: {
            user_id: newUser.id,
            role: 'ADMIN'
          }
        });
        
        // Create admin profile
        await prisma.admin.create({
          data: {
            user_id: newUser.id,
            department: admin.department,
            position: admin.position
          }
        });
      }
    } catch (error) {
      console.error(`Error creating/updating admin user ${admin.email}:`, error);
    }
  }

  console.log('Creating/updating issuer users...');
  // Create or update issuer users
  for (const issuer of issuerUsers) {
    try {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(issuer.password, salt);
  
      const existingUser = await prisma.users.findUnique({
        where: { email: issuer.email }
      });
  
      if (existingUser) {
        console.log(`Updating existing issuer user: ${issuer.email}`);
        await prisma.users.update({
          where: { id: existingUser.id },
          data: { 
            password: password_hash,
            first_name: issuer.first_name,
            last_name: issuer.last_name,
            is_verified: true
          }
        });
        
        // Check if user has issuer role, if not create it
        const existingRole = await prisma.userrole.findFirst({
          where: { 
            user_id: existingUser.id,
            role: 'ISSUER'
          }
        });
        
        if (!existingRole) {
          console.log(`Adding ISSUER role to user: ${issuer.email}`);
          await prisma.userrole.create({
            data: {
              user_id: existingUser.id,
              role: 'ISSUER'
            }
          });
        }
        
        // Check if user has issuer profile, if not create it
        const existingProfile = await prisma.issuer.findUnique({
          where: { user_id: existingUser.id }
        });
        
        if (!existingProfile) {
          console.log(`Creating issuer profile for: ${issuer.email}`);
          await prisma.issuer.create({
            data: {
              user_id: existingUser.id,
              company_name: issuer.company_name,
              company_registration_number: issuer.company_registration_number,
              jurisdiction: issuer.jurisdiction,
              verification_status: true
            }
          });
        }
      } else {
        console.log(`Creating new issuer user: ${issuer.email}`);
        const newUser = await prisma.users.create({
          data: {
            email: issuer.email,
            password: password_hash,
            first_name: issuer.first_name,
            last_name: issuer.last_name,
            is_verified: true,
            updated_at: new Date(),
            created_at: new Date()
          },
        });
        
        // Create the role separately
        await prisma.userrole.create({
          data: {
            user_id: newUser.id,
            role: 'ISSUER'
          }
        });
        
        // Create issuer profile
        await prisma.issuer.create({
          data: {
            user_id: newUser.id,
            company_name: issuer.company_name,
            company_registration_number: issuer.company_registration_number,
            jurisdiction: issuer.jurisdiction,
            verification_status: true
          }
        });
      }
    } catch (error) {
      console.error(`Error creating/updating issuer user ${issuer.email}:`, error);
    }
  }

  console.log('Creating/updating investor users...');
  // Create or update investor users
  for (const investor of investorUsers) {
    try {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(investor.password, salt);
  
      const existingUser = await prisma.users.findUnique({
        where: { email: investor.email }
      });
  
      if (existingUser) {
        console.log(`Updating existing investor user: ${investor.email}`);
        await prisma.users.update({
          where: { id: existingUser.id },
          data: { 
            password: password_hash,
            first_name: investor.first_name,
            last_name: investor.last_name,
            is_verified: true
          }
        });
        
        // Check if user has investor role, if not create it
        const existingRole = await prisma.userrole.findFirst({
          where: { 
            user_id: existingUser.id,
            role: 'INVESTOR'
          }
        });
        
        if (!existingRole) {
          console.log(`Adding INVESTOR role to user: ${investor.email}`);
          await prisma.userrole.create({
            data: {
              user_id: existingUser.id,
              role: 'INVESTOR'
            }
          });
        }
        
        // Check if user has investor profile, if not create it
        const existingProfile = await prisma.investor.findUnique({
          where: { user_id: existingUser.id }
        });
        
        if (!existingProfile) {
          console.log(`Creating investor profile for: ${investor.email}`);
          await prisma.investor.create({
            data: {
              user_id: existingUser.id,
              investor_type: investor.investor_type,
              accreditation_status: 'APPROVED',
              kyc_verified: true,
              aml_verified: true
            }
          });
        }
      } else {
        console.log(`Creating new investor user: ${investor.email}`);
        const newUser = await prisma.users.create({
          data: {
            email: investor.email,
            password: password_hash,
            first_name: investor.first_name,
            last_name: investor.last_name,
            is_verified: true,
            updated_at: new Date(),
            created_at: new Date()
          },
        });
        
        // Create the role separately
        await prisma.userrole.create({
          data: {
            user_id: newUser.id,
            role: 'INVESTOR'
          }
        });
        
        // Create investor profile
        await prisma.investor.create({
          data: {
            user_id: newUser.id,
            investor_type: investor.investor_type,
            accreditation_status: 'APPROVED',
            kyc_verified: true,
            aml_verified: true
          }
        });
      }
    } catch (error) {
      console.error(`Error creating/updating investor user ${investor.email}:`, error);
    }
  }

  console.log('Seed data created/updated successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 