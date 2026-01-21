import { PrismaClient, Role, ParcelState, ExceptionType, ExceptionStatus, PaymentStatus, NotificationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data (in reverse order of dependencies)
  console.log('Clearing existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.exception.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.parcelStateHistory.deleteMany();
  await prisma.parcel.deleteMany();
  await prisma.user.deleteMany();
  await prisma.feeConfiguration.deleteMany();
  await prisma.idempotencyKey.deleteMany();

  // Create password hash (same for all test users: "Password123!")
  const passwordHash = await bcrypt.hash('Password123!', 10);

  // ============================================================
  // CREATE TEST USERS
  // ============================================================
  console.log('Creating test users...');

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@warehouse.com',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+639171234567',
      memberCode: 'PHW-ADMIN1',
      role: Role.ADMIN,
      deliveryStreet: '123 Admin Street',
      deliveryCity: 'Manila',
      deliveryProvince: 'Metro Manila',
      deliveryZipCode: '1000',
    },
  });

  const staffUser = await prisma.user.create({
    data: {
      email: 'staff@warehouse.com',
      passwordHash,
      firstName: 'Staff',
      lastName: 'Member',
      phone: '+639181234567',
      memberCode: 'PHW-STAFF1',
      role: Role.WAREHOUSE_STAFF,
      deliveryStreet: '456 Staff Avenue',
      deliveryCity: 'Quezon City',
      deliveryProvince: 'Metro Manila',
      deliveryZipCode: '1100',
    },
  });

  const regularUser = await prisma.user.create({
    data: {
      email: 'user@example.com',
      passwordHash,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+639191234567',
      memberCode: 'PHW-USER01',
      role: Role.USER,
      deliveryStreet: '789 Customer Road',
      deliveryCity: 'Makati',
      deliveryProvince: 'Metro Manila',
      deliveryZipCode: '1200',
    },
  });

  const regularUser2 = await prisma.user.create({
    data: {
      email: 'jane@example.com',
      passwordHash,
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+639201234567',
      memberCode: 'PHW-USER02',
      role: Role.USER,
      deliveryStreet: '321 Another Street',
      deliveryCity: 'Pasig',
      deliveryProvince: 'Metro Manila',
      deliveryZipCode: '1600',
    },
  });

  console.log('Created users:');
  console.log(`  - Admin: admin@warehouse.com (PHW-ADMIN1)`);
  console.log(`  - Staff: staff@warehouse.com (PHW-STAFF1)`);
  console.log(`  - User 1: user@example.com (PHW-USER01)`);
  console.log(`  - User 2: jane@example.com (PHW-USER02)`);

  // ============================================================
  // CREATE FEE CONFIGURATION
  // ============================================================
  console.log('Creating fee configuration...');

  await prisma.feeConfiguration.create({
    data: {
      name: 'standard',
      baseFee: 100, // PHP 100 base fee
      perKgRate: 50, // PHP 50 per kg
      minWeight: 0,
      maxWeight: 50,
      isActive: true,
    },
  });

  // ============================================================
  // CREATE PARCELS
  // ============================================================
  console.log('Creating parcels...');

  // Parcel 1: STORED - ready for delivery request
  const parcel1 = await prisma.parcel.create({
    data: {
      trackingNumber: 'TRK-2024-001',
      memberCode: regularUser.memberCode,
      description: 'Electronics - Laptop',
      weight: 2.5,
      state: ParcelState.STORED,
      ownerId: regularUser.id,
      registeredById: staffUser.id,
      storedAt: new Date(),
      stateHistory: {
        create: [
          { fromState: null, toState: ParcelState.ARRIVED, changedById: staffUser.id },
          { fromState: ParcelState.ARRIVED, toState: ParcelState.STORED, changedById: staffUser.id },
        ],
      },
    },
  });

  // Parcel 2: STORED - another ready parcel
  const parcel2 = await prisma.parcel.create({
    data: {
      trackingNumber: 'TRK-2024-002',
      memberCode: regularUser.memberCode,
      description: 'Clothing - Winter Jacket',
      weight: 1.2,
      state: ParcelState.STORED,
      ownerId: regularUser.id,
      registeredById: staffUser.id,
      storedAt: new Date(),
      stateHistory: {
        create: [
          { fromState: null, toState: ParcelState.ARRIVED, changedById: staffUser.id },
          { fromState: ParcelState.ARRIVED, toState: ParcelState.STORED, changedById: staffUser.id },
        ],
      },
    },
  });

  // Parcel 3: ARRIVED - needs processing
  const parcel3 = await prisma.parcel.create({
    data: {
      trackingNumber: 'TRK-2024-003',
      memberCode: regularUser.memberCode,
      description: 'Books',
      weight: 3.0,
      state: ParcelState.ARRIVED,
      ownerId: regularUser.id,
      registeredById: staffUser.id,
      stateHistory: {
        create: [
          { fromState: null, toState: ParcelState.ARRIVED, changedById: staffUser.id },
        ],
      },
    },
  });

  // Parcel 4: DELIVERY_REQUESTED - with pending payment
  const parcel4 = await prisma.parcel.create({
    data: {
      trackingNumber: 'TRK-2024-004',
      memberCode: regularUser.memberCode,
      description: 'Phone accessories',
      weight: 0.5,
      state: ParcelState.DELIVERY_REQUESTED,
      ownerId: regularUser.id,
      registeredById: staffUser.id,
      storedAt: new Date(Date.now() - 86400000), // 1 day ago
      stateHistory: {
        create: [
          { fromState: null, toState: ParcelState.ARRIVED, changedById: staffUser.id },
          { fromState: ParcelState.ARRIVED, toState: ParcelState.STORED, changedById: staffUser.id },
          { fromState: ParcelState.STORED, toState: ParcelState.DELIVERY_REQUESTED, changedById: regularUser.id },
        ],
      },
    },
  });

  // Create delivery for parcel 4
  await prisma.delivery.create({
    data: {
      parcelId: parcel4.id,
      recipientId: regularUser.id,
      deliveryStreet: regularUser.deliveryStreet!,
      deliveryCity: regularUser.deliveryCity!,
      deliveryProvince: regularUser.deliveryProvince!,
      deliveryZipCode: regularUser.deliveryZipCode!,
      weightKg: 0.5,
      baseFee: 100,
      weightFee: 25,
      totalFee: 125,
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  // Parcel 5: OUT_FOR_DELIVERY - payment confirmed
  const parcel5 = await prisma.parcel.create({
    data: {
      trackingNumber: 'TRK-2024-005',
      memberCode: regularUser.memberCode,
      description: 'Kitchen appliance',
      weight: 4.0,
      state: ParcelState.OUT_FOR_DELIVERY,
      ownerId: regularUser.id,
      registeredById: staffUser.id,
      storedAt: new Date(Date.now() - 172800000), // 2 days ago
      stateHistory: {
        create: [
          { fromState: null, toState: ParcelState.ARRIVED, changedById: staffUser.id },
          { fromState: ParcelState.ARRIVED, toState: ParcelState.STORED, changedById: staffUser.id },
          { fromState: ParcelState.STORED, toState: ParcelState.DELIVERY_REQUESTED, changedById: regularUser.id },
          { fromState: ParcelState.DELIVERY_REQUESTED, toState: ParcelState.OUT_FOR_DELIVERY, changedById: staffUser.id },
        ],
      },
    },
  });

  // Create delivery for parcel 5
  await prisma.delivery.create({
    data: {
      parcelId: parcel5.id,
      recipientId: regularUser.id,
      deliveryStreet: regularUser.deliveryStreet!,
      deliveryCity: regularUser.deliveryCity!,
      deliveryProvince: regularUser.deliveryProvince!,
      deliveryZipCode: regularUser.deliveryZipCode!,
      weightKg: 4.0,
      baseFee: 100,
      weightFee: 200,
      totalFee: 300,
      paymentStatus: PaymentStatus.CONFIRMED,
      paymentConfirmedAt: new Date(Date.now() - 86400000),
      paymentConfirmedById: staffUser.id,
      dispatchedAt: new Date(),
    },
  });

  // Parcel 6: DELIVERED - completed
  const parcel6 = await prisma.parcel.create({
    data: {
      trackingNumber: 'TRK-2024-006',
      memberCode: regularUser.memberCode,
      description: 'Shoes',
      weight: 1.5,
      state: ParcelState.DELIVERED,
      ownerId: regularUser.id,
      registeredById: staffUser.id,
      storedAt: new Date(Date.now() - 604800000), // 7 days ago
      stateHistory: {
        create: [
          { fromState: null, toState: ParcelState.ARRIVED, changedById: staffUser.id },
          { fromState: ParcelState.ARRIVED, toState: ParcelState.STORED, changedById: staffUser.id },
          { fromState: ParcelState.STORED, toState: ParcelState.DELIVERY_REQUESTED, changedById: regularUser.id },
          { fromState: ParcelState.DELIVERY_REQUESTED, toState: ParcelState.OUT_FOR_DELIVERY, changedById: staffUser.id },
          { fromState: ParcelState.OUT_FOR_DELIVERY, toState: ParcelState.DELIVERED, changedById: staffUser.id },
        ],
      },
    },
  });

  // Create delivery for parcel 6
  await prisma.delivery.create({
    data: {
      parcelId: parcel6.id,
      recipientId: regularUser.id,
      deliveryStreet: regularUser.deliveryStreet!,
      deliveryCity: regularUser.deliveryCity!,
      deliveryProvince: regularUser.deliveryProvince!,
      deliveryZipCode: regularUser.deliveryZipCode!,
      weightKg: 1.5,
      baseFee: 100,
      weightFee: 75,
      totalFee: 175,
      paymentStatus: PaymentStatus.CONFIRMED,
      paymentConfirmedAt: new Date(Date.now() - 518400000), // 6 days ago
      paymentConfirmedById: staffUser.id,
      dispatchedAt: new Date(Date.now() - 432000000), // 5 days ago
      deliveredAt: new Date(Date.now() - 345600000), // 4 days ago
    },
  });

  // Parcel 7: For User 2
  const parcel7 = await prisma.parcel.create({
    data: {
      trackingNumber: 'TRK-2024-007',
      memberCode: regularUser2.memberCode,
      description: 'Cosmetics',
      weight: 0.8,
      state: ParcelState.STORED,
      ownerId: regularUser2.id,
      registeredById: staffUser.id,
      storedAt: new Date(),
      stateHistory: {
        create: [
          { fromState: null, toState: ParcelState.ARRIVED, changedById: staffUser.id },
          { fromState: ParcelState.ARRIVED, toState: ParcelState.STORED, changedById: staffUser.id },
        ],
      },
    },
  });

  // Parcel 8: With EXCEPTION (orphan parcel)
  const parcel8 = await prisma.parcel.create({
    data: {
      trackingNumber: 'TRK-2024-008',
      memberCode: 'PHW-UNKNOWN',
      description: 'Unknown contents',
      weight: 2.0,
      state: ParcelState.ARRIVED,
      ownerId: null, // Orphan - no owner
      registeredById: staffUser.id,
      hasException: true,
      stateHistory: {
        create: [
          { fromState: null, toState: ParcelState.ARRIVED, changedById: staffUser.id, notes: 'Member code not found' },
        ],
      },
    },
  });

  // Create exception for parcel 8
  await prisma.exception.create({
    data: {
      parcelId: parcel8.id,
      type: ExceptionType.INVALID_MEMBER_CODE,
      status: ExceptionStatus.OPEN,
      description: 'Member code PHW-UNKNOWN does not match any registered user. Package label shows name "Unknown Customer".',
      createdById: staffUser.id,
    },
  });

  console.log('Created parcels:');
  console.log(`  - TRK-2024-001: STORED (ready for delivery)`);
  console.log(`  - TRK-2024-002: STORED (ready for delivery)`);
  console.log(`  - TRK-2024-003: ARRIVED (needs processing)`);
  console.log(`  - TRK-2024-004: DELIVERY_REQUESTED (pending payment)`);
  console.log(`  - TRK-2024-005: OUT_FOR_DELIVERY`);
  console.log(`  - TRK-2024-006: DELIVERED (completed)`);
  console.log(`  - TRK-2024-007: STORED (User 2)`);
  console.log(`  - TRK-2024-008: ARRIVED with EXCEPTION (orphan)`);

  // ============================================================
  // CREATE NOTIFICATIONS
  // ============================================================
  console.log('Creating notifications...');

  await prisma.notification.createMany({
    data: [
      {
        userId: regularUser.id,
        type: NotificationType.PARCEL_ARRIVED,
        title: 'Parcel Arrived',
        message: 'Your parcel TRK-2024-003 has arrived at the warehouse.',
        parcelId: parcel3.id,
        isRead: false,
      },
      {
        userId: regularUser.id,
        type: NotificationType.PARCEL_STORED,
        title: 'Parcel Ready',
        message: 'Your parcel TRK-2024-001 is stored and ready for delivery request.',
        parcelId: parcel1.id,
        isRead: true,
        readAt: new Date(Date.now() - 3600000),
      },
      {
        userId: regularUser.id,
        type: NotificationType.OUT_FOR_DELIVERY,
        title: 'Out for Delivery',
        message: 'Your parcel TRK-2024-005 is out for delivery!',
        parcelId: parcel5.id,
        isRead: false,
      },
    ],
  });

  // ============================================================
  // CREATE AUDIT LOGS
  // ============================================================
  console.log('Creating sample audit logs...');

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: staffUser.id,
        actorRole: Role.WAREHOUSE_STAFF,
        actorEmail: staffUser.email,
        action: 'PARCEL_INTAKE',
        entityType: 'Parcel',
        entityId: parcel1.id,
        newData: { trackingNumber: 'TRK-2024-001', state: 'ARRIVED' },
        parcelId: parcel1.id,
      },
      {
        actorId: staffUser.id,
        actorRole: Role.WAREHOUSE_STAFF,
        actorEmail: staffUser.email,
        action: 'PARCEL_STATE_CHANGE',
        entityType: 'Parcel',
        entityId: parcel1.id,
        previousData: { state: 'ARRIVED' },
        newData: { state: 'STORED' },
        parcelId: parcel1.id,
      },
      {
        actorId: regularUser.id,
        actorRole: Role.USER,
        actorEmail: regularUser.email,
        action: 'DELIVERY_REQUESTED',
        entityType: 'Delivery',
        entityId: parcel4.id,
        newData: { parcelId: parcel4.id, totalFee: 125 },
        parcelId: parcel4.id,
      },
      {
        actorId: staffUser.id,
        actorRole: Role.WAREHOUSE_STAFF,
        actorEmail: staffUser.email,
        action: 'EXCEPTION_CREATED',
        entityType: 'Exception',
        entityId: parcel8.id,
        newData: { type: 'INVALID_MEMBER_CODE', parcelId: parcel8.id },
        parcelId: parcel8.id,
      },
    ],
  });

  console.log('\n========================================');
  console.log('SEED COMPLETED SUCCESSFULLY!');
  console.log('========================================\n');
  console.log('Test Credentials (all use password: Password123!):\n');
  console.log('ADMIN:');
  console.log('  Email: admin@warehouse.com');
  console.log('  Member Code: PHW-ADMIN1\n');
  console.log('WAREHOUSE STAFF:');
  console.log('  Email: staff@warehouse.com');
  console.log('  Member Code: PHW-STAFF1\n');
  console.log('USER 1:');
  console.log('  Email: user@example.com');
  console.log('  Member Code: PHW-USER01\n');
  console.log('USER 2:');
  console.log('  Email: jane@example.com');
  console.log('  Member Code: PHW-USER02\n');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
