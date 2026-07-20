import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
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
  // Helmet — Headers de seguridad HTTP
  app.use(helmet());

  // CORS — Control de orígenes
  app.enableCors(corsConfig());

  // ─── Compresión ──────────────────────────────────────────────
  app.use(compression());

  // ─── Prefijo global + versionado (/api/v1) ───────────────────
  // Nota: usamos un prefijo fijo "api/v1" en vez de VersioningType.URI
  // de NestJS para evitar que ambos mecanismos se combinen y generen
  // rutas duplicadas (ej. /api/v1/v1/...) cuando los controladores
  // definan su propia versión. Si en el futuro se necesitan múltiples
  // versiones activas simultáneamente (v1 y v2), migrar a
  // app.enableVersioning({ type: VersioningType.URI }) y quitar la
  // versión fija del prefijo.
  const apiPrefix = process.env.API_PREFIX || 'api';
  const apiVersion = process.env.API_VERSION || 'v1';
  app.setGlobalPrefix(`${apiPrefix}/${apiVersion}`);

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
  const port = parseInt(process.env.PORT ?? '3000', 10) || 3000;
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
