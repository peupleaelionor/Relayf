import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('API key required');
    }

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const record = await this.prisma.aPIKey.findUnique({
      where: { keyHash },
      include: { workspace: true },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (record.revokedAt) {
      throw new ForbiddenException('API key has been revoked');
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      throw new ForbiddenException('API key has expired');
    }

    await this.prisma.aPIKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    request.workspace = record.workspace;
    request.apiKey = record;
    return true;
  }
}
