import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTicketMessageDto {
  @ApiProperty({ example: 'Hello, our team has unlocked your Pro features. Could you please check now?' })
  @IsString()
  @IsNotEmpty({ message: 'Message content is required' })
  content: string;

  @ApiPropertyOptional({
    example: false,
    description: 'If true, message is an internal note visible only to employees and agents',
  })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
