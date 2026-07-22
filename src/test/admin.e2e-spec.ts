import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { PrismaService } from '../database';

// Contraseña de los usuarios sembrados por prisma/seed.ts (SEED_PASSWORD).
const SEED_PASSWORD = 'AgroLink2026!';

describe('Admin (e2e) — dashboard consolidado', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

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
    await app.close();
  });

  it('devuelve el dashboard administrativo consolidado (usuarios, vendedores, productos, pedidos, reseñas, reportes, finanzas)', async () => {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', isActive: true } });
    expect(admin).not.toBeNull();

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: admin!.email, password: SEED_PASSWORD })
      .expect(200);
    const adminToken = loginRes.body.data.accessToken;

    const dashboardRes = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const data = dashboardRes.body.data;
    for (const key of ['users', 'sellers', 'products', 'orders', 'reviews', 'reports', 'finance']) {
      expect(data).toHaveProperty(key);
    }
  });

  it('rechaza el acceso al dashboard sin autenticación', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/dashboard').expect(401);
  });
});
