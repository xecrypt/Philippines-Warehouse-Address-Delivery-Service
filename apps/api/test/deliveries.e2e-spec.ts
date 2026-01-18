import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Role, ParcelState, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import {
  createTestApp,
  cleanDatabase,
  seedFeeConfig,
  randomEmail,
  randomTrackingNumber,
} from './test-utils';

describe('DeliveriesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Test users
  let userToken: string;
  let userMemberCode: string;
  let userId: string;
  let staffToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    await seedFeeConfig(prisma);

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
    const staffId = staffResponse.body.user.id;

    await prisma.user.update({
      where: { id: staffId },
      data: { role: Role.WAREHOUSE_STAFF },
    });

    const staffLoginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: staffEmail, password: 'Password123' });
    staffToken = staffLoginResponse.body.tokens.accessToken;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  /**
   * Helper: Create a parcel and move it to STORED state
   */
  async function createStoredParcel(): Promise<string> {
    // Intake parcel
    const intakeResponse = await request(app.getHttpServer())
      .post('/api/parcels/intake')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        trackingNumber: randomTrackingNumber(),
        memberCode: userMemberCode,
        weight: 3.5,
      });
    const parcelId = intakeResponse.body.parcel.id;

    // Move to STORED
    await request(app.getHttpServer())
      .patch(`/api/parcels/${parcelId}/state`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ newState: ParcelState.STORED });

    return parcelId;
  }

  describe('GET /api/deliveries/estimate/:parcelId', () => {
    it('should return fee estimate for owned parcel', async () => {
      const parcelId = await createStoredParcel();

      const response = await request(app.getHttpServer())
        .get(`/api/deliveries/estimate/${parcelId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('baseFee');
      expect(response.body).toHaveProperty('weightFee');
      expect(response.body).toHaveProperty('totalFee');
      expect(response.body.weight).toBe(3.5);
      expect(response.body.roundedWeight).toBe(4); // Rounded up
      // 50 base + 4kg * 20 = 130
      expect(response.body.totalFee).toBe(130);
    });

    it('should reject fee estimate for non-owned parcel', async () => {
      const parcelId = await createStoredParcel();

      // Create another user
      const otherUserResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: randomEmail(),
          password: 'Password123',
          firstName: 'Other',
          lastName: 'User',
        });

      await request(app.getHttpServer())
        .get(`/api/deliveries/estimate/${parcelId}`)
        .set('Authorization', `Bearer ${otherUserResponse.body.tokens.accessToken}`)
        .expect(403);
    });
  });

  describe('POST /api/deliveries', () => {
    it('should create delivery request for STORED parcel', async () => {
      const parcelId = await createStoredParcel();

      const response = await request(app.getHttpServer())
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          parcelId,
          deliveryStreet: '123 Main Street',
          deliveryCity: 'Manila',
          deliveryProvince: 'Metro Manila',
          deliveryZipCode: '1000',
        })
        .expect(201);

      expect(response.body.delivery).toHaveProperty('id');
      expect(response.body.delivery.paymentStatus).toBe(PaymentStatus.PENDING);
      expect(response.body.delivery.totalFee).toBe(130);
      expect(response.body.parcel.state).toBe(ParcelState.DELIVERY_REQUESTED);
    });

    it('should reject delivery for non-STORED parcel', async () => {
      // Create parcel but don't move to STORED
      const intakeResponse = await request(app.getHttpServer())
        .post('/api/parcels/intake')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          trackingNumber: randomTrackingNumber(),
          memberCode: userMemberCode,
          weight: 1.0,
        });
      const parcelId = intakeResponse.body.parcel.id;

      await request(app.getHttpServer())
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          parcelId,
          deliveryStreet: '123 Main Street',
          deliveryCity: 'Manila',
          deliveryProvince: 'Metro Manila',
          deliveryZipCode: '1000',
        })
        .expect(400);
    });

    it('should reject duplicate delivery request', async () => {
      const parcelId = await createStoredParcel();

      // First request
      await request(app.getHttpServer())
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          parcelId,
          deliveryStreet: '123 Main Street',
          deliveryCity: 'Manila',
          deliveryProvince: 'Metro Manila',
          deliveryZipCode: '1000',
        })
        .expect(201);

      // Duplicate request
      await request(app.getHttpServer())
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          parcelId,
          deliveryStreet: '123 Main Street',
          deliveryCity: 'Manila',
          deliveryProvince: 'Metro Manila',
          deliveryZipCode: '1000',
        })
        .expect(400);
    });

    it('should support idempotency with Idempotency-Key header', async () => {
      const parcelId = await createStoredParcel();
      const idempotencyKey = `test-key-${Date.now()}`;

      // First request
      const response1 = await request(app.getHttpServer())
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          parcelId,
          deliveryStreet: '123 Main Street',
          deliveryCity: 'Manila',
          deliveryProvince: 'Metro Manila',
          deliveryZipCode: '1000',
        })
        .expect(201);

      // Retry with same idempotency key should return cached response
      const response2 = await request(app.getHttpServer())
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          parcelId,
          deliveryStreet: '123 Main Street',
          deliveryCity: 'Manila',
          deliveryProvince: 'Metro Manila',
          deliveryZipCode: '1000',
        })
        .expect(201);

      expect(response1.body.delivery.id).toBe(response2.body.delivery.id);
    });
  });

  describe('PATCH /api/deliveries/:id/confirm-payment', () => {
    let deliveryId: string;

    beforeEach(async () => {
      const parcelId = await createStoredParcel();
      const response = await request(app.getHttpServer())
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          parcelId,
          deliveryStreet: '123 Main Street',
          deliveryCity: 'Manila',
          deliveryProvince: 'Metro Manila',
          deliveryZipCode: '1000',
        });
      deliveryId = response.body.delivery.id;
    });

    it('should allow staff to confirm payment', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/confirm-payment`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.paymentStatus).toBe(PaymentStatus.CONFIRMED);
      expect(response.body.paymentConfirmedAt).not.toBeNull();
    });

    it('should reject user from confirming payment', async () => {
      await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/confirm-payment`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should reject confirming already confirmed payment', async () => {
      // First confirmation
      await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/confirm-payment`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Second confirmation
      await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/confirm-payment`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(400);
    });
  });

  describe('PATCH /api/deliveries/:id/dispatch', () => {
    let deliveryId: string;

    beforeEach(async () => {
      const parcelId = await createStoredParcel();
      const response = await request(app.getHttpServer())
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          parcelId,
          deliveryStreet: '123 Main Street',
          deliveryCity: 'Manila',
          deliveryProvince: 'Metro Manila',
          deliveryZipCode: '1000',
        });
      deliveryId = response.body.delivery.id;
    });

    it('should reject dispatch without payment confirmation', async () => {
      await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/dispatch`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(400);
    });

    it('should allow dispatch after payment confirmation', async () => {
      // Confirm payment first
      await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/confirm-payment`)
        .set('Authorization', `Bearer ${staffToken}`);

      const response = await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/dispatch`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.delivery.dispatchedAt).not.toBeNull();
      expect(response.body.parcel.state).toBe(ParcelState.OUT_FOR_DELIVERY);
    });
  });

  describe('PATCH /api/deliveries/:id/complete', () => {
    let deliveryId: string;

    beforeEach(async () => {
      const parcelId = await createStoredParcel();
      const response = await request(app.getHttpServer())
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          parcelId,
          deliveryStreet: '123 Main Street',
          deliveryCity: 'Manila',
          deliveryProvince: 'Metro Manila',
          deliveryZipCode: '1000',
        });
      deliveryId = response.body.delivery.id;

      // Confirm payment
      await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/confirm-payment`)
        .set('Authorization', `Bearer ${staffToken}`);

      // Dispatch
      await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/dispatch`)
        .set('Authorization', `Bearer ${staffToken}`);
    });

    it('should complete delivery after dispatch', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/complete`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.delivery.deliveredAt).not.toBeNull();
      expect(response.body.parcel.state).toBe(ParcelState.DELIVERED);
    });
  });

  describe('GET /api/deliveries/my', () => {
    beforeEach(async () => {
      // Create multiple deliveries
      for (let i = 0; i < 2; i++) {
        const parcelId = await createStoredParcel();
        await request(app.getHttpServer())
          .post('/api/deliveries')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            parcelId,
            deliveryStreet: `${i + 1} Main Street`,
            deliveryCity: 'Manila',
            deliveryProvince: 'Metro Manila',
            deliveryZipCode: '1000',
          });
      }
    });

    it('should return user own deliveries', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/deliveries/my')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
      response.body.forEach((delivery: { recipientId: string }) => {
        expect(delivery.recipientId).toBe(userId);
      });
    });
  });

  describe('Full delivery lifecycle', () => {
    it('should complete full STORED -> DELIVERED flow', async () => {
      // 1. Create stored parcel
      const parcelId = await createStoredParcel();

      // 2. Request delivery
      const deliveryResponse = await request(app.getHttpServer())
        .post('/api/deliveries')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          parcelId,
          deliveryStreet: '123 Main Street',
          deliveryCity: 'Manila',
          deliveryProvince: 'Metro Manila',
          deliveryZipCode: '1000',
        });
      const deliveryId = deliveryResponse.body.delivery.id;
      expect(deliveryResponse.body.parcel.state).toBe(ParcelState.DELIVERY_REQUESTED);

      // 3. Confirm payment
      await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/confirm-payment`)
        .set('Authorization', `Bearer ${staffToken}`);

      // 4. Dispatch
      const dispatchResponse = await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/dispatch`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(dispatchResponse.body.parcel.state).toBe(ParcelState.OUT_FOR_DELIVERY);

      // 5. Complete
      const completeResponse = await request(app.getHttpServer())
        .patch(`/api/deliveries/${deliveryId}/complete`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(completeResponse.body.parcel.state).toBe(ParcelState.DELIVERED);

      // 6. Verify parcel final state
      const parcelResponse = await request(app.getHttpServer())
        .get(`/api/parcels/${parcelId}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(parcelResponse.body.state).toBe(ParcelState.DELIVERED);
    });
  });
});
