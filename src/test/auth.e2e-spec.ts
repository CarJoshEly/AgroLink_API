import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { PrismaService } from '../database';

describe('Auth (e2e) — registro, verificación y login', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `e2e-auth-${Date.now()}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await app.close();
  });

  it('registra un comprador, verifica su correo, inicia sesión y consulta su perfil', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register/buyer')
      .send({ name: 'E2E Test Buyer', email, password: 'Segura123' })
      .expect(201);

    expect(registerRes.body.success).toBe(true);
    const verificationToken = registerRes.body.data.verificationToken;
    expect(verificationToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/api/v1/auth/verify-email')
      .send({ token: verificationToken })
      .expect(200);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Segura123' })
      .expect(200);

    const accessToken = loginRes.body.data.accessToken;
    expect(accessToken).toEqual(expect.any(String));

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(meRes.body.data.email).toBe(email);
    expect(meRes.body.data).not.toHaveProperty('passwordHash');
  });
});
