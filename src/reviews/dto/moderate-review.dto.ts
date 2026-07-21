import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ReviewModerationStatus } from '@prisma/client';

export class ModerateReviewDto {
  @ApiProperty({ enum: [ReviewModerationStatus.APPROVED, ReviewModerationStatus.REJECTED] })
  @IsIn([ReviewModerationStatus.APPROVED, ReviewModerationStatus.REJECTED])
  status: ReviewModerationStatus;
}
