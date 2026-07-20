import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Configuración
import { appConfig, databaseConfig } from './config';

// Módulos
import { DatabaseModule } from './database';
import { HealthModule } from './health/health.module';

// Filtros
import { AllExceptionsFilter, HttpExceptionFilter } from './common/filters';

// Interceptores
import {
  LoggingInterceptor,
  TransformInterceptor,
  TimeoutInterceptor,
} from './common/interceptors';

// Middleware
import { LoggerMiddleware } from './common/middleware';

@Module({
  imports: [
    // Configuración global de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, databaseConfig],
    }),

    // Rate Limiting global
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10) || 60000,
          limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10) || 100,
        },
      ],
    }),

    // Módulo de base de datos (global)
    DatabaseModule,

    // Health checks
    HealthModule,
  ],
  providers: [
    // Filtro global de excepciones (el orden importa: AllExceptions primero, HttpException después)
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },

    // Guard global de Rate Limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // Interceptores globales
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Aplicar LoggerMiddleware a todas las rutas
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
