import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TicketPriority } from '@prisma/client';

export class AttachmentInputDto {
  @ApiProperty({ example: 'screenshot.png' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ example: 'https://storage.nexus-ai.com/uploads/screenshot.png' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({ example: 1048576, description: 'File size in bytes' })
  fileSize: number;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  fileType: string;
}

export class CreateTicketDto {
  @ApiProperty({ example: 'Cannot access my pro dashboard features' })
  @IsString()
  @IsNotEmpty({ message: 'Subject is required' })
  subject: string;

  @ApiProperty({
    example: 'I upgraded to the Pro tier today but the features are still locked in my account.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  description: string;

  @ApiPropertyOptional({ example: 'Billing & Subscriptions' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  // For unauthenticated/customer submissions or agent-created tickets
  @ApiPropertyOptional({ example: 'customer@example.com' })
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiPropertyOptional({ example: 'Jane Customer' })
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional({ type: [AttachmentInputDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AttachmentInputDto)
  attachments?: AttachmentInputDto[];
}
