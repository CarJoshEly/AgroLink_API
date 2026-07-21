import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ReportStatus } from '@prisma/client';

const ALLOWED_STATUSES = [ReportStatus.REVIEWED, ReportStatus.RESOLVED, ReportStatus.DISMISSED];

export class UpdateReportStatusDto {
  @ApiProperty({ enum: ALLOWED_STATUSES })
  @IsIn(ALLOWED_STATUSES)
  status: ReportStatus;
}
