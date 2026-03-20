import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Headers,
  RawBodyRequest,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { CreateCheckoutSessionDto, CreatePortalSessionDto } from './dto/billing.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('billing')
@Controller('workspaces/:workspaceId/billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiOperation({ summary: 'Get subscription info' })
  getSubscription(@Param('workspaceId') workspaceId: string) {
    return this.billingService.getSubscription(workspaceId);
  }

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe checkout session' })
  createCheckoutSession(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    return this.billingService.createCheckoutSession(workspaceId, user.id, dto);
  }

  @Post('portal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe billing portal session' })
  createPortalSession(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreatePortalSessionDto,
  ) {
    return this.billingService.createPortalSession(workspaceId, dto);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook received' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody || Buffer.from('');
    return this.billingService.handleWebhook(rawBody, signature);
  }

  @Get('usage')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  @ApiOperation({ summary: 'Get usage records' })
  getUsage(@Param('workspaceId') workspaceId: string) {
    return this.billingService.getUsage(workspaceId);
  }
}
