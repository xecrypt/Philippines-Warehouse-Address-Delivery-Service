import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Role, ParcelState, ExceptionType, ExceptionStatus } from '@prisma/client';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import {
  createTestApp,
  cleanDatabase,
  randomEmail,
  randomTrackingNumber,
} from './test-utils';

describe('ExceptionsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let userToken: string;
  let userMemberCode: string;
  let staffToken: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);

    // Create regular user
    const userResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: randomEmail(),
        password: 'Password123',
        firstName: 'Regular',
        lastName: 'User',
      });
    userToken = userResponse.body.tokens.accessToken;
    userMemberCode = userResponse.body.user.memberCode;

    // Create staff user
    const staffEmail = randomEmail();
    const staffResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: staffEmail,
        password: 'Password123',
        firstName: 'Staff',
        lastName: 'Member',
      });
    const staffId = staffResponse.body.user.id;

    await prisma.user.update({
      where: { id: staffId },
      data: { role: Role.WAREHOUSE_STAFF },
    });

    const staffLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: staffEmail, password: 'Password123' });
    staffToken = staffLoginResponse.body.tokens.accessToken;

    // Create admin user
    const adminEmail = randomEmail();
    const adminResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: adminEmail,
        password: 'Password123',
        firstName: 'Admin',
        lastName: 'User',
      });
    const adminId = adminResponse.body.user.id;

    await prisma.user.update({
      where: { id: adminId },
      data: { role: Role.ADMIN },
    });

    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'Password123' });
    adminToken = adminLoginResponse.body.tokens.accessToken;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  /**
   * Helper: Create a parcel without exception
   */
  async function createParcel(): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/parcels/intake')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        trackingNumber: randomTrackingNumber(),
        memberCode: userMemberCode,
        weight: 1.5,
      });
    return response.body.parcel.id;
  }

  describe('POST /api/exceptions', () => {
    it('should allow staff to create exception', async () => {
      const parcelId = await createParcel();

      const response = await request(app.getHttpServer())
        .post('/api/exceptions')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          parcelId,
          type: ExceptionType.DAMAGED_PARCEL,
          description: 'Package arrived with visible damage on one corner',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.type).toBe(ExceptionType.DAMAGED_PARCEL);
      expect(response.body.status).toBe(ExceptionStatus.OPEN);

      // Verify parcel is now locked
      const parcel = await prisma.parcel.findUnique({
        where: { id: parcelId },
      });
      expect(parcel?.hasException).toBe(true);
    });

    it('should reject user from creating exception', async () => {
      const parcelId = await createParcel();

      await request(app.getHttpServer())
        .post('/api/exceptions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          parcelId,
          type: ExceptionType.DAMAGED_PARCEL,
          description: 'Test description for the exception',
        })
        .expect(403);
    });

    it('should reject duplicate open exception of same type', async () => {
      const parcelId = await createParcel();

      // First exception
      await request(app.getHttpServer())
        .post('/api/exceptions')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          parcelId,
          type: ExceptionType.DAMAGED_PARCEL,
          description: 'First damage report',
        })
        .expect(201);

      // Duplicate
      await request(app.getHttpServer())
        .post('/api/exceptions')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          parcelId,
          type: ExceptionType.DAMAGED_PARCEL,
          description: 'Second damage report',
        })
        .expect(400);
    });

    it('should lock parcel from state changes when exception is created', async () => {
      const parcelId = await createParcel();

      // Create exception
      await request(app.getHttpServer())
        .post('/api/exceptions')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          parcelId,
          type: ExceptionType.ILLEGIBLE_LABEL,
          description: 'Cannot read the shipping label due to water damage',
        });

      // Try to change state
      await request(app.getHttpServer())
        .patch(`/api/parcels/${parcelId}/state`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ newState: ParcelState.STORED })
        .expect(403);
    });
  });

  describe('PATCH /api/exceptions/:id/assign', () => {
    let exceptionId: string;

    beforeEach(async () => {
      const parcelId = await createParcel();
      const response = await request(app.getHttpServer())
        .post('/api/exceptions')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          parcelId,
          type: ExceptionType.DAMAGED_PARCEL,
          description: 'Package damaged in transit',
        });
      exceptionId = response.body.id;
    });

    it('should allow admin to assign exception to themselves', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/exceptions/${exceptionId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe(ExceptionStatus.IN_PROGRESS);
      expect(response.body.handledById).not.toBeNull();
    });

    it('should reject staff from assigning exception', async () => {
      await request(app.getHttpServer())
        .patch(`/api/exceptions/${exceptionId}/assign`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
  });

  describe('PATCH /api/exceptions/:id/resolve', () => {
    let exceptionId: string;
    let parcelId: string;

    beforeEach(async () => {
      parcelId = await createParcel();
      const response = await request(app.getHttpServer())
        .post('/api/exceptions')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          parcelId,
          type: ExceptionType.DAMAGED_PARCEL,
          description: 'Package damaged in transit',
        });
      exceptionId = response.body.id;
    });

    it('should allow admin to resolve exception', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/exceptions/${exceptionId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resolution: 'Damage is superficial, parcel contents are intact. Cleared for processing.',
        })
        .expect(200);

      expect(response.body.status).toBe(ExceptionStatus.RESOLVED);
      expect(response.body.resolution).not.toBeNull();

      // Verify parcel is unlocked
      const parcel = await prisma.parcel.findUnique({
        where: { id: parcelId },
      });
      expect(parcel?.hasException).toBe(false);
    });

    it('should unlock parcel after resolving last exception', async () => {
      // Resolve exception
      await request(app.getHttpServer())
        .patch(`/api/exceptions/${exceptionId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resolution: 'Issue resolved',
        });

      // Now state change should work
      await request(app.getHttpServer())
        .patch(`/api/parcels/${parcelId}/state`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ newState: ParcelState.STORED })
        .expect(200);
    });

    it('should keep parcel locked if other open exceptions exist', async () => {
      // Create second exception
      await request(app.getHttpServer())
        .post('/api/exceptions')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          parcelId,
          type: ExceptionType.ILLEGIBLE_LABEL,
          description: 'Label is hard to read',
        });

      // Resolve first exception
      await request(app.getHttpServer())
        .patch(`/api/exceptions/${exceptionId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resolution: 'Damage resolved',
        });

      // Parcel should still be locked due to second exception
      const parcel = await prisma.parcel.findUnique({
        where: { id: parcelId },
      });
      expect(parcel?.hasException).toBe(true);
    });

    it('should reject staff from resolving exception', async () => {
      await request(app.getHttpServer())
        .patch(`/api/exceptions/${exceptionId}/resolve`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          resolution: 'Attempted resolution by staff',
        })
        .expect(403);
    });
  });

  describe('PATCH /api/exceptions/:id/cancel', () => {
    let exceptionId: string;
    let parcelId: string;

    beforeEach(async () => {
      parcelId = await createParcel();
      const response = await request(app.getHttpServer())
        .post('/api/exceptions')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          parcelId,
          type: ExceptionType.OTHER,
          description: 'This exception was created by mistake',
        });
      exceptionId = response.body.id;
    });

    it('should allow admin to cancel exception', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/exceptions/${exceptionId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.status).toBe(ExceptionStatus.CANCELLED);

      // Verify parcel is unlocked
      const parcel = await prisma.parcel.findUnique({
        where: { id: parcelId },
      });
      expect(parcel?.hasException).toBe(false);
    });
  });

  describe('GET /api/exceptions/open', () => {
    beforeEach(async () => {
      // Create multiple exceptions
      for (let i = 0; i < 3; i++) {
        const parcelId = await createParcel();
        await request(app.getHttpServer())
          .post('/api/exceptions')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            parcelId,
            type: ExceptionType.DAMAGED_PARCEL,
            description: `Exception ${i + 1}`,
          });
      }
    });

    it('should return open exceptions for staff', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/exceptions/open')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      response.body.data.forEach((ex: { status: string }) => {
        expect([ExceptionStatus.OPEN, ExceptionStatus.IN_PROGRESS]).toContain(ex.status);
      });
    });

    it('should reject user from viewing exception queue', async () => {
      await request(app.getHttpServer())
        .get('/api/exceptions/open')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('GET /api/exceptions/:id', () => {
    let exceptionId: string;

    beforeEach(async () => {
      const parcelId = await createParcel();
      const response = await request(app.getHttpServer())
        .post('/api/exceptions')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          parcelId,
          type: ExceptionType.DAMAGED_PARCEL,
          description: 'Test exception',
        });
      exceptionId = response.body.id;
    });

    it('should return exception details for staff', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/exceptions/${exceptionId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.id).toBe(exceptionId);
      expect(response.body).toHaveProperty('parcel');
      expect(response.body).toHaveProperty('createdBy');
    });

    it('should return exception details for admin', async () => {
      await request(app.getHttpServer())
        .get(`/api/exceptions/${exceptionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });
});
