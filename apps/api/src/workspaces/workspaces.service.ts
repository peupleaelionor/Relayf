import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto, InviteMemberDto, UpdateMemberRoleDto } from './dto/workspace.dto';
import { generateSlug } from '@relayflow/config';
import { randomBytes } from 'crypto';

@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    const slug = await this.generateUniqueSlug(dto.name);
    const workspace = await this.prisma.workspace.create({
      data: {
        name: dto.name,
        slug,
        timezone: dto.timezone,
        locale: dto.locale,
        status: 'ACTIVE',
        plan: 'FREE',
      },
    });
    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId,
        role: 'OWNER',
        joinedAt: new Date(),
      },
    });
    return workspace;
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId, workspace: { deletedAt: null } },
      include: { workspace: true },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role }));
  }

  async findOne(id: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      },
    });
    if (!workspace || workspace.deletedAt) throw new NotFoundException('Workspace not found');
    await this.requireMember(id, userId);
    return workspace;
  }

  async update(id: string, userId: string, dto: UpdateWorkspaceDto) {
    await this.requireRole(id, userId, ['OWNER', 'ADMIN']);
    return this.prisma.workspace.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.requireRole(id, userId, ['OWNER']);
    return this.prisma.workspace.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELLED' },
    });
  }

  async inviteMember(workspaceId: string, invitedByUserId: string, dto: InviteMemberDto) {
    await this.requireRole(workspaceId, invitedByUserId, ['OWNER', 'ADMIN']);

    const existingInvite = await this.prisma.invite.findFirst({
      where: { workspaceId, email: dto.email, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (existingInvite) throw new ConflictException('An active invite already exists for this email');

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      const existingMember = await this.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      });
      if (existingMember) throw new ConflictException('User is already a member');
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await this.prisma.invite.create({
      data: {
        workspaceId,
        email: dto.email,
        role: dto.role,
        token: randomBytes(32).toString('hex'),
        expiresAt,
        invitedBy: invitedByUserId,
      },
    });
    this.logger.log(`Invite created for ${dto.email} to workspace ${workspaceId}`);
    return invite;
  }

  async acceptInvite(token: string, userId: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite has expired');
    if (invite.acceptedAt) throw new BadRequestException('Invite already accepted');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.email !== invite.email) {
      throw new ForbiddenException('This invite is for a different email address');
    }

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
    });
    if (existing) throw new ConflictException('Already a member of this workspace');

    await this.prisma.$transaction([
      this.prisma.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId,
          role: invite.role,
          invitedBy: invite.invitedBy,
          joinedAt: new Date(),
        },
      }),
      this.prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return { message: 'Invite accepted successfully' };
  }

  async listMembers(workspaceId: string, userId: string) {
    await this.requireMember(workspaceId, userId);
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, status: true } } },
    });
  }

  async removeMember(workspaceId: string, requestingUserId: string, targetUserId: string) {
    await this.requireRole(workspaceId, requestingUserId, ['OWNER', 'ADMIN']);
    const targetMember = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!targetMember) throw new NotFoundException('Member not found');
    if (targetMember.role === 'OWNER') throw new ForbiddenException('Cannot remove workspace owner');
    return this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
  }

  async updateMemberRole(workspaceId: string, requestingUserId: string, targetUserId: string, dto: UpdateMemberRoleDto) {
    await this.requireRole(workspaceId, requestingUserId, ['OWNER']);
    const targetMember = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
    if (!targetMember) throw new NotFoundException('Member not found');
    return this.prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
      data: { role: dto.role },
    });
  }

  private async requireMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
    return member;
  }

  private async requireRole(workspaceId: string, userId: string, roles: UserRole[]) {
    const member = await this.requireMember(workspaceId, userId);
    if (!roles.includes(member.role)) {
      throw new ForbiddenException(`Requires one of roles: ${roles.join(', ')}`);
    }
    return member;
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = generateSlug(name);
    let slug = base;
    let counter = 0;
    while (true) {
      const existing = await this.prisma.workspace.findUnique({ where: { slug } });
      if (!existing) return slug;
      counter++;
      slug = `${base}-${counter}`;
    }
  }
}
