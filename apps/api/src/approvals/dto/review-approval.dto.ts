import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum ApprovalDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ReviewApprovalDto {
  @ApiProperty({ enum: ApprovalDecision, example: ApprovalDecision.APPROVE })
  @IsEnum(ApprovalDecision, { message: 'Decision must be either APPROVE or REJECT' })
  @IsNotEmpty()
  decision: ApprovalDecision;

  @ApiPropertyOptional({ example: 'Verified billing invoice and approved subscription correction.' })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
