import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, FinancialProfileType } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';

const defaultProfiles = [
  { type: FinancialProfileType.PERSONAL_BRAZIL, name: 'Pessoal Brasil', baseCurrency: 'BRL' },
  { type: FinancialProfileType.PERSONAL_PORTUGAL, name: 'Pessoal Portugal', baseCurrency: 'EUR' },
  { type: FinancialProfileType.BUSINESS_PORTUGAL, name: 'Empresa Portugal', baseCurrency: 'EUR' },
  { type: FinancialProfileType.BUSINESS_USA, name: 'Empresa USA', baseCurrency: 'USD' }
] as const;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (exists) throw new ConflictException('E-mail já cadastrado.');
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name: dto.name, email: dto.email.toLowerCase(), passwordHash: await argon2.hash(dto.password) } });
      for (const profile of defaultProfiles) {
        await tx.financialProfile.create({ data: { userId: created.id, name: profile.name, type: profile.type, baseCurrency: profile.baseCurrency } });
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
