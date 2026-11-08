import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { TICKET_QUEUE_NAME } from '../queue/queue.module';
import { SentimentScore, TicketPriority, TicketStatus } from '@prisma/client';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {
    super();
  }

  async process(job: Job<TicketJobPayload, any, string>): Promise<any> {
    const { ticketId, organizationId, subject, description, customer } = job.data;
    this.logger.log(`[BullMQ] Starting AI analysis pipeline for ticket #${ticketId}`);

    try {
      // 1. Call Python AI Microservice for Classification & Sentiment Analysis
      const classification = await this.aiService.classifyTicket(
        organizationId,
        subject,
        description,
        customer.name,
      );

      // 2. Call Python AI Microservice for Knowledge-Grounded Suggestion Draft
      const suggestion = await this.aiService.suggestReply(
        organizationId,
        subject,
        description,
        customer.name,
      );

      // 3. Persist AI Analysis record
      const analysis = await this.prisma.aiAnalysis.create({
        data: {
          ticketId,
          category: classification.category,
          intent: classification.intent,
          sentiment: classification.sentiment as SentimentScore,
          urgencyScore: classification.urgency_score,
          keyEntities: classification.key_entities,
          summary: classification.summary,
        },
      });

      // 4. Persist AI Suggestion record
      const savedSuggestion = await this.prisma.aiSuggestion.create({
        data: {
          ticketId,
          suggestedReply: suggestion.suggested_reply,
          actionType: suggestion.action_type || null,
          actionPayload: suggestion.action_payload || {},
          confidence: suggestion.confidence,
        },
      });

      // 5. Dynamic Priority Adjustment if urgency is critical (>= 8)
      let adjustedPriority: TicketPriority | undefined = undefined;
      if (classification.urgency_score >= 8) {
        adjustedPriority = TicketPriority.URGENT;
      }

      // 6. Update ticket status from AI_PROCESSING to OPEN
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: TicketStatus.OPEN,
          category: classification.category,
          ...(adjustedPriority ? { priority: adjustedPriority } : {}),
        },
      });

      // 7. Record lifecycle event in audit trail
      await this.prisma.ticketEvent.create({
        data: {
          ticketId,
          eventType: 'AI_ANALYSIS_COMPLETED',
          metadata: {
            analysisId: analysis.id,
            suggestionId: savedSuggestion.id,
            sentiment: classification.sentiment,
            urgencyScore: classification.urgency_score,
            adjustedPriority,
          },
        },
      });

      this.logger.log(
        `[BullMQ] AI Analysis and Knowledge Grounding completed for ticket #${ticketId} (Category: ${classification.category}, Sentiment: ${classification.sentiment})`,
      );
      return {
        success: true,
        ticketId,
        analysisId: analysis.id,
        suggestionId: savedSuggestion.id,
      };
    } catch (error) {
      this.logger.error(`[BullMQ] Error in AI pipeline for ticket #${ticketId}: ${error.message}`, error.stack);
      // Fallback: update status to OPEN so ticket is not stuck
      await this.prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.OPEN },
      });
      throw error;
    }
  }
}
