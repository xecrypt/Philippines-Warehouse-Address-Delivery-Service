import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Role, ParcelState } from '@prisma/client';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import {
  createTestApp,
  cleanDatabase,
  randomEmail,
  randomTrackingNumber,
} from './test-utils';

describe('ParcelsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test users
  let userToken: string;
  let userMemberCode: string;
  let userId: string;
  let staffToken: string;
  let staffId: string;
  let adminToken: string;
  let adminId: string;

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
    userId = userResponse.body.user.id;

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
    staffId = staffResponse.body.user.id;

    // Promote to staff via direct DB update (admin would do this)
    await prisma.user.update({
      where: { id: staffId },
      data: { role: Role.WAREHOUSE_STAFF },
    });

    // Re-login to get token with staff role
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
    adminId = adminResponse.body.user.id;

    // Promote to admin
    await prisma.user.update({
      where: { id: adminId },
      data: { role: Role.ADMIN },
    });

    // Re-login to get token with admin role
    const adminLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: adminEmail, password: 'Password123' });
    adminToken = adminLoginResponse.body.tokens.accessToken;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('POST /api/parcels/intake', () => {
    it('should allow staff to register a parcel with valid member code', async () => {
      const trackingNumber = randomTrackingNumber();

      const response = await request(app.getHttpServer())
        .post('/api/parcels/intake')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          trackingNumber,
          memberCode: userMemberCode,
          weight: 2.5,
          description: 'Test parcel',
        })
        .expect(201);

      expect(response.body.parcel).toHaveProperty('id');
      expect(response.body.parcel.trackingNumber).toBe(trackingNumber);
      expect(response.body.parcel.ownerId).toBe(userId);
      expect(response.body.parcel.state).toBe(ParcelState.ARRIVED);
      expect(response.body.parcel.hasException).toBe(false);
      expect(response.body.exception).toBeNull();
    });

    it('should create orphan parcel with exception for invalid member code', async () => {
      const trackingNumber = randomTrackingNumber();

      const response = await request(app.getHttpServer())
        .post('/api/parcels/intake')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          trackingNumber,
          memberCode: 'PHW-ZZZZZZ', // Valid format but non-existent user
          weight: 1.0,
        })
        .expect(201);

      expect(response.body.parcel.ownerId).toBeNull();
      expect(response.body.parcel.hasException).toBe(true);
      expect(response.body.exception).not.toBeNull();
      expect(response.body.exception.type).toBe('INVALID_MEMBER_CODE');
    });

    it('should reject duplicate tracking numbers', async () => {
      const trackingNumber = randomTrackingNumber();

      // First parcel
      await request(app.getHttpServer())
        .post('/api/parcels/intake')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          trackingNumber,
          memberCode: userMemberCode,
          weight: 1.0,
        })
        .expect(201);

      // Duplicate
      await request(app.getHttpServer())
        .post('/api/parcels/intake')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          trackingNumber,
          memberCode: userMemberCode,
          weight: 1.0,
        })
        .expect(400);
    });

    it('should reject intake from regular user', async () => {
      await request(app.getHttpServer())
        .post('/api/parcels/intake')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          trackingNumber: randomTrackingNumber(),
          memberCode: userMemberCode,
          weight: 1.0,
        })
        .expect(403);
    });
  });

  describe('PATCH /api/parcels/:id/state', () => {
    let parcelId: string;

    beforeEach(async () => {
      // Create a test parcel
      const response = await request(app.getHttpServer())
        .post('/api/parcels/intake')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          trackingNumber: randomTrackingNumber(),
          memberCode: userMemberCode,
          weight: 1.5,
        });
      parcelId = response.body.parcel.id;
    });

    it('should allow valid state transition ARRIVED -> STORED', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/parcels/${parcelId}/state`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          newState: ParcelState.STORED,
          notes: 'Stored in rack A1',
        })
        .expect(200);

      expect(response.body.state).toBe(ParcelState.STORED);
    });

    it('should reject invalid state transition ARRIVED -> DELIVERED', async () => {
      await request(app.getHttpServer())
        .patch(`/api/parcels/${parcelId}/state`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          newState: ParcelState.DELIVERED,
        })
        .expect(400);
    });

    it('should reject state change on parcel with exception', async () => {
      // Create parcel with exception (valid format but non-existent member code)
      const exceptionParcelResponse = await request(app.getHttpServer())
        .post('/api/parcels/intake')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          trackingNumber: randomTrackingNumber(),
          memberCode: 'PHW-YYYYYY', // Valid format but non-existent user
          weight: 1.0,
        });
      const exceptionParcelId = exceptionParcelResponse.body.parcel.id;

      // Try to change state
      await request(app.getHttpServer())
        .patch(`/api/parcels/${exceptionParcelId}/state`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          newState: ParcelState.STORED,
        })
        .expect(403);
    });
  });

  describe('GET /api/parcels/my/list', () => {
    beforeEach(async () => {
      // Create some parcels for the user
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/parcels/intake')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({
            trackingNumber: randomTrackingNumber(),
            memberCode: userMemberCode,
            weight: 1.0 + i,
          });
      }
    });

    it('should return user own parcels', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/parcels/my/list')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      response.body.forEach((parcel: { ownerId: string }) => {
        expect(parcel.ownerId).toBe(userId);
      });
    });

    it('should filter by state', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/parcels/my/list')
        .query({ state: ParcelState.ARRIVED })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      response.body.forEach((parcel: { state: string }) => {
        expect(parcel.state).toBe(ParcelState.ARRIVED);
      });
    });
  });

  describe('GET /api/parcels/:id', () => {
    let parcelId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/parcels/intake')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          trackingNumber: randomTrackingNumber(),
          memberCode: userMemberCode,
          weight: 2.0,
        });
      parcelId = response.body.parcel.id;
    });

    it('should allow owner to view their parcel', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/parcels/${parcelId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(parcelId);
    });

    it('should allow staff to view any parcel', async () => {
      await request(app.getHttpServer())
        .get(`/api/parcels/${parcelId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });

    it('should reject user viewing another user parcel', async () => {
      // Create another user
      const otherUserResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: randomEmail(),
          password: 'Password123',
          firstName: 'Other',
          lastName: 'User',
        });
      const otherUserToken = otherUserResponse.body.tokens.accessToken;

      await request(app.getHttpServer())
        .get(`/api/parcels/${parcelId}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);
    });
  });

  describe('PATCH /api/parcels/:id/override-ownership (Admin only)', () => {
    let orphanParcelId: string;

    beforeEach(async () => {
      // Create orphan parcel (valid format but non-existent member code)
      const response = await request(app.getHttpServer())
        .post('/api/parcels/intake')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          trackingNumber: randomTrackingNumber(),
          memberCode: 'PHW-XXXXXX', // Valid format but non-existent user
          weight: 1.0,
        });
      orphanParcelId = response.body.parcel.id;
    });

    it('should allow admin to override ownership', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/parcels/${orphanParcelId}/override-ownership`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberCode: userMemberCode,
          reason: 'Customer provided correct member code via support ticket',
        })
        .expect(200);

      expect(response.body.ownerId).toBe(userId);
      expect(response.body.memberCode).toBe(userMemberCode);
    });

    it('should reject staff from overriding ownership', async () => {
      await request(app.getHttpServer())
        .patch(`/api/parcels/${orphanParcelId}/override-ownership`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          memberCode: userMemberCode,
          reason: 'Attempting override as staff',
        })
        .expect(403);
    });

    it('should reject override with short reason', async () => {
      await request(app.getHttpServer())
        .patch(`/api/parcels/${orphanParcelId}/override-ownership`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberCode: userMemberCode,
          reason: 'Short',
        })
        .expect(400);
    });
  });

  describe('DELETE /api/parcels/:id (Admin only)', () => {
    let parcelId: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer())
        .post('/api/parcels/intake')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          trackingNumber: randomTrackingNumber(),
          memberCode: userMemberCode,
          weight: 1.0,
        });
      parcelId = response.body.parcel.id;
    });

    it('should allow admin to soft delete parcel', async () => {
      await request(app.getHttpServer())
        .delete(`/api/parcels/${parcelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify parcel is no longer accessible
      await request(app.getHttpServer())
        .get(`/api/parcels/${parcelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should reject staff from deleting parcel', async () => {
      await request(app.getHttpServer())
        .delete(`/api/parcels/${parcelId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
  });
});
