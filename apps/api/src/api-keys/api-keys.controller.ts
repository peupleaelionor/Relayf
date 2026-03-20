import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/api-key.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceGuard)
@Controller('workspaces/:workspaceId/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate a new API key (plaintext returned once)' })
  @ApiResponse({ status: 201, description: 'API key generated - save the plaintext key!' })
  generate(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.generate(workspaceId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List API keys (hashes never returned)' })
  list(@Param('workspaceId') workspaceId: string) {
    return this.apiKeysService.list(workspaceId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an API key' })
  revoke(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.apiKeysService.revoke(id, workspaceId);
  }
}
