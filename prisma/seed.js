const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  await prisma.refreshToken.deleteMany({});
  await prisma.authProvider.deleteMany({});
  await prisma.userRole.deleteMany({});
  await prisma.admin.deleteMany({});
  await prisma.issuer.deleteMany({});
  await prisma.investor.deleteMany({});
  await prisma.user.deleteMany({});

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

  console.log('Creating admin users...');
  // Create admin users
  for (const admin of adminUsers) {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(admin.password, salt);

    await prisma.user.create({
      data: {
        email: admin.email,
        password_hash,
        first_name: admin.first_name,
        last_name: admin.last_name,
        email_verified: true,
        roles: {
          create: {
            role: 'ADMIN',
          },
        },
        admin: {
          create: {
            department: admin.department,
            position: admin.position,
          },
        },
      },
    });
  }

  console.log('Creating issuer users...');
  // Create issuer users
  for (const issuer of issuerUsers) {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(issuer.password, salt);

    await prisma.user.create({
      data: {
        email: issuer.email,
        password_hash,
        first_name: issuer.first_name,
        last_name: issuer.last_name,
        email_verified: true,
        roles: {
          create: {
            role: 'ISSUER',
          },
        },
        issuer: {
          create: {
            company_name: issuer.company_name,
            company_registration_number: issuer.company_registration_number,
            jurisdiction: issuer.jurisdiction,
            verification_status: true,
          },
        },
      },
    });
  }

  console.log('Creating investor users...');
  // Create investor users
  for (const investor of investorUsers) {
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(investor.password, salt);

    await prisma.user.create({
      data: {
        email: investor.email,
        password_hash,
        first_name: investor.first_name,
        last_name: investor.last_name,
        email_verified: true,
        roles: {
          create: {
            role: 'INVESTOR',
          },
        },
        investor: {
          create: {
            investor_type: investor.investor_type,
            accreditation_status: 'APPROVED',
            kyc_verified: true,
            aml_verified: true,
          },
        },
      },
    });
  }

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 