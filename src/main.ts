import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { swaggerConfig, corsConfig } from './config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Crear aplicación NestJS
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // ─── Seguridad ───────────────────────────────────────────────
  // Helmet — Headers de seguridad HTTP (CSP ajustada para permitir que Swagger UI siga funcionando)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
          scriptSrc: [`'self'`, `'unsafe-inline'`],
        },
      },
    }),
  );

  // CORS — Control de orígenes
  app.enableCors(corsConfig());

  // ─── Compresión ──────────────────────────────────────────────
  app.use(compression());

  // ─── Prefijo global (/api/v1) ────────────────────────────────
  const apiPrefix = process.env.API_PREFIX || 'api';
  const apiVersion = process.env.API_VERSION || 'v1';
  app.setGlobalPrefix(`${apiPrefix}/${apiVersion}`);

  // ─── Versionado de API ───────────────────────────────────────
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // ─── Validaciones globales ───────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Eliminar propiedades no definidas en el DTO
      forbidNonWhitelisted: true, // Rechazar propiedades no permitidas
      transform: true, // Transformar payloads al tipo del DTO
      transformOptions: {
        enableImplicitConversion: true,
      },
      stopAtFirstError: false, // Mostrar todos los errores de validación
    }),
  );

  // ─── Swagger / OpenAPI ───────────────────────────────────────
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
    },
    customSiteTitle: 'AgroLink Honduras API — Documentación',
  });

  // ─── Iniciar servidor ────────────────────────────────────────
  const port = parseInt(process.env.PORT ?? '3000', 10) || 3000
  await app.listen(port);

  logger.log(`🌿 =========================================`);
  logger.log(`🌿  AgroLink Honduras API`);
  logger.log(`🌿  Conectando el ecosistema agrícola`);
  logger.log(`🌿 ─────────────────────────────────────────`);
  logger.log(`🌿  Entorno:    ${process.env.NODE_ENV || 'development'}`);
  logger.log(`🌿  Puerto:     ${port}`);
  logger.log(`🌿  API:        http://localhost:${port}/${apiPrefix}/${apiVersion}`);
  logger.log(`🌿  Swagger:    http://localhost:${port}/${apiPrefix}/docs`);
  logger.log(`🌿  Health:     http://localhost:${port}/${apiPrefix}/${apiVersion}/health`);
  logger.log(`🌿 =========================================`);
}

bootstrap();
