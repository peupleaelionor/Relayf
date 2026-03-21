import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { PrismaService } from '../prisma.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId: string, page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = { workspaceId, deletedAt: null };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.contact.count({ where }),
    ]);

    return {
      data: contacts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, workspaceId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        tags: { include: { tag: true } },
        optOutRecords: true,
        consentRecords: true,
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async create(workspaceId: string, dto: CreateContactDto) {
    if (!dto.email && !dto.phone && !dto.telegramId) {
      throw new BadRequestException('At least one of email, phone, or telegramId is required');
    }

    if (dto.email) {
      const existing = await this.prisma.contact.findFirst({
        where: { workspaceId, email: dto.email, deletedAt: null },
      });
      if (existing) throw new ConflictException('Contact with this email already exists');
    }

    return this.prisma.contact.create({
      data: { workspaceId, ...dto, status: 'ACTIVE' },
    });
  }

  async update(id: string, workspaceId: string, dto: UpdateContactDto) {
    const contact = await this.prisma.contact.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!contact) throw new NotFoundException('Contact not found');
    return this.prisma.contact.update({ where: { id }, data: dto });
  }

  async remove(id: string, workspaceId: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!contact) throw new NotFoundException('Contact not found');
    return this.prisma.contact.update({ where: { id }, data: { deletedAt: new Date(), status: 'UNSUBSCRIBED' } });
  }

  async importCsv(workspaceId: string, csvData: string) {
    let records: any[];
    try {
      records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (e) {
      throw new BadRequestException('Invalid CSV data');
    }

    const results = { created: 0, updated: 0, failed: 0, errors: [] as string[] };

    for (const record of records) {
      try {
        const email = record.email || record.Email;
        const phone = record.phone || record.Phone;
        const telegramId = record.telegramId || record.telegram_id;
        const firstName = record.firstName || record.first_name || record.FirstName;
        const lastName = record.lastName || record.last_name || record.LastName;
        const externalId = record.externalId || record.external_id;

        if (!email && !phone && !telegramId) {
          results.failed++;
          results.errors.push(`Row missing contact identifier: ${JSON.stringify(record)}`);
          continue;
        }

        if (email) {
          const existing = await this.prisma.contact.findFirst({
            where: { workspaceId, email, deletedAt: null },
          });
          if (existing) {
            await this.prisma.contact.update({
              where: { id: existing.id },
              data: { phone, telegramId, firstName, lastName, externalId },
            });
            results.updated++;
            continue;
          }
        }

        await this.prisma.contact.create({
          data: { workspaceId, email, phone, telegramId, firstName, lastName, externalId, status: 'ACTIVE' },
        });
        results.created++;
      } catch (err) {
        results.failed++;
        results.errors.push(String(err));
      }
    }

    this.logger.log(`CSV import for workspace ${workspaceId}: ${JSON.stringify(results)}`);
    return results;
  }

  async optOut(id: string, workspaceId: string, channel: string, reason?: string, ip?: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!contact) throw new NotFoundException('Contact not found');

    const existing = await this.prisma.optOutRecord.findFirst({
      where: { workspaceId, contactId: id, channel: channel as any },
    });
    if (existing) return existing;

    const record = await this.prisma.optOutRecord.create({
      data: { workspaceId, contactId: id, channel: channel as any, reason, ipAddress: ip, optedOutAt: new Date() },
    });

    if (channel === 'EMAIL') {
      await this.prisma.contact.update({ where: { id }, data: { status: 'UNSUBSCRIBED' } });
    }

    return record;
  }

  async getConsent(id: string, workspaceId: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!contact) throw new NotFoundException('Contact not found');
    return this.prisma.consentRecord.findMany({ where: { workspaceId, contactId: id } });
  }
}
