import {
  AppointmentType,
  BookingStatus,
  ConsultationSlaTier,
  ConsultationStatus,
  PaymentMethod,
  PrismaClient,
  TherapistVerificationStatus,
  TransactionStatus,
  UserRole,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Fixed IDs so re-running seed upserts demo rows without duplicates. */
const DEMO = {
  consultRequested: 'a1000001-0001-4001-8001-000000000001',
  consultAccepted: 'a1000002-0001-4001-8001-000000000002',
  consultInProgress: 'a1000003-0001-4001-8001-000000000003',
  consultCompleted: 'a1000004-0001-4001-8001-000000000004',
  conversation: 'c3000001-0003-4003-8003-000000000001',
  bookingPending: 'b2000001-0002-4002-8002-000000000001',
  bookingCompleted: 'b2000002-0002-4002-8002-000000000002',
  txConsultPaid: 'd4000001-0004-4004-8004-000000000001',
  txConsultPending: 'd4000002-0004-4004-8004-000000000002',
  txBookingPending: 'd4000003-0004-4004-8004-000000000003',
} as const;

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
  const onlineUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);

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
  const categoryStroke = categories.find((c) => c.name === 'Stroke Rehabilitation')!;

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

  const therapist3 = await upsertUser({
    email: 'physio3@demo.local',
    fullName: 'Demo Physiotherapist 3 (Pending)',
    role: UserRole.PHYSIOTHERAPIST,
    passwordPlain: DEFAULT_PASSWORD,
  });

  const patientProfile1 = await prisma.patientProfile.upsert({
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

  const patientProfile2 = await prisma.patientProfile.upsert({
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
      verificationStatus: TherapistVerificationStatus.APPROVED,
      verifiedAt: new Date(),
      onlineUntil,
    },
    update: {
      categoryId: categorySports.id,
      bio: 'Focused on sports injury recovery and return-to-play programs.',
      education: 'BSc Physiotherapy',
      experienceYears: 5,
      consultationFee: new Decimal('250000.00'),
      visitFee: new Decimal('280000.00'),
      clinicAddress: 'Klinik Demo Sports Rehab, Jakarta',
      verificationStatus: TherapistVerificationStatus.APPROVED,
      verifiedAt: new Date(),
      onlineUntil,
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
      verificationStatus: TherapistVerificationStatus.APPROVED,
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
      verificationStatus: TherapistVerificationStatus.APPROVED,
      verifiedAt: new Date(),
    },
  });

  await prisma.physiotherapistProfile.upsert({
    where: { userId: therapist3.id },
    create: {
      userId: therapist3.id,
      categoryId: categoryStroke.id,
      bio: 'Awaiting admin verification — demo pending profile.',
      education: 'MSc Neurological Physiotherapy',
      experienceYears: 4,
      consultationFee: new Decimal('180000.00'),
      visitFee: new Decimal('200000.00'),
      clinicAddress: 'Klinik Demo Stroke Care, Surabaya',
      verificationStatus: TherapistVerificationStatus.PENDING,
      verifiedAt: null,
      rejectionReason: null,
    },
    update: {
      categoryId: categoryStroke.id,
      bio: 'Awaiting admin verification — demo pending profile.',
      education: 'MSc Neurological Physiotherapy',
      experienceYears: 4,
      consultationFee: new Decimal('180000.00'),
      visitFee: new Decimal('200000.00'),
      clinicAddress: 'Klinik Demo Stroke Care, Surabaya',
      verificationStatus: TherapistVerificationStatus.PENDING,
      verifiedAt: null,
      rejectionReason: null,
    },
  });

  const seedDays = ['2099-12-30', '2099-12-31'];
  await prisma.availabilitySlot.deleteMany({
    where: {
      slotDate: { in: seedDays.map(dayStartUtc) },
      physiotherapistId: { in: [physioProfile1.id, physioProfile2.id] },
    },
  });

  const slots = [
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

  const slotPhysio2Morning = await prisma.availabilitySlot.findFirstOrThrow({
    where: {
      physiotherapistId: physioProfile2.id,
      startTime: new Date('2099-12-31T09:00:00.000Z'),
    },
  });

  const now = new Date();
  const acceptedAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const startedAt = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const completedAt = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  // Reset payment rows E2E may have created outside fixed demo transaction IDs.
  await prisma.transaction.deleteMany({
    where: { consultationId: DEMO.consultRequested },
  });
  await prisma.transaction.deleteMany({
    where: {
      consultationId: DEMO.consultAccepted,
      id: { not: DEMO.txConsultPending },
    },
  });

  await prisma.consultation.upsert({
    where: { id: DEMO.consultRequested },
    create: {
      id: DEMO.consultRequested,
      patientId: patientProfile1.id,
      physiotherapistId: physioProfile1.id,
      complaint: 'DEMO: Nyeri lutut setelah lari — menunggu persetujuan terapis.',
      status: ConsultationStatus.REQUESTED,
      feeSnapshot: physioProfile1.consultationFee,
      slaTier: ConsultationSlaTier.STANDARD,
    },
    update: {
      patientId: patientProfile1.id,
      physiotherapistId: physioProfile1.id,
      complaint: 'DEMO: Nyeri lutut setelah lari — menunggu persetujuan terapis.',
      status: ConsultationStatus.REQUESTED,
      feeSnapshot: physioProfile1.consultationFee,
      acceptedAt: null,
      startedAt: null,
      completedAt: null,
    },
  });

  await prisma.consultation.upsert({
    where: { id: DEMO.consultAccepted },
    create: {
      id: DEMO.consultAccepted,
      patientId: patientProfile2.id,
      physiotherapistId: physioProfile1.id,
      complaint: 'DEMO: Punggung bawah kaku — disetujui, siap bayar.',
      status: ConsultationStatus.ACCEPTED,
      feeSnapshot: physioProfile1.consultationFee,
      slaTier: ConsultationSlaTier.STANDARD,
      acceptedAt,
    },
    update: {
      patientId: patientProfile2.id,
      physiotherapistId: physioProfile1.id,
      complaint: 'DEMO: Punggung bawah kaku — disetujui, siap bayar.',
      status: ConsultationStatus.ACCEPTED,
      feeSnapshot: physioProfile1.consultationFee,
      acceptedAt,
      startedAt: null,
      completedAt: null,
    },
  });

  await prisma.consultation.upsert({
    where: { id: DEMO.consultInProgress },
    create: {
      id: DEMO.consultInProgress,
      patientId: patientProfile1.id,
      physiotherapistId: physioProfile2.id,
      complaint: 'DEMO: Bahu kanan terbatas gerak — sesi chat aktif.',
      status: ConsultationStatus.IN_PROGRESS,
      feeSnapshot: physioProfile2.consultationFee,
      slaTier: ConsultationSlaTier.STANDARD,
      acceptedAt,
      startedAt,
    },
    update: {
      patientId: patientProfile1.id,
      physiotherapistId: physioProfile2.id,
      complaint: 'DEMO: Bahu kanan terbatas gerak — sesi chat aktif.',
      status: ConsultationStatus.IN_PROGRESS,
      feeSnapshot: physioProfile2.consultationFee,
      acceptedAt,
      startedAt,
      completedAt: null,
    },
  });

  await prisma.transaction.upsert({
    where: { id: DEMO.txConsultPending },
    create: {
      id: DEMO.txConsultPending,
      consultationId: DEMO.consultAccepted,
      patientId: patientProfile2.id,
      amount: physioProfile1.consultationFee,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      status: TransactionStatus.PENDING,
      paymentProofUrl: 'https://example.com/demo/payment-proof-consultation-pending.png',
    },
    update: {
      consultationId: DEMO.consultAccepted,
      bookingId: null,
      patientId: patientProfile2.id,
      amount: physioProfile1.consultationFee,
      paymentMethod: PaymentMethod.BANK_TRANSFER,
      status: TransactionStatus.PENDING,
      paymentProofUrl: 'https://example.com/demo/payment-proof-consultation-pending.png',
      paidAt: null,
      refundedAt: null,
    },
  });

  await prisma.transaction.upsert({
    where: { id: DEMO.txConsultPaid },
    create: {
      id: DEMO.txConsultPaid,
      consultationId: DEMO.consultInProgress,
      patientId: patientProfile1.id,
      amount: physioProfile2.consultationFee,
      paymentMethod: PaymentMethod.E_WALLET,
      status: TransactionStatus.PAID,
      paymentProofUrl: 'https://example.com/demo/payment-proof-consultation-paid.png',
      paidAt: startedAt,
    },
    update: {
      consultationId: DEMO.consultInProgress,
      bookingId: null,
      patientId: patientProfile1.id,
      amount: physioProfile2.consultationFee,
      paymentMethod: PaymentMethod.E_WALLET,
      status: TransactionStatus.PAID,
      paymentProofUrl: 'https://example.com/demo/payment-proof-consultation-paid.png',
      paidAt: startedAt,
      refundedAt: null,
    },
  });

  await prisma.booking.upsert({
    where: { id: DEMO.bookingPending },
    create: {
      id: DEMO.bookingPending,
      patientId: patientProfile2.id,
      physiotherapistId: physioProfile2.id,
      slotId: slotPhysio2Morning.id,
      appointmentType: AppointmentType.CLINIC_VISIT,
      appointmentDate: slotPhysio2Morning.startTime,
      visitFeeSnapshot: physioProfile2.visitFee,
      clinicAddress: physioProfile2.clinicAddress,
      notes: 'DEMO: Kunjungan klinik — menunggu konfirmasi & pembayaran.',
      status: BookingStatus.PENDING,
    },
    update: {
      patientId: patientProfile2.id,
      physiotherapistId: physioProfile2.id,
      slotId: slotPhysio2Morning.id,
      appointmentType: AppointmentType.CLINIC_VISIT,
      appointmentDate: slotPhysio2Morning.startTime,
      visitFeeSnapshot: physioProfile2.visitFee,
      clinicAddress: physioProfile2.clinicAddress,
      notes: 'DEMO: Kunjungan klinik — menunggu konfirmasi & pembayaran.',
      status: BookingStatus.PENDING,
    },
  });

  await prisma.availabilitySlot.update({
    where: { id: slotPhysio2Morning.id },
    data: { isAvailable: false },
  });

  await prisma.transaction.upsert({
    where: { id: DEMO.txBookingPending },
    create: {
      id: DEMO.txBookingPending,
      bookingId: DEMO.bookingPending,
      patientId: patientProfile2.id,
      amount: physioProfile2.visitFee,
      paymentMethod: PaymentMethod.QRIS,
      status: TransactionStatus.PENDING,
      paymentProofUrl: '/uploads/payment-proofs/demo-booking-pending.png',
    },
    update: {
      bookingId: DEMO.bookingPending,
      consultationId: null,
      patientId: patientProfile2.id,
      amount: physioProfile2.visitFee,
      paymentMethod: PaymentMethod.QRIS,
      status: TransactionStatus.PENDING,
      paymentProofUrl: '/uploads/payment-proofs/demo-booking-pending.png',
      paidAt: null,
      refundedAt: null,
    },
  });

  await prisma.consultation.upsert({
    where: { id: DEMO.consultCompleted },
    create: {
      id: DEMO.consultCompleted,
      patientId: patientProfile1.id,
      physiotherapistId: physioProfile1.id,
      complaint: 'DEMO: Nyeri pergelangan — konsultasi online selesai, siap diulas.',
      status: ConsultationStatus.COMPLETED,
      feeSnapshot: physioProfile1.consultationFee,
      acceptedAt: completedAt,
      startedAt: completedAt,
      completedAt: completedAt,
    },
    update: {
      patientId: patientProfile1.id,
      physiotherapistId: physioProfile1.id,
      complaint: 'DEMO: Nyeri pergelangan — konsultasi online selesai, siap diulas.',
      status: ConsultationStatus.COMPLETED,
      feeSnapshot: physioProfile1.consultationFee,
      acceptedAt: completedAt,
      startedAt: completedAt,
      completedAt: completedAt,
    },
  });

  await prisma.booking.upsert({
    where: { id: DEMO.bookingCompleted },
    create: {
      id: DEMO.bookingCompleted,
      patientId: patientProfile1.id,
      physiotherapistId: physioProfile1.id,
      appointmentType: AppointmentType.HOME_VISIT,
      appointmentDate: completedAt,
      visitFeeSnapshot: physioProfile1.visitFee,
      homeVisitAddress: 'Jl. Demo Patient 1 No. 1, Jakarta',
      notes: 'DEMO: Kunjungan rumah selesai — bisa ditinjau.',
      status: BookingStatus.COMPLETED,
    },
    update: {
      patientId: patientProfile1.id,
      physiotherapistId: physioProfile1.id,
      appointmentType: AppointmentType.HOME_VISIT,
      appointmentDate: completedAt,
      visitFeeSnapshot: physioProfile1.visitFee,
      homeVisitAddress: 'Jl. Demo Patient 1 No. 1, Jakarta',
      notes: 'DEMO: Kunjungan rumah selesai — bisa ditinjau.',
      status: BookingStatus.COMPLETED,
    },
  });

  await prisma.review.upsert({
    where: {
      bookingId_patientId: {
        bookingId: DEMO.bookingCompleted,
        patientId: patientProfile1.id,
      },
    },
    create: {
      bookingId: DEMO.bookingCompleted,
      patientId: patientProfile1.id,
      physiotherapistId: physioProfile1.id,
      rating: 5,
      comment: 'DEMO: Terapis sangat membantu, program latihan jelas.',
      isHidden: false,
    },
    update: {
      physiotherapistId: physioProfile1.id,
      rating: 5,
      comment: 'DEMO: Terapis sangat membantu, program latihan jelas.',
      isHidden: false,
      moderationNote: null,
    },
  });

  await prisma.conversation.upsert({
    where: { id: DEMO.conversation },
    create: {
      id: DEMO.conversation,
      consultationId: DEMO.consultInProgress,
    },
    update: {
      consultationId: DEMO.consultInProgress,
    },
  });

  await prisma.conversationParticipant.upsert({
    where: {
      conversationId_userId: {
        conversationId: DEMO.conversation,
        userId: patient1.id,
      },
    },
    create: {
      conversationId: DEMO.conversation,
      userId: patient1.id,
    },
    update: {},
  });

  await prisma.conversationParticipant.upsert({
    where: {
      conversationId_userId: {
        conversationId: DEMO.conversation,
        userId: therapist2.id,
      },
    },
    create: {
      conversationId: DEMO.conversation,
      userId: therapist2.id,
    },
    update: {},
  });

  const existingDemoMessage = await prisma.message.findFirst({
    where: {
      conversationId: DEMO.conversation,
      content: 'DEMO: Halo, saya sudah mulai latihan bahu sesuai saran Anda.',
    },
  });
  if (!existingDemoMessage) {
    await prisma.message.create({
      data: {
        conversationId: DEMO.conversation,
        senderId: patient1.id,
        content: 'DEMO: Halo, saya sudah mulai latihan bahu sesuai saran Anda.',
      },
    });
  }

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
      {
        userId: patient1.id,
        title: 'Consultation active',
        body: 'Your demo IN_PROGRESS consultation has an open chat thread.',
      },
      {
        userId: admin.id,
        title: 'Pending verification',
        body: 'physio3@demo.local is waiting for profile approval.',
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
  console.log('- patient1@demo.local (PATIENT) — IN_PROGRESS consult + completed booking/review + completed consult (ulasan)');
  // eslint-disable-next-line no-console
  console.log('- patient2@demo.local (PATIENT) — ACCEPTED consult + pending booking/tx');
  // eslint-disable-next-line no-console
  console.log('- physio1@demo.local (PHYSIOTHERAPIST, APPROVED, online now)');
  // eslint-disable-next-line no-console
  console.log('- physio2@demo.local (PHYSIOTHERAPIST, APPROVED)');
  // eslint-disable-next-line no-console
  console.log('- physio3@demo.local (PHYSIOTHERAPIST, PENDING verification)');
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
