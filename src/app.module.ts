import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Configuración
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  supabaseConfig,
  googleMapsConfig,
  mailConfig,
  paypalConfig,
} from './config';

// Módulos
import { DatabaseModule } from './database';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth';
import { MailModule } from './mail';
import { StorageModule } from './storage';
import { UsersModule } from './users';
import { GoogleMapsModule } from './google-maps';
import { LocationsModule } from './locations';
import { CategoriesModule } from './categories';
import { ProductsModule } from './products';
import { InventoryModule } from './inventory';
import { OrdersModule } from './orders';
import { CartModule } from './cart';
import { ReviewsModule } from './reviews';
import { FavoritesModule } from './favorites';
import { ReportsModule } from './reports';
import { NotificationsModule } from './notifications';
import { FinanceModule } from './finance';
import { AuditLogModule } from './audit';
import { AdminModule } from './admin';

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

// Guards
import { JwtAuthGuard, RolesGuard } from './common/guards';

@Module({
  imports: [
    // Configuración global de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, databaseConfig, jwtConfig, supabaseConfig, googleMapsConfig, mailConfig, paypalConfig],
    }),

    // Rate Limiting global
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: parseInt(process.env.THROTTLE_TTL || '', 10) || 60000,
          limit: parseInt(process.env.THROTTLE_LIMIT || '', 10) || 100,
        },
      ],
      // Mensaje en español — por defecto el paquete manda el string técnico
      // "ThrottlerException: Too Many Requests", que los clientes (móvil/web)
      // muestran tal cual al usuario si no lo sobreescribimos aquí.
      errorMessage: 'Demasiados intentos. Espera un momento antes de volver a intentarlo.',
    }),

    // Módulo de base de datos (global)
    DatabaseModule,

    // Correo (global)
    MailModule,

    // Almacenamiento de archivos (global)
    StorageModule,

    // Google Maps (global)
    GoogleMapsModule,

    // Notificaciones (global)
    NotificationsModule,

    // Auditoría (global)
    AuditLogModule,

    // Autenticación y autorización
    AuthModule,

    // Usuarios y verificación de vendedores
    UsersModule,

    // Ubicación y geolocalización
    LocationsModule,

    // Categorías y productos (Marketplace)
    CategoriesModule,
    ProductsModule,
    InventoryModule,
    OrdersModule,
    CartModule,

    // Interacción social: reseñas, favoritos, reportes
    ReviewsModule,
    FavoritesModule,
    ReportsModule,

    // Arquitectura financiera (métodos de pago, comisiones, transacciones)
    FinanceModule,

    // Panel administrativo (estadísticas, auditoría, configuración, productos)
    AdminModule,

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

    // Guard global de autenticación JWT (bypass con @Public())
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },

    // Guard global de autorización por rol (@Roles(...))
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
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
