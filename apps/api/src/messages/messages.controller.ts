import {
  Controller,
  Get,
  Post,
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
import { MessagesService } from './messages.service';
import { SendMessageDto } from './dto/message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';

@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a single message' })
  sendMessage(@Param('workspaceId') workspaceId: string, @Body() dto: SendMessageDto) {
    return this.messagesService.sendMessage(workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List messages with filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'channel', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'contactId', required: false, type: String })
  @ApiQuery({ name: 'campaignId', required: false, type: String })
  listMessages(
    @Param('workspaceId') workspaceId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('channel') channel?: string,
    @Query('status') status?: string,
    @Query('contactId') contactId?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.messagesService.listMessages(workspaceId, +page, +limit, {
      channel,
      status,
      contactId,
      campaignId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get message by ID with events' })
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.messagesService.findOne(id, workspaceId);
  }
}
