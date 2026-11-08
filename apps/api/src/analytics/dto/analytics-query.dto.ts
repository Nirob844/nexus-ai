import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum TimeRangeFilter {
  TODAY = '24h',
  LAST_7_DAYS = '7d',
  LAST_30_DAYS = '30d',
  LAST_90_DAYS = '90d',
  ALL = 'all',
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Time window for metrics calculation',
    enum: TimeRangeFilter,
    default: TimeRangeFilter.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(TimeRangeFilter)
  timeRange?: TimeRangeFilter = TimeRangeFilter.LAST_30_DAYS;

  @ApiPropertyOptional({
    description: 'Filter by ticket category',
    example: 'Billing & Subscriptions',
  })
  @IsOptional()
  @IsString()
  category?: string;
}

export class AiUsageQueryDto {
  @ApiPropertyOptional({
    description: 'Time window for AI usage analytics',
    enum: TimeRangeFilter,
    default: TimeRangeFilter.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(TimeRangeFilter)
  timeRange?: TimeRangeFilter = TimeRangeFilter.LAST_30_DAYS;

  @ApiPropertyOptional({
    description: 'Filter by specific AI feature',
    example: 'TICKET_CLASSIFICATION',
  })
  @IsOptional()
  @IsString()
  feature?: string;
}
