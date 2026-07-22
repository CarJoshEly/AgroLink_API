import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../database';
import { ApiCommonErrorResponses, ApiOkResponseData, Public } from '../common/decorators';

@ApiTags('Health')
@Public()
@ApiCommonErrorResponses()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Verificar estado del sistema',
    description:
      'Verifica la conexión con PostgreSQL y el uso de memoria del servidor',
  })
  @ApiOkResponseData()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Verificar conexión con PostgreSQL
      () => this.prismaHealth.pingCheck('database', this.prisma),
      // Verificar uso de memoria (máximo 300MB heap)
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }
}
