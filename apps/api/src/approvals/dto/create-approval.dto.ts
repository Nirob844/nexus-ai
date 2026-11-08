import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateApprovalDto {
  @ApiProperty({ example: 'SUBSCRIPTION_CORRECTION', description: 'Action type to execute upon approval' })
  @IsString()
  @IsNotEmpty({ message: 'Action type is required' })
  actionType: string;

  @ApiProperty({
    example: { customerId: 'c05639c7-90e5-4a24-945e-cab564a41c52', targetPlan: 'Pro', creditDays: 30 },
    description: 'Arbitrary validated payload containing parameters for the action',
  })
  @IsObject()
  @IsNotEmpty({ message: 'Action payload is required' })
  actionPayload: Record<string, any>;

  @ApiPropertyOptional({
    example: '79cb577d-a8bf-47e4-9bca-280b54630b14',
    description: 'Optional AI suggestion UUID that prompted this approval',
  })
  @IsOptional()
  @IsUUID('4', { message: 'suggestionId must be a valid UUID' })
  suggestionId?: string;
}
