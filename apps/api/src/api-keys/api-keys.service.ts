import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { CreateApiKeyDto } from './dto/api-key.dto';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private prisma: PrismaService) {}

  async generate(workspaceId: string, createdBy: string, dto: CreateApiKeyDto) {
    const rawKey = `rf_${crypto.randomBytes(32).toString('hex')}`;
    const keyPrefix = rawKey.slice(0, 8);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.aPIKey.create({
      data: {
        workspaceId,
        createdBy,
        name: dto.name,
        keyHash,
        keyPrefix,
        scopes: dto.scopes || [],
        expiresAt: dto.expiresAt,
        rateLimitRpm: dto.rateLimitRpm,
      },
    });

    this.logger.log(`API key created for workspace ${workspaceId} by user ${createdBy}`);
    return { key: rawKey, apiKey: { ...apiKey, keyHash: undefined } };
  }

  async list(workspaceId: string) {
    const keys = await this.prisma.aPIKey.findMany({
      where: { workspaceId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimitRpm: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        workspaceId: true,
        createdBy: true,
      },
    });
    return keys;
  }

  async revoke(id: string, workspaceId: string) {
    const key = await this.prisma.aPIKey.findFirst({ where: { id, workspaceId } });
    if (!key) throw new NotFoundException('API key not found');
    if (key.revokedAt) throw new NotFoundException('API key is already revoked');

    const updated = await this.prisma.aPIKey.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        revokedAt: true,
      },
    });

    this.logger.log(`API key ${id} revoked for workspace ${workspaceId}`);
    return updated;
  }
}
