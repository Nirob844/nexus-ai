import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'NextGen Solutions Inc.' })
  @IsString()
  @IsNotEmpty({ message: 'Organization name is required' })
  name: string;

  @ApiPropertyOptional({ example: 'nextgen.com' })
  @IsOptional()
  @IsString()
  domain?: string;
}
