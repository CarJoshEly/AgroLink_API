import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppModule (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/v1/health (GET) — responde con el estado del sistema', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect((res) => {
        // 200 si la base de datos está disponible, 503 si no —
        // en ambos casos la ruta debe existir y responder con JSON.
        expect([200, 503]).toContain(res.status);
        expect(res.body).toHaveProperty('status');
      });
  });
});
