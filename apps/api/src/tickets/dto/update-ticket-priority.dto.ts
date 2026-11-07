import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { TicketPriority } from '@prisma/client';

export class UpdateTicketPriorityDto {
  @ApiProperty({ enum: TicketPriority, example: TicketPriority.HIGH })
  @IsEnum(TicketPriority, { message: 'Invalid ticket priority' })
  @IsNotEmpty()
  priority: TicketPriority;
}
