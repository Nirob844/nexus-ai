import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { TICKET_QUEUE_NAME } from '../queue/queue.module';
import { SentimentScore, TicketStatus } from '@prisma/client';

export interface TicketJobPayload {
  ticketId: string;
  organizationId: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
}

@Processor(TICKET_QUEUE_NAME)
export class TicketProcessor extends WorkerHost {
  private readonly logger = new Logger(TicketProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<TicketJobPayload, any, string>): Promise<any> {
    const { ticketId, organizationId, subject, description } = job.data;
    this.logger.log(`[BullMQ] Processing async AI analysis for ticket #${ticketId}`);

    try {
      // 1. Initial heuristic classification & sentiment detection
      const isUrgent =
        /urgent|critical|broken|cannot access|down|emergency/i.test(subject) ||
        /urgent|critical|broken|down/i.test(description);

      const sentiment: SentimentScore = isUrgent
        ? SentimentScore.FRUSTRATED
        : SentimentScore.NEUTRAL;

      // 2. Persist AI Analysis
      const analysis = await this.prisma.aiAnalysis.create({
        data: {
          ticketId,
          category: job.data.category || 'General Support',
          intent: 'Customer reporting service access issue after plan change',
          sentiment,
          urgencyScore: isUrgent ? 9 : 4,
          keyEntities: ['Pro Plan', 'Dashboard Access'],
          summary: `Customer is requesting support regarding: "${subject}". Priority flagged based on issue description.`,
        },
      });

      // 3. Persist Initial Suggested Response Draft
      await this.prisma.aiSuggestion.create({
        data: {
          ticketId,
          suggestedReply: `Hello ${job.data.customer.name},\n\nThank you for reaching out to us. We have received your query regarding "${subject}". Our team is actively reviewing your account permissions and will update you shortly.\n\nBest regards,\nSupport Team`,
          confidence: 0.88,
          actionType: 'ACCOUNT_STATUS_CHECK',
          actionPayload: { checkSubscription: true },
        },
      });

      // 4. Update ticket status from AI_PROCESSING to OPEN
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.OPEN },
      });

      // 5. Record lifecycle event
      await this.prisma.ticketEvent.create({
        data: {
          ticketId,
          eventType: 'AI_ANALYSIS_COMPLETED',
          metadata: {
            analysisId: analysis.id,
            sentiment,
            urgencyScore: analysis.urgencyScore,
          },
        },
      });

      this.logger.log(`[BullMQ] AI Analysis completed successfully for ticket #${ticketId}`);
      return { success: true, ticketId, analysisId: analysis.id };
    } catch (error) {
      this.logger.error(`[BullMQ] Error processing ticket #${ticketId}: ${error.message}`, error.stack);
      throw error;
    }
  }
}
