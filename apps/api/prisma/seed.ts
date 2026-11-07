import { PrismaClient, SystemRole, TicketPriority, TicketStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for NEXUS AI...');

  // 1. Seed Permissions
  const permissionsList = [
    { key: 'org:manage', module: 'Organization', description: 'Manage organization settings and billing' },
    { key: 'users:manage', module: 'Users', description: 'Invite, edit, and deactivate users' },
    { key: 'tickets:read', module: 'Tickets', description: 'View tickets and conversations' },
    { key: 'tickets:write', module: 'Tickets', description: 'Create, edit, and reply to tickets' },
    { key: 'tickets:assign', module: 'Tickets', description: 'Assign tickets to agents' },
    { key: 'knowledge:read', module: 'Knowledge', description: 'Search and ask questions on internal documents' },
    { key: 'knowledge:manage', module: 'Knowledge', description: 'Upload, delete, and manage documents' },
    { key: 'ai:suggest', module: 'AI', description: 'View and use AI recommendations' },
    { key: 'ai:approve', module: 'AI', description: 'Approve or reject sensitive AI actions' },
    { key: 'analytics:view', module: 'Analytics', description: 'Access organization analytics dashboards' },
    { key: 'audit:view', module: 'Audit', description: 'View compliance and audit logs' },
  ];

  console.log('  -> Seeding system permissions...');
  for (const perm of permissionsList) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {},
      create: perm,
    });
  }

  // 2. Seed Demo Organization
  console.log('  -> Seeding demo organization (Acme Corp)...');
  const org = await prisma.organization.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme',
      domain: 'acme.com',
      settings: {
        aiAutoClassification: true,
        aiAutoReplyDrafts: true,
        requireApprovalForPlanChanges: true,
      },
    },
  });

  // 3. Seed Users
  console.log('  -> Seeding demo users...');
  const defaultPasswordHash = await argon2.hash('Password123!');

  // Super Admin / Org Owner
  const owner = await prisma.user.upsert({
    where: { email: 'owner@acme.com' },
    update: {},
    create: {
      email: 'owner@acme.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Alex',
      lastName: 'Owner',
      isSuperAdmin: true,
      isEmailVerified: true,
    },
  });

  // Support Agent
  const agent = await prisma.user.upsert({
    where: { email: 'agent@acme.com' },
    update: {},
    create: {
      email: 'agent@acme.com',
      passwordHash: defaultPasswordHash,
      firstName: 'Sarah',
      lastName: 'Agent',
      isEmailVerified: true,
    },
  });

  // 4. Link Users to Organization
  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: owner.id,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      userId: owner.id,
      systemRole: SystemRole.ORG_OWNER,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: agent.id,
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      userId: agent.id,
      systemRole: SystemRole.SUPPORT_AGENT,
    },
  });

  // 5. Seed Demo Customer
  console.log('  -> Seeding demo customer...');
  const customer = await prisma.customer.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: 'customer@example.com',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      email: 'customer@example.com',
      name: 'John Doe',
      phoneNumber: '+1-555-0199',
      metadata: { plan: 'Pro', tier: 'Gold' },
    },
  });

  // 6. Seed Sample Ticket
  console.log('  -> Seeding demo ticket...');
  const existingTicket = await prisma.ticket.findFirst({
    where: { organizationId: org.id, customerId: customer.id },
  });

  if (!existingTicket) {
    const ticket = await prisma.ticket.create({
      data: {
        organizationId: org.id,
        customerId: customer.id,
        subject: 'Cannot access my pro features after upgrade',
        description: 'I recently upgraded to Pro plan but my dashboard still shows the free tier limitations.',
        category: 'Billing & Account',
        priority: TicketPriority.HIGH,
        status: TicketStatus.OPEN,
        messages: {
          create: [
            {
              senderType: 'CUSTOMER',
              content: 'I recently upgraded to Pro plan but my dashboard still shows the free tier limitations. Please help!',
            },
          ],
        },
        events: {
          create: [
            {
              eventType: 'TICKET_CREATED',
              metadata: { source: 'customer_portal' },
            },
          ],
        },
      },
    });

    console.log(`  -> Demo ticket #${ticket.ticketNumber} created successfully.`);
  }

  console.log('✅ Database seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
