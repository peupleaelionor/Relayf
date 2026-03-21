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
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto, ImportContactsDto } from './dto/contact.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';

@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List contacts with pagination and search' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.contactsService.findAll(workspaceId, +page, +limit, search);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a contact' })
  create(@Param('workspaceId') workspaceId: string, @Body() dto: CreateContactDto) {
    return this.contactsService.create(workspaceId, dto);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import contacts from CSV' })
  importCsv(@Param('workspaceId') workspaceId: string, @Body() dto: ImportContactsDto) {
    return this.contactsService.importCsv(workspaceId, dto.csvData);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact by ID' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.contactsService.findOne(id, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a contact' })
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete a contact' })
  remove(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.contactsService.remove(id, workspaceId);
  }

  @Post(':id/opt-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Opt out a contact from a channel' })
  optOut(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() body: { channel: string; reason?: string },
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket?.remoteAddress;
    return this.contactsService.optOut(id, workspaceId, body.channel, body.reason, ip);
  }

  @Get(':id/consent')
  @ApiOperation({ summary: 'Get consent records for a contact' })
  getConsent(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.contactsService.getConsent(id, workspaceId);
  }
}
