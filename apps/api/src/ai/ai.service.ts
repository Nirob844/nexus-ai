import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

export interface ClassifyResult {
  category: string;
  intent: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'FRUSTRATED';
  urgency_score: number;
  key_entities: string[];
  summary: string;
}

export interface SuggestResult {
  suggested_reply: string;
  action_type?: string;
  action_payload?: any;
  confidence: number;
  grounded_citations?: Array<{
    documentTitle: string;
    pageNumber?: number;
    similarity: number;
    excerpt: string;
  }>;
}

export interface SummarizeResult {
  summary: string;
  key_points: string[];
  suggested_next_steps: string[];
  handover_notes: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly aiBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.aiBaseUrl = this.configService.get<string>('AI_SERVICE_URL', 'http://localhost:8000');
  }

  /**
   * Classify ticket category, intent, sentiment and urgency
   */
  async classifyTicket(
    orgId: string,
    subject: string,
    description: string,
    customerName: string = 'Customer',
  ): Promise<ClassifyResult> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.aiBaseUrl}/api/v1/ai/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          description,
          customer_name: customerName,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI classification service returned status ${response.status}`);
      }

      const result: ClassifyResult = await response.json();
      const latencyMs = Date.now() - startTime;

      // Track AI Usage Log (PRD Module 9)
      await this.logAiUsage(orgId, 'TICKET_CLASSIFICATION', 'nexus-classifier-v1', latencyMs, 120, 60);

      return result;
    } catch (err) {
      this.logger.error(`Classification error: ${err.message}`, err.stack);
      // Resilient fallback
      return {
        category: 'General Support',
        intent: 'General inquiry',
        sentiment: 'NEUTRAL',
        urgency_score: 5,
        key_entities: [],
        summary: `Support ticket: ${subject}`,
      };
    }
  }

  /**
   * Generate knowledge-grounded reply suggestion
   */
  async suggestReply(
    orgId: string,
    subject: string,
    description: string,
    customerName: string = 'Customer',
  ): Promise<SuggestResult> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.aiBaseUrl}/api/v1/ai/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: orgId,
          subject,
          description,
          customer_name: customerName,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI suggestion service returned status ${response.status}`);
      }

      const result: SuggestResult = await response.json();
      const latencyMs = Date.now() - startTime;

      await this.logAiUsage(orgId, 'TICKET_REPLY_SUGGESTION', 'nexus-rag-suggester-v1', latencyMs, 350, 180);

      return result;
    } catch (err) {
      this.logger.error(`Suggestion error: ${err.message}`, err.stack);
      return {
        suggested_reply: `Hello ${customerName},\n\nThank you for reaching out. Our support engineering team is looking into this.\n\nBest regards,\nSupport Team`,
        confidence: 0.75,
      };
    }
  }

  /**
   * Summarize long ticket message threads
   */
  async summarizeTicket(
    orgId: string,
    ticketId: string,
    subject: string,
    messages: Array<{ senderType: string; senderName?: string; content: string }>,
  ): Promise<SummarizeResult> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.aiBaseUrl}/api/v1/ai/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          subject,
          messages: messages.map((m) => ({
            sender_type: m.senderType,
            sender_name: m.senderName,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI summarization service returned status ${response.status}`);
      }

      const result: SummarizeResult = await response.json();
      const latencyMs = Date.now() - startTime;

      await this.logAiUsage(orgId, 'TICKET_SUMMARIZATION', 'nexus-summarizer-v1', latencyMs, 250, 120);

      return result;
    } catch (err) {
      this.logger.error(`Summarization error: ${err.message}`, err.stack);
      return {
        summary: `Summary for ticket #${ticketId}: "${subject}" with ${messages.length} messages.`,
        key_points: [subject],
        suggested_next_steps: ['Review recent interaction'],
        handover_notes: `Handover for ticket #${ticketId}.`,
      };
    }
  }

  /**
   * Record AI Usage, Token Count, and Latency into ai_usage_logs (PRD Module 9)
   */
  private async logAiUsage(
    orgId: string,
    feature: string,
    model: string,
    latencyMs: number,
    promptTokens: number,
    completionTokens: number,
  ) {
    try {
      const totalTokens = promptTokens + completionTokens;
      // Estimated cost ~$0.000002 per token
      const estimatedCostUsd = totalTokens * 0.000002;

      await this.prisma.aiUsageLog.create({
        data: {
          organizationId: orgId,
          feature,
          model,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd,
          latencyMs,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to record AI usage log: ${err.message}`);
    }
  }
}
