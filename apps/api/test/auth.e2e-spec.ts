import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import {
  createTestApp,
  cleanDatabase,
  randomEmail,
} from './test-utils';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const email = randomEmail();
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password123',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(email.toLowerCase());
      expect(response.body.user).toHaveProperty('memberCode');
      expect(response.body.user.memberCode).toMatch(/^PHW-[A-Z0-9]{6}$/);
      expect(response.body.user.role).toBe('USER');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: randomEmail(),
          password: 'weak',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);

      // Validation errors return as array
      const messages = Array.isArray(response.body.message)
        ? response.body.message.join(' ').toLowerCase()
        : response.body.message.toLowerCase();
      expect(messages).toContain('password');
    });

    it('should reject duplicate email registration', async () => {
      const email = randomEmail();

      // First registration
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password123',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(201);

      // Second registration with same email
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password123',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(409);
    });

    it('should reject registration with missing fields', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: randomEmail(),
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    const testPassword = 'Password123';
    let testEmail: string;

    beforeEach(async () => {
      testEmail = randomEmail();
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          firstName: 'Test',
          lastName: 'User',
        });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body.tokens).toHaveProperty('accessToken');
      expect(response.body.tokens).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(testEmail.toLowerCase());
    });

    it('should reject login with invalid password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword123',
        })
        .expect(401);
    });

    it('should reject login with non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        })
        .expect(401);
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const email = randomEmail();
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password123',
          firstName: 'Test',
          lastName: 'User',
        });
      refreshToken = response.body.tokens.refreshToken;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should reject refresh with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      const email = randomEmail();
      const response = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'Password123',
          firstName: 'Test',
          lastName: 'User',
        });
      accessToken = response.body.tokens.accessToken;
    });

    it('should logout successfully with valid token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should reject logout without token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .expect(401);
    });
  });
});
