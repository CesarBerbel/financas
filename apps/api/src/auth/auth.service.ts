import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, FinancialProfileType } from '@prisma/client';
import * as argon2 from 'argon2';
import { defaultProfiles } from '@financas/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService, private readonly audit: AuditService) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (exists) throw new ConflictException('E-mail já cadastrado.');
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name: dto.name, email: dto.email.toLowerCase(), passwordHash: await argon2.hash(dto.password) } });
      for (const profile of defaultProfiles) {
        await tx.financialProfile.create({ data: { userId: created.id, name: profile.name, type: profile.type as FinancialProfileType, baseCurrency: profile.baseCurrency } });
      }
      await tx.auditLog.create({ data: { userId: created.id, action: AuditAction.USER_REGISTERED, entityType: 'User', entityId: created.id } });
      return created;
    });
    return this.issueToken(user.id, user.email, user.name);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) throw new UnauthorizedException('Credenciais inválidas.');
    return this.issueToken(user.id, user.email, user.name);
  }

  private issueToken(userId: string, email: string, name: string) {
    return { accessToken: this.jwt.sign({ sub: userId, email }), user: { id: userId, email, name } };
  }
}
