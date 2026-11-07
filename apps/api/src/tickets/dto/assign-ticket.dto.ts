import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignTicketDto {
  @ApiProperty({ example: '51113c9c-0b2c-45fd-bbdf-0f3f3904a451', description: 'Agent user ID' })
  @IsUUID('4', { message: 'Agent ID must be a valid UUID' })
  @IsNotEmpty()
  agentId: string;
}
