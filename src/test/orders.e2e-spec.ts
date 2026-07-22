import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ProductUnit, TransactionStatus, VerificationStatus } from '@prisma/client';
import { AppModule } from '../app.module';
import { PrismaService } from '../database';

// Contraseña de los usuarios sembrados por prisma/seed.ts (SEED_PASSWORD).
const SEED_PASSWORD = 'AgroLink2026!';

describe('Orders (e2e) — checkout → accept → prepare → deliver', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let orderId: string;
  let productId: string;

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
    if (orderId) {
      await prisma.transaction.deleteMany({ where: { orderId } });
      await prisma.orderStatusHistory.deleteMany({ where: { orderId } });
      await prisma.orderItem.deleteMany({ where: { orderId } });
      await prisma.order.delete({ where: { id: orderId } }).catch(() => undefined);
    }
    if (productId) {
      await prisma.product.delete({ where: { id: productId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('completa el ciclo de vida de un pedido y registra la transacción financiera', async () => {
    const seller = await prisma.sellerProfile.findFirst({
      where: { verificationStatus: VerificationStatus.VERIFIED },
      include: { user: true },
    });
    const buyer = await prisma.user.findFirst({ where: { role: 'CUSTOMER', isActive: true } });
    const category = await prisma.category.findFirst({ where: { isActive: true } });
    expect(seller).not.toBeNull();
    expect(buyer).not.toBeNull();
    expect(category).not.toBeNull();

    const sellerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: seller!.user.email, password: SEED_PASSWORD })
      .expect(200);
    const sellerToken = sellerLogin.body.data.accessToken;

    const buyerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: buyer!.email, password: SEED_PASSWORD })
      .expect(200);
    const buyerToken = buyerLogin.body.data.accessToken;

    const productRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        categoryId: category!.id,
        name: 'Producto E2E Descartable',
        description: 'Producto creado únicamente para la prueba end-to-end de pedidos.',
        price: 25,
        unit: ProductUnit.UNIT,
        stock: 5,
      })
      .expect(201);
    productId = productRes.body.data.id;

    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({ productId, quantity: 1 })
      .expect(201);

    const checkoutRes = await request(app.getHttpServer())
      .post('/api/v1/cart/checkout')
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(201);
    orderId = checkoutRes.body.data[0].id;

    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/accept`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/prepare`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);

    const transaction = await prisma.transaction.findUnique({ where: { orderId } });
    expect(transaction).not.toBeNull();
    expect(transaction!.status).toBe(TransactionStatus.PENDING);
  });
});
