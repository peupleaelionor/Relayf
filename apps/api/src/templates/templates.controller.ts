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
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto, PreviewTemplateDto } from './dto/template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';

@ApiTags('templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List templates' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.templatesService.findAll(workspaceId, +page, +limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a template' })
  create(@Param('workspaceId') workspaceId: string, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(workspaceId, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.templatesService.findOne(id, workspaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update template' })
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete template' })
  remove(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.templatesService.remove(id, workspaceId);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate template' })
  activate(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.templatesService.activate(id, workspaceId);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive template' })
  archive(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.templatesService.archive(id, workspaceId);
  }

  @Post(':id/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview template with sample data' })
  preview(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: PreviewTemplateDto,
  ) {
    return this.templatesService.preview(id, workspaceId, dto.sampleData);
  }
}
