import { PrismaClient, UserRole, DayOfWeek, ScopeType, VerificationStatus } from '../generated';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // ============================================
  // REGIONS
  // ============================================
  const yorkRegion = await prisma.region.upsert({
    where: { code: 'YORK_REGION' },
    update: {},
    create: {
      name: 'York Region',
      code: 'YORK_REGION',
      description: 'York Region, Ontario - Initial launch market',
      isActive: true,
    },
  });
  console.log('Created region:', yorkRegion.name);

  // ============================================
  // SERVICE CATEGORIES
  // ============================================
  const electricalCategory = await prisma.serviceCategory.upsert({
    where: { code: 'ELECTRICAL' },
    update: {},
    create: {
      name: 'Electrical',
      code: 'ELECTRICAL',
      description: 'Licensed electrical services',
      isActive: true,
    },
  });

  const plumbingCategory = await prisma.serviceCategory.upsert({
    where: { code: 'PLUMBING' },
    update: {},
    create: {
      name: 'Plumbing',
      code: 'PLUMBING',
      description: 'Licensed plumbing services',
      isActive: true,
    },
  });
  console.log('Created service categories');

  // ============================================
  // VERIFICATION CHECKLISTS
  // ============================================
  const verificationDocs = [
    { type: 'LICENSE', name: 'Trade License', expiryRequired: true },
    { type: 'INSURANCE', name: 'Liability Insurance', expiryRequired: true },
    { type: 'WSIB', name: 'WSIB Coverage', expiryRequired: true },
  ];

  for (const cat of [electricalCategory, plumbingCategory]) {
    for (const doc of verificationDocs) {
      await prisma.verificationChecklist.upsert({
        where: {
          serviceCategoryId_documentType: {
            serviceCategoryId: cat.id,
            documentType: doc.type,
          },
        },
        update: {},
        create: {
          serviceCategoryId: cat.id,
          documentType: doc.type,
          name: doc.name,
          description: `Required ${doc.name} for ${cat.name} services`,
          isRequired: true,
          expiryRequired: doc.expiryRequired,
        },
      });
    }
  }
  console.log('Created verification checklists');

  // ============================================
  // FEATURE FLAGS (GLOBAL)
  // ============================================
  const globalFlags = [
    { key: 'DISPATCH_ENABLED', enabled: true, description: 'Enable automatic job dispatch' },
    { key: 'BOOKING_ENABLED', enabled: true, description: 'Enable booking functionality' },
    { key: 'PHONE_AGENT_ENABLED', enabled: false, description: 'Enable AI phone agent' },
    { key: 'REQUIRE_BEFORE_PHOTOS', enabled: true, description: 'Require before photos on job creation' },
    { key: 'REQUIRE_AFTER_PHOTOS', enabled: true, description: 'Require after photos on job completion' },
    { key: 'ENABLE_PREFERRED_CONTRACTOR', enabled: true, description: 'Allow SMBs to save preferred contractors' },
    { key: 'ENABLE_BOOST', enabled: false, description: 'Enable boost campaigns for pros' },
    { key: 'CONSENT_REQUIRED_FOR_RECORDING', enabled: true, description: 'Require consent before call recording' },
    { key: 'PORTFOLIO_OPT_IN_REQUIRED', enabled: true, description: 'Require opt-in for portfolio visibility' },
  ];

  for (const flag of globalFlags) {
    const existing = await prisma.featureFlag.findFirst({
      where: {
        key: flag.key,
        scopeType: ScopeType.GLOBAL,
        regionId: null,
        orgId: null,
        serviceCategoryId: null,
      },
    });
    if (existing) {
      await prisma.featureFlag.update({
        where: { id: existing.id },
        data: { enabled: flag.enabled, description: flag.description },
      });
    } else {
      await prisma.featureFlag.create({
        data: {
          key: flag.key,
          enabled: flag.enabled,
          description: flag.description,
          scopeType: ScopeType.GLOBAL,
        },
      });
    }
  }
  console.log('Created global feature flags');

  // ============================================
  // POLICIES (GLOBAL)
  // ============================================
  const globalPolicies = [
    { key: 'BOOKING_MODE', value: 'EXACT', description: 'Booking mode: EXACT or WINDOW' },
    { key: 'PHONE_AGENT_MODE', value: 'INBOUND_ONLY', description: 'Phone agent mode: INBOUND_ONLY or INBOUND_OUTBOUND' },
    { key: 'SLA_ACCEPT_MINUTES', value: 5, description: 'Minutes for pro to accept dispatch' },
    { key: 'SLA_SCHEDULE_HOURS', value: 24, description: 'Hours to schedule after acceptance' },
    { key: 'SLA_STATUS_UPDATE_HOURS', value: 48, description: 'Hours between required status updates' },
    { key: 'DISPATCH_ESCALATION_STEPS', value: [1, 2, 5], description: 'Pros to dispatch per escalation step' },
    { key: 'IDENTITY_REVEAL_POLICY', value: 'AFTER_ACCEPT_OR_PREFERRED_BOOKING', description: 'When to reveal pro identity' },
    { key: 'VISIBILITY_DEFAULT_PHOTOS', value: 'PRIVATE', description: 'Default photo visibility' },
    { key: 'DATA_RETENTION_DAYS', value: 365, description: 'Days to retain data' },
    { key: 'MAX_DISPATCH_ATTEMPTS', value: 10, description: 'Maximum dispatch attempts per job' },
    { key: 'LEAD_TIME_MINUTES', value: 60, description: 'Minimum booking lead time' },
    { key: 'BUFFER_MINUTES', value: 15, description: 'Buffer between bookings' },
    { key: 'MAX_BOOKINGS_PER_DAY', value: 10, description: 'Maximum bookings per pro per day' },
    { key: 'CANCELLATION_HOURS', value: 24, description: 'Hours before for free cancellation' },
  ];

  for (const policy of globalPolicies) {
    const existing = await prisma.policy.findFirst({
      where: {
        key: policy.key,
        scopeType: ScopeType.GLOBAL,
        regionId: null,
        orgId: null,
        serviceCategoryId: null,
      },
    });
    if (existing) {
      await prisma.policy.update({
        where: { id: existing.id },
        data: { value: policy.value, description: policy.description },
      });
    } else {
      await prisma.policy.create({
        data: {
          key: policy.key,
          value: policy.value,
          description: policy.description,
          scopeType: ScopeType.GLOBAL,
        },
      });
    }
  }
  console.log('Created global policies');

  // ============================================
  // REGION-SPECIFIC POLICIES (YORK REGION)
  // ============================================
  const yorkPolicies = [
    { key: 'SLA_ACCEPT_MINUTES', value: 7, description: 'Extended accept time for York Region' },
    { key: 'MAX_DISPATCH_ATTEMPTS', value: 15, description: 'More attempts for York Region' },
  ];

  for (const policy of yorkPolicies) {
    const existing = await prisma.policy.findFirst({
      where: {
        key: policy.key,
        scopeType: ScopeType.REGION,
        regionId: yorkRegion.id,
        orgId: null,
        serviceCategoryId: null,
      },
    });
    if (existing) {
      await prisma.policy.update({
        where: { id: existing.id },
        data: { value: policy.value, description: policy.description },
      });
    } else {
      await prisma.policy.create({
        data: {
          key: policy.key,
          value: policy.value,
          description: policy.description,
          scopeType: ScopeType.REGION,
          regionId: yorkRegion.id,
        },
      });
    }
  }
  console.log('Created York Region policies');

  // ============================================
  // DECLINE REASONS
  // ============================================
  const declineReasons = [
    { code: 'TOO_FAR', label: 'Location too far', sortOrder: 1 },
    { code: 'NO_AVAILABILITY', label: 'No availability in requested time', sortOrder: 2 },
    { code: 'WORKLOAD', label: 'Current workload too high', sortOrder: 3 },
    { code: 'NOT_MY_SPECIALTY', label: 'Outside my specialty area', sortOrder: 4 },
    { code: 'EQUIPMENT', label: 'Required equipment unavailable', sortOrder: 5 },
    { code: 'EMERGENCY', label: 'Personal/family emergency', sortOrder: 6 },
    { code: 'OTHER', label: 'Other (specify in notes)', sortOrder: 99 },
  ];

  for (const reason of declineReasons) {
    await prisma.declineReason.upsert({
      where: { code: reason.code },
      update: { label: reason.label, sortOrder: reason.sortOrder },
      create: reason,
    });
  }
  console.log('Created decline reasons');

  // ============================================
  // PIPELINE STAGES
  // ============================================
  const pipelineStages = [
    { name: 'New Lead', color: '#3B82F6', sortOrder: 1, isDefault: true },
    { name: 'Contacted', color: '#8B5CF6', sortOrder: 2 },
    { name: 'Quoted', color: '#F59E0B', sortOrder: 3 },
    { name: 'Scheduled', color: '#10B981', sortOrder: 4 },
    { name: 'In Progress', color: '#6366F1', sortOrder: 5 },
    { name: 'Completed', color: '#22C55E', sortOrder: 6 },
    { name: 'On Hold', color: '#EF4444', sortOrder: 7 },
  ];

  for (const stage of pipelineStages) {
    await prisma.pipelineStage.upsert({
      where: { id: stage.name.toLowerCase().replace(' ', '-') },
      update: stage,
      create: {
        id: stage.name.toLowerCase().replace(' ', '-'),
        ...stage,
      },
    });
  }
  console.log('Created pipeline stages');

  // ============================================
  // ADMIN USER
  // ============================================
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@tradesdispatch.com' },
    update: {},
    create: {
      email: 'admin@tradesdispatch.com',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('Created admin user:', adminUser.email);

  // ============================================
  // OPERATOR USER
  // ============================================
  const operatorUser = await prisma.user.upsert({
    where: { email: 'operator@tradesdispatch.com' },
    update: {},
    create: {
      email: 'operator@tradesdispatch.com',
      passwordHash,
      firstName: 'Dispatch',
      lastName: 'Operator',
      role: UserRole.OPERATOR,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('Created operator user:', operatorUser.email);

  // ============================================
  // SAMPLE SMB USER
  // ============================================
  const smbUser = await prisma.user.upsert({
    where: { email: 'smb@example.com' },
    update: {},
    create: {
      email: 'smb@example.com',
      passwordHash,
      firstName: 'John',
      lastName: 'Business',
      phone: '+14165551234',
      role: UserRole.SMB_USER,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log('Created SMB user:', smbUser.email);

  // ============================================
  // SAMPLE ORGANIZATIONS & PRO USERS
  // ============================================
  // York Region center coordinates (approximately Newmarket)
  const yorkCenterLat = 44.0592;
  const yorkCenterLng = -79.4614;

  // Electrical Pros
  const electricalPros = [
    { name: 'Spark Electric', lat: 44.0498, lng: -79.4680, radius: 25, email: 'pro.electric1@example.com' },
    { name: 'PowerUp Solutions', lat: 44.0721, lng: -79.4312, radius: 20, email: 'pro.electric2@example.com' },
    { name: 'Circuit Masters', lat: 43.9756, lng: -79.5428, radius: 30, email: 'pro.electric3@example.com' },
    { name: 'Voltage Pro', lat: 44.1024, lng: -79.3891, radius: 15, email: 'pro.electric4@example.com' },
    { name: 'WireWorks Inc', lat: 44.0312, lng: -79.5102, radius: 22, email: 'pro.electric5@example.com' },
  ];

  // Plumbing Pros
  const plumbingPros = [
    { name: 'FlowRight Plumbing', lat: 44.0632, lng: -79.4521, radius: 25, email: 'pro.plumb1@example.com' },
    { name: 'DrainMaster Pro', lat: 44.0412, lng: -79.4892, radius: 20, email: 'pro.plumb2@example.com' },
    { name: 'PipeFix Solutions', lat: 43.9921, lng: -79.5012, radius: 28, email: 'pro.plumb3@example.com' },
    { name: 'AquaTech Services', lat: 44.0856, lng: -79.4123, radius: 18, email: 'pro.plumb4@example.com' },
    { name: 'Premier Plumbing', lat: 44.0189, lng: -79.4734, radius: 24, email: 'pro.plumb5@example.com' },
  ];

  const serviceHoursTemplate = [
    { day: DayOfWeek.MONDAY, start: '08:00', end: '17:00' },
    { day: DayOfWeek.TUESDAY, start: '08:00', end: '17:00' },
    { day: DayOfWeek.WEDNESDAY, start: '08:00', end: '17:00' },
    { day: DayOfWeek.THURSDAY, start: '08:00', end: '17:00' },
    { day: DayOfWeek.FRIDAY, start: '08:00', end: '17:00' },
    { day: DayOfWeek.SATURDAY, start: '09:00', end: '14:00' },
  ];

  // Create Electrical Pros
  for (let i = 0; i < electricalPros.length; i++) {
    const pro = electricalPros[i];

    // Create Organization
    const org = await prisma.org.create({
      data: {
        name: pro.name,
        legalName: `${pro.name} Ltd.`,
        email: pro.email,
        city: 'York Region',
        province: 'ON',
        country: 'CA',
      },
    });

    // Create Pro User
    const user = await prisma.user.upsert({
      where: { email: pro.email },
      update: {},
      create: {
        email: pro.email,
        passwordHash,
        firstName: pro.name.split(' ')[0],
        lastName: 'Pro',
        phone: `+1416555${1000 + i}`,
        role: UserRole.PRO_USER,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Create OrgMember
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: 'owner',
      },
    });

    // Create ProProfile
    const proProfile = await prisma.proProfile.create({
      data: {
        userId: user.id,
        orgId: org.id,
        regionId: yorkRegion.id,
        businessName: pro.name,
        businessEmail: pro.email,
        businessPhone: `+1416555${1000 + i}`,
        bio: `Professional electrical services in York Region. ${10 + i} years of experience.`,
        yearsExperience: 10 + i,
        verificationStatus: i < 3 ? VerificationStatus.APPROVED : VerificationStatus.PENDING,
        verifiedAt: i < 3 ? new Date() : null,
        avgResponseMinutes: 3 + Math.random() * 5,
        completionRate: 0.9 + Math.random() * 0.1,
        totalJobsCompleted: Math.floor(50 + Math.random() * 100),
        serviceCategories: {
          connect: { id: electricalCategory.id },
        },
      },
    });

    // Create ServiceArea
    await prisma.serviceArea.create({
      data: {
        proProfileId: proProfile.id,
        centerLat: pro.lat,
        centerLng: pro.lng,
        radiusKm: pro.radius,
      },
    });

    // Create ServiceHours
    for (const hours of serviceHoursTemplate) {
      await prisma.serviceHours.create({
        data: {
          proProfileId: proProfile.id,
          dayOfWeek: hours.day,
          startTime: hours.start,
          endTime: hours.end,
        },
      });
    }

    // Create AvailabilityRules
    for (const hours of serviceHoursTemplate) {
      await prisma.availabilityRule.create({
        data: {
          proProfileId: proProfile.id,
          dayOfWeek: hours.day,
          slots: [
            { startTime: hours.start, endTime: '12:00' },
            { startTime: '13:00', endTime: hours.end },
          ],
        },
      });
    }
  }
  console.log('Created electrical pros');

  // Create Plumbing Pros
  for (let i = 0; i < plumbingPros.length; i++) {
    const pro = plumbingPros[i];

    // Create Organization
    const org = await prisma.org.create({
      data: {
        name: pro.name,
        legalName: `${pro.name} Ltd.`,
        email: pro.email,
        city: 'York Region',
        province: 'ON',
        country: 'CA',
      },
    });

    // Create Pro User
    const user = await prisma.user.upsert({
      where: { email: pro.email },
      update: {},
      create: {
        email: pro.email,
        passwordHash,
        firstName: pro.name.split(' ')[0],
        lastName: 'Pro',
        phone: `+1416555${2000 + i}`,
        role: UserRole.PRO_USER,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });

    // Create OrgMember
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        userId: user.id,
        role: 'owner',
      },
    });

    // Create ProProfile
    const proProfile = await prisma.proProfile.create({
      data: {
        userId: user.id,
        orgId: org.id,
        regionId: yorkRegion.id,
        businessName: pro.name,
        businessEmail: pro.email,
        businessPhone: `+1416555${2000 + i}`,
        bio: `Professional plumbing services in York Region. ${8 + i} years of experience.`,
        yearsExperience: 8 + i,
        verificationStatus: i < 3 ? VerificationStatus.APPROVED : VerificationStatus.PENDING,
        verifiedAt: i < 3 ? new Date() : null,
        avgResponseMinutes: 4 + Math.random() * 6,
        completionRate: 0.88 + Math.random() * 0.12,
        totalJobsCompleted: Math.floor(40 + Math.random() * 80),
        serviceCategories: {
          connect: { id: plumbingCategory.id },
        },
      },
    });

    // Create ServiceArea
    await prisma.serviceArea.create({
      data: {
        proProfileId: proProfile.id,
        centerLat: pro.lat,
        centerLng: pro.lng,
        radiusKm: pro.radius,
      },
    });

    // Create ServiceHours (different hours for plumbers)
    const plumbingHours = [
      { day: DayOfWeek.MONDAY, start: '07:00', end: '18:00' },
      { day: DayOfWeek.TUESDAY, start: '07:00', end: '18:00' },
      { day: DayOfWeek.WEDNESDAY, start: '07:00', end: '18:00' },
      { day: DayOfWeek.THURSDAY, start: '07:00', end: '18:00' },
      { day: DayOfWeek.FRIDAY, start: '07:00', end: '16:00' },
    ];

    for (const hours of plumbingHours) {
      await prisma.serviceHours.create({
        data: {
          proProfileId: proProfile.id,
          dayOfWeek: hours.day,
          startTime: hours.start,
          endTime: hours.end,
        },
      });
    }

    // Create AvailabilityRules
    for (const hours of plumbingHours) {
      await prisma.availabilityRule.create({
        data: {
          proProfileId: proProfile.id,
          dayOfWeek: hours.day,
          slots: [
            { startTime: hours.start, endTime: '12:00' },
            { startTime: '12:30', endTime: hours.end },
          ],
        },
      });
    }
  }
  console.log('Created plumbing pros');

  // ============================================
  // JOB TEMPLATES
  // ============================================
  const jobTemplates = [
    {
      name: 'Electrical Panel Upgrade',
      categoryCode: 'ELECTRICAL',
      templateContent: {
        title: 'Electrical Panel Upgrade',
        description: 'Upgrade electrical panel to higher amperage',
        checklistItems: ['Inspect current panel', 'Determine new capacity needs', 'Obtain permits', 'Install new panel', 'Final inspection'],
        estimatedHours: 6,
      },
      estimatedDuration: 360,
    },
    {
      name: 'Outlet Installation',
      categoryCode: 'ELECTRICAL',
      templateContent: {
        title: 'New Outlet Installation',
        description: 'Install new electrical outlet(s)',
        checklistItems: ['Locate power source', 'Run wiring', 'Install outlet box', 'Connect wiring', 'Test'],
        estimatedHours: 2,
      },
      estimatedDuration: 120,
    },
    {
      name: 'Drain Cleaning',
      categoryCode: 'PLUMBING',
      templateContent: {
        title: 'Drain Cleaning Service',
        description: 'Clear blocked drains and pipes',
        checklistItems: ['Diagnose blockage', 'Use appropriate clearing method', 'Test drainage', 'Provide maintenance tips'],
        estimatedHours: 1.5,
      },
      estimatedDuration: 90,
    },
    {
      name: 'Water Heater Installation',
      categoryCode: 'PLUMBING',
      templateContent: {
        title: 'Water Heater Installation',
        description: 'Install new water heater unit',
        checklistItems: ['Remove old unit', 'Prepare connections', 'Install new heater', 'Connect plumbing', 'Test operation'],
        estimatedHours: 4,
      },
      estimatedDuration: 240,
    },
    {
      name: 'Fixture Replacement',
      categoryCode: 'PLUMBING',
      templateContent: {
        title: 'Plumbing Fixture Replacement',
        description: 'Replace faucet, toilet, or other fixture',
        checklistItems: ['Shut off water', 'Remove old fixture', 'Prepare connections', 'Install new fixture', 'Test for leaks'],
        estimatedHours: 2,
      },
      estimatedDuration: 120,
    },
  ];

  for (const template of jobTemplates) {
    await prisma.jobTemplate.upsert({
      where: { id: template.name.toLowerCase().replace(/ /g, '-') },
      update: template,
      create: {
        id: template.name.toLowerCase().replace(/ /g, '-'),
        ...template,
      },
    });
  }
  console.log('Created job templates');

  // ============================================
  // BOOKING POLICIES
  // ============================================
  await prisma.bookingPolicy.upsert({
    where: { id: 'global-default' },
    update: {},
    create: {
      id: 'global-default',
      scopeType: ScopeType.GLOBAL,
      leadTimeMinutes: 60,
      bufferMinutes: 15,
      maxPerDay: 10,
      cancellationHours: 24,
    },
  });
  console.log('Created booking policies');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
