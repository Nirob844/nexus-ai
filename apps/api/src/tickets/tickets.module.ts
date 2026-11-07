import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { TicketProcessor } from './tickets.processor';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService, TicketProcessor],
  exports: [TicketsService],
})
export class TicketsModule {}
