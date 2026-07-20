import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

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
    await this.$connect();
    this.logger.log('✅ Conexión a PostgreSQL establecida correctamente');

    // Soft Delete Middleware — Filtra registros eliminados automáticamente
    this.$use(async (params, next) => {
      // Aplicar soft delete para modelos con campo deletedAt
      const modelsWithSoftDelete = ['User', 'Product'];

      if (modelsWithSoftDelete.includes(params.model)) {
        // Interceptar DELETE para convertirlo en soft delete
        if (params.action === 'delete') {
          params.action = 'update';
          params.args['data'] = { deletedAt: new Date() };
        }

        if (params.action === 'deleteMany') {
          params.action = 'updateMany';
          if (params.args.data !== undefined) {
            params.args.data['deletedAt'] = new Date();
          } else {
            params.args['data'] = { deletedAt: new Date() };
          }
        }

        // Filtrar registros soft-deleted en consultas
        if (params.action === 'findUnique' || params.action === 'findFirst') {
          params.action = 'findFirst';
          if (params.args.where) {
            params.args.where['deletedAt'] = null;
          }
        }

        if (params.action === 'findMany') {
          if (params.args.where) {
            if (params.args.where.deletedAt === undefined) {
              params.args.where['deletedAt'] = null;
            }
          } else {
            params.args['where'] = { deletedAt: null };
          }
        }
      }

      return next(params);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Conexión a PostgreSQL cerrada');
  }
}
