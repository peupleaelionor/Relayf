import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { env, generateSlug } from '@relayflow/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signUp(dto: SignUpDto, ip?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        status: 'ACTIVE',
        lastLoginAt: new Date(),
        lastLoginIp: ip || null,
      },
    });

    if (dto.workspaceName) {
      const slug = await this.generateUniqueSlug(dto.workspaceName);
      const workspace = await this.prisma.workspace.create({
        data: {
          name: dto.workspaceName,
          slug,
          status: 'ACTIVE',
          plan: 'FREE',
        },
      });
      await this.prisma.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: 'OWNER',
          joinedAt: new Date(),
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email);
    this.logger.log(`User signed up: ${user.email}`);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async signIn(dto: SignInDto, ip?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account suspended');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), lastLoginIp: ip || null },
    });

    const tokens = await this.generateTokens(user.id, user.email);
    this.logger.log(`User signed in: ${user.email}`);
    return { ...tokens, user: this.sanitizeUser(user) };
  }

  async signOut(userId: string) {
    this.logger.log(`User signed out: ${userId}`);
    return { message: 'Signed out successfully' };
  }

  async refresh(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt || user.status === 'SUSPENDED') {
      throw new UnauthorizedException();
    }
    const { accessToken } = await this.generateTokens(user.id, user.email);
    return { accessToken };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaceMembers: {
          include: { workspace: true },
          where: { workspace: { deletedAt: null } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: env.JWT_SECRET,
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      }),
      this.jwtService.signAsync(payload, {
        secret: env.JWT_REFRESH_SECRET,
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      }),
    ]);
    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
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
