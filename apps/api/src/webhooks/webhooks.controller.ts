import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';

@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  @ApiOperation({ summary: 'List webhook endpoints' })
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.webhooksService.findAll(workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a webhook endpoint' })
  create(@Param('workspaceId') workspaceId: string, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(workspaceId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get webhook endpoint by ID' })
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.webhooksService.findOne(id, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update webhook endpoint' })
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete webhook endpoint' })
  remove(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.webhooksService.remove(id, workspaceId);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'List webhook deliveries for an endpoint' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listDeliveries(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.webhooksService.listDeliveries(id, workspaceId, +page, +limit);
  }
}
