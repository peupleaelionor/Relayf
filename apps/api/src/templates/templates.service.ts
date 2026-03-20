import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [templates, total] = await Promise.all([
      this.prisma.template.findMany({
        where: { workspaceId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.template.count({ where: { workspaceId } }),
    ]);
    return { data: templates, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, workspaceId: string) {
    const template = await this.prisma.template.findFirst({ where: { id, workspaceId } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async create(workspaceId: string, dto: CreateTemplateDto) {
    return this.prisma.template.create({
      data: {
        workspaceId,
        name: dto.name,
        channel: dto.channel,
        body: dto.body,
        subject: dto.subject,
        variables: dto.variables || [],
        previewText: dto.previewText,
        status: 'DRAFT',
        version: 1,
      },
    });
  }

  async update(id: string, workspaceId: string, dto: UpdateTemplateDto) {
    await this.findOne(id, workspaceId);
    return this.prisma.template.update({ where: { id }, data: { ...dto, version: { increment: 1 } } });
  }

  async remove(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.template.delete({ where: { id } });
  }

  async activate(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.template.update({ where: { id }, data: { status: 'ACTIVE' } });
  }

  async archive(id: string, workspaceId: string) {
    await this.findOne(id, workspaceId);
    return this.prisma.template.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }

  async preview(id: string, workspaceId: string, sampleData?: Record<string, string>) {
    const template = await this.findOne(id, workspaceId);
    const data = sampleData || {};
    const previewBody = this.replaceVariables(template.body, data);
    const previewSubject = template.subject ? this.replaceVariables(template.subject, data) : undefined;
    return { body: previewBody, subject: previewSubject, variables: template.variables };
  }

  replaceVariables(body: string, vars: Record<string, string>): string {
    return body.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
      const trimmed = key.trim();
      return vars[trimmed] !== undefined ? vars[trimmed] : match;
    });
  }
}
