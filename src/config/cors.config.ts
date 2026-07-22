import { Logger } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export const corsConfig = (): CorsOptions => {
  const originsEnv = process.env.CORS_ORIGINS || '';
  const origins = originsEnv
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const isProduction = process.env.NODE_ENV === 'production';

  // Sin CORS_ORIGINS configurado: en desarrollo se permite cualquier origen por
  // conveniencia; en producción se niega el acceso cross-origin por defecto
  // (fail-closed) en vez de caer a '*', que además nunca debe combinarse con credentials.
  let origin: CorsOptions['origin'];
  if (origins.length > 0) {
    origin = origins;
  } else if (isProduction) {
    new Logger('Bootstrap').warn(
      'CORS_ORIGINS no está configurado en producción: se denegarán las solicitudes cross-origin.',
    );
    origin = [];
  } else {
    origin = '*';
  }

  return {
    origin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    credentials: origins.length > 0,
    maxAge: 3600,
  };
};
