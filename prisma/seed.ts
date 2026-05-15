  import { PrismaClient, UserRole } from '@prisma/client';
  import { Decimal } from '@prisma/client/runtime/library';
  import * as bcrypt from 'bcryptjs';

  const prisma = new PrismaClient();

  function dayStartUtc(isoDate: string): Date {
    return new Date(`${isoDate}T00:00:00.000Z`);
  }

  async function upsertUser(params: {
    email: string;
    fullName: string;
    role: UserRole;
    passwordPlain: string;
  }): Promise<{ id: string }> {
    const passwordHash = await bcrypt.hash(params.passwordPlain, 10);
    return prisma.user.upsert({
      where: { email: params.email },
      create: {
        email: params.email,
        fullName: params.fullName,
        role: params.role,
        passwordHash,
        isActive: true,
      },
      update: {
        fullName: params.fullName,
        role: params.role,
        passwordHash,
        isActive: true,
      },
      select: { id: true },
    });
  }

  async function main(): Promise<void> {
    const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'password123';

    // Categories
    const categories = await Promise.all(
      [
        {
          name: 'Sports Injury Rehab',
          description: 'Recovery programs for sports-related injuries.',
        },
        {
          name: 'Posture & Spine',
          description: 'Posture correction and spine rehabilitation.',
        },
        {
          name: 'Stroke Rehabilitation',
          description: 'Motor function recovery support after stroke.',
        },
      ].map((c) =>
        prisma.category.upsert({
          where: { name: c.name },
          create: c,
          update: { description: c.description },
        }),
      ),
    );

    const categorySports = categories.find((c) => c.name === 'Sports Injury Rehab')!;
    const categoryPosture = categories.find((c) => c.name === 'Posture & Spine')!;

    // Users
    const admin = await upsertUser({
      email: 'admin@demo.local',
      fullName: 'Demo Admin',
      role: UserRole.ADMIN,
      passwordPlain: DEFAULT_PASSWORD,
    });

    const patient1 = await upsertUser({
      email: 'patient1@demo.local',
      fullName: 'Demo Patient 1',
      role: UserRole.PATIENT,
      passwordPlain: DEFAULT_PASSWORD,
    });

    const patient2 = await upsertUser({
      email: 'patient2@demo.local',
      fullName: 'Demo Patient 2',
      role: UserRole.PATIENT,
      passwordPlain: DEFAULT_PASSWORD,
    });

    const therapist1 = await upsertUser({
      email: 'physio1@demo.local',
      fullName: 'Demo Physiotherapist 1',
      role: UserRole.PHYSIOTHERAPIST,
      passwordPlain: DEFAULT_PASSWORD,
    });

    const therapist2 = await upsertUser({
      email: 'physio2@demo.local',
      fullName: 'Demo Physiotherapist 2',
      role: UserRole.PHYSIOTHERAPIST,
      passwordPlain: DEFAULT_PASSWORD,
    });

    // Patient profiles
    await prisma.patientProfile.upsert({
      where: { userId: patient1.id },
      create: {
        userId: patient1.id,
        gender: 'M',
        address: 'Jl. Demo Patient 1 No. 1',
      },
      update: {
        gender: 'M',
        address: 'Jl. Demo Patient 1 No. 1',
      },
    });

    await prisma.patientProfile.upsert({
      where: { userId: patient2.id },
      create: {
        userId: patient2.id,
        gender: 'F',
        address: 'Jl. Demo Patient 2 No. 2',
      },
      update: {
        gender: 'F',
        address: 'Jl. Demo Patient 2 No. 2',
      },
    });

    // Physiotherapist profiles (approved)
    const physioProfile1 = await prisma.physiotherapistProfile.upsert({
      where: { userId: therapist1.id },
      create: {
        userId: therapist1.id,
        categoryId: categorySports.id,
        bio: 'Focused on sports injury recovery and return-to-play programs.',
        education: 'BSc Physiotherapy',
        experienceYears: 5,
        consultationFee: new Decimal('250000.00'),
        visitFee: new Decimal('280000.00'),
        clinicAddress: 'Klinik Demo Sports Rehab, Jakarta',
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
      update: {
        categoryId: categorySports.id,
        bio: 'Focused on sports injury recovery and return-to-play programs.',
        education: 'BSc Physiotherapy',
        experienceYears: 5,
        consultationFee: new Decimal('250000.00'),
        visitFee: new Decimal('280000.00'),
        clinicAddress: 'Klinik Demo Sports Rehab, Jakarta',
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
    });

    const physioProfile2 = await prisma.physiotherapistProfile.upsert({
      where: { userId: therapist2.id },
      create: {
        userId: therapist2.id,
        categoryId: categoryPosture.id,
        bio: 'Posture correction and spine mobility improvement.',
        education: 'D4 Physiotherapy',
        experienceYears: 3,
        consultationFee: new Decimal('200000.00'),
        visitFee: new Decimal('220000.00'),
        clinicAddress: 'Klinik Demo Posture Center, Bandung',
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
      update: {
        categoryId: categoryPosture.id,
        bio: 'Posture correction and spine mobility improvement.',
        education: 'D4 Physiotherapy',
        experienceYears: 3,
        consultationFee: new Decimal('200000.00'),
        visitFee: new Decimal('220000.00'),
        clinicAddress: 'Klinik Demo Posture Center, Bandung',
        verificationStatus: 'APPROVED',
        verifiedAt: new Date(),
      },
    });

    // Availability slots (delete old demo slots in the future range to keep seed deterministic)
    const seedDays = ['2099-12-30', '2099-12-31'];
    await prisma.availabilitySlot.deleteMany({
      where: {
        slotDate: { in: seedDays.map(dayStartUtc) },
        physiotherapistId: { in: [physioProfile1.id, physioProfile2.id] },
      },
    });

    const slots = [
      // physio 1
      {
        physiotherapistId: physioProfile1.id,
        slotDate: dayStartUtc('2099-12-30'),
        startTime: new Date('2099-12-30T09:00:00.000Z'),
        endTime: new Date('2099-12-30T10:00:00.000Z'),
      },
      {
        physiotherapistId: physioProfile1.id,
        slotDate: dayStartUtc('2099-12-30'),
        startTime: new Date('2099-12-30T10:00:00.000Z'),
        endTime: new Date('2099-12-30T11:00:00.000Z'),
      },
      // physio 2
      {
        physiotherapistId: physioProfile2.id,
        slotDate: dayStartUtc('2099-12-31'),
        startTime: new Date('2099-12-31T09:00:00.000Z'),
        endTime: new Date('2099-12-31T10:00:00.000Z'),
      },
      {
        physiotherapistId: physioProfile2.id,
        slotDate: dayStartUtc('2099-12-31'),
        startTime: new Date('2099-12-31T13:00:00.000Z'),
        endTime: new Date('2099-12-31T14:00:00.000Z'),
      },
    ];

    await prisma.availabilitySlot.createMany({
      data: slots.map((s) => ({ ...s, isAvailable: true })),
      skipDuplicates: true,
    });

    // Seed a few system notifications to make /notifications/me non-empty on demo accounts.
    await prisma.notification.createMany({
      data: [
        {
          userId: admin.id,
          title: 'Demo Setup',
          body: 'Seeded demo accounts are ready.',
        },
        {
          userId: patient1.id,
          title: 'Welcome',
          body: 'Welcome to the demo app. Try browsing physiotherapists and booking a slot.',
        },
        {
          userId: therapist1.id,
          title: 'Welcome',
          body: 'Your therapist profile is approved in demo seed.',
        },
      ],
      skipDuplicates: true,
    });

    // eslint-disable-next-line no-console
    console.log('Seed completed.');
    // eslint-disable-next-line no-console
    console.log('Demo accounts (password = SEED_DEFAULT_PASSWORD or "password123")');
    // eslint-disable-next-line no-console
    console.log('- admin@demo.local (ADMIN)');
    // eslint-disable-next-line no-console
    console.log('- patient1@demo.local (PATIENT)');
    // eslint-disable-next-line no-console
    console.log('- patient2@demo.local (PATIENT)');
    // eslint-disable-next-line no-console
    console.log('- physio1@demo.local (PHYSIOTHERAPIST, APPROVED)');
    // eslint-disable-next-line no-console
    console.log('- physio2@demo.local (PHYSIOTHERAPIST, APPROVED)');
  }

  main()
    .catch(async (e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });

