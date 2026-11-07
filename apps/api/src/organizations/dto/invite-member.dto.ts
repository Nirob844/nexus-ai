import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SystemRole } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({ example: 'colleague@example.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Smith' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ enum: SystemRole, default: SystemRole.EMPLOYEE })
  @IsEnum(SystemRole, { message: 'Invalid system role' })
  systemRole: SystemRole;
}
