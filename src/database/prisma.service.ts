import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Modelos con columna deletedAt — nunca se eliminan físicamente. */
const SOFT_DELETE_MODELS = [
  'user',
  'product',
  'sellerProfile',
  'productReview',
  'sellerReview',
] as const;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private keepAliveTimer?: NodeJS.Timeout;

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Conexión a PostgreSQL establecida correctamente');
    } catch (error) {
      this.logger.error(`❌ No se pudo conectar a PostgreSQL: ${(error as Error).message}`);
    }

    // El pooler gestionado (Supabase/PgBouncer) cierra conexiones que
    // quedan inactivas por un rato, y el cliente de Prisma no se reconecta
    // solo cuando eso pasa — la siguiente query simplemente cuelga hasta
    // timeout. Un solo ping por ciclo no basta: Prisma mantiene su propio
    // pool de `connection_limit` conexiones (ver DATABASE_URL) y un ping
    // aislado solo toca UNA de ellas, dejando el resto inactivas igual. Se
    // disparan tantos pings en paralelo como `connection_limit` para que
    // cada conexión del pool reciba actividad en cada ciclo.
    const POOL_SIZE = 5;
    this.keepAliveTimer = setInterval(() => {
      for (let i = 0; i < POOL_SIZE; i++) {
        this.$queryRaw`SELECT 1`.catch((error: Error) => {
          this.logger.warn(`Keep-alive de PostgreSQL falló: ${error.message}`);
        });
      }
    }, 2 * 60 * 1000);
    this.keepAliveTimer.unref?.();

    // Soft Delete — Filtra registros eliminados automáticamente y convierte
    // delete/deleteMany en update/updateMany. `$use` (client middleware) fue
    // retirado del tipado del cliente de Prisma; se reemplaza por
    // extensiones (`$extends`), reasignando únicamente los delegados de los
    // modelos con soft delete sobre esta misma instancia.
    const queryConfig: Record<string, unknown> = {};
    const modelConfig: Record<string, unknown> = {};

    for (const model of SOFT_DELETE_MODELS) {
      queryConfig[model] = {
        async findUnique({ args, query }: any) {
          return query({ ...args, where: { ...args.where, deletedAt: null } });
        },
        async findFirst({ args, query }: any) {
          return query({ ...args, where: { ...args.where, deletedAt: null } });
        },
        async findMany({ args, query }: any) {
          if (args.where?.deletedAt === undefined) {
            args = { ...args, where: { ...args.where, deletedAt: null } };
          }
          return query(args);
        },
      };
      modelConfig[model] = {
        async delete({ where }: any) {
          return (this as any).update({ where, data: { deletedAt: new Date() } });
        },
        async deleteMany({ where }: any) {
          return (this as any).updateMany({ where, data: { deletedAt: new Date() } });
        },
      };
    }

    const extended = this.$extends({
      query: queryConfig,
      model: modelConfig,
    } as any);

    for (const model of SOFT_DELETE_MODELS) {
      (this as any)[model] = (extended as any)[model];
    }
  }

  async onModuleDestroy() {
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    await this.$disconnect();
    this.logger.log('🔌 Conexión a PostgreSQL cerrada');
  }
}
