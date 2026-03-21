import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get analytics overview (totals, rates)' })
  getOverview(@Param('workspaceId') workspaceId: string) {
    return this.analyticsService.getOverview(workspaceId);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'Get campaign performance analytics' })
  getCampaignAnalytics(@Param('workspaceId') workspaceId: string) {
    return this.analyticsService.getCampaignAnalytics(workspaceId);
  }

  @Get('messages-over-time')
  @ApiOperation({ summary: 'Get message counts grouped by day (last 30 days)' })
  getMessagesOverTime(@Param('workspaceId') workspaceId: string) {
    return this.analyticsService.getMessagesOverTime(workspaceId);
  }
}
