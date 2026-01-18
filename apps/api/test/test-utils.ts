import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';

/**
 * Test utilities for e2e tests
 */

export interface TestUser {
  id: string;
  email: string;
  password: string;
  memberCode: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * Create and configure test application
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Apply same configuration as main.ts
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix('api');

  await app.init();

  return app;
}

/**
 * Clean up test database
 */
export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  // Delete in order to respect foreign key constraints
  await prisma.idempotencyKey.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.exception.deleteMany();
  await prisma.parcelStateHistory.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.parcel.deleteMany();
  await prisma.user.deleteMany();
  await prisma.feeConfiguration.deleteMany();
}

/**
 * Seed default fee configuration for tests
 */
export async function seedFeeConfig(prisma: PrismaService): Promise<void> {
  await prisma.feeConfiguration.create({
    data: {
      name: 'standard',
      baseFee: 50,
      perKgRate: 20,
      minWeight: 0,
      maxWeight: null,
      isActive: true,
    },
  });
}

/**
 * Generate random email for tests
 */
export function randomEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
}

/**
 * Generate random tracking number
 */
export function randomTrackingNumber(): string {
  return `TRK-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
}
