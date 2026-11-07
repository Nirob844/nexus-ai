import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { SystemRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @ApiPropertyOptional({ enum: SystemRole })
  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
