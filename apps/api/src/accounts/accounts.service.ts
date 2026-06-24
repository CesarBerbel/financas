import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './dto';

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, financialProfileId?: string) {
    if (financialProfileId) await this.ensureProfileBelongsToUser(userId, financialProfileId);

    return this.prisma.account.findMany({
      where: {
        ...(financialProfileId ? { financialProfileId } : {}),
        financialProfile: { userId },
      },
      include: { financialProfile: { select: { id: true, name: true, type: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async summary(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { financialProfile: { userId }, status: { not: AccountStatus.CLOSED } },
      include: { financialProfile: { select: { id: true, name: true, type: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const byCurrency = new Map<string, Prisma.Decimal>();
    const byProfile = new Map<string, { profileId: string; profileName: string; profileType: string; balances: Record<string, string> }>();

    for (const account of accounts) {
      byCurrency.set(account.currencyCode, (byCurrency.get(account.currencyCode) ?? new Prisma.Decimal(0)).plus(account.currentBalance));
      const profileSummary = byProfile.get(account.financialProfileId) ?? {
        profileId: account.financialProfileId,
        profileName: account.financialProfile.name,
        profileType: account.financialProfile.type,
        balances: {},
      };
      const current = new Prisma.Decimal(profileSummary.balances[account.currencyCode] ?? 0);
      profileSummary.balances[account.currencyCode] = current.plus(account.currentBalance).toFixed(2);
      byProfile.set(account.financialProfileId, profileSummary);
    }

    return {
      accountCount: accounts.length,
      byCurrency: Array.from(byCurrency.entries()).map(([currencyCode, balance]) => ({ currencyCode, balance: balance.toFixed(2) })),
      byProfile: Array.from(byProfile.values()),
    };
  }

  async create(userId: string, dto: CreateAccountDto) {
    await this.ensureProfileBelongsToUser(userId, dto.financialProfileId);
    const initialBalance = new Prisma.Decimal(dto.initialBalance ?? 0);

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          financialProfileId: dto.financialProfileId,
          name: dto.name,
          type: dto.type,
          currencyCode: dto.currencyCode,
          initialBalance,
          currentBalance: initialBalance,
          reconciledBalance: initialBalance,
          projectedBalance: initialBalance,
          description: dto.description,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.ACCOUNT_CREATED,
          entityType: 'Account',
          entityId: account.id,
          metadata: { financialProfileId: account.financialProfileId, type: account.type, currencyCode: account.currencyCode },
        },
      });

      return account;
    });
  }

  async update(userId: string, accountId: string, dto: UpdateAccountDto) {
    const existing = await this.findOwnedAccount(userId, accountId);
    if (existing.status === AccountStatus.CLOSED && dto.status !== AccountStatus.CLOSED) {
      throw new ForbiddenException('Conta fechada não pode ser reaberta nesta fase.');
    }

    return this.prisma.$transaction(async (tx) => {
      const account = await tx.account.update({ where: { id: accountId }, data: dto });
      await tx.auditLog.create({
        data: {
          userId,
          action: dto.status === AccountStatus.ARCHIVED ? AuditAction.ACCOUNT_ARCHIVED : dto.status === AccountStatus.CLOSED ? AuditAction.ACCOUNT_CLOSED : AuditAction.ACCOUNT_UPDATED,
          entityType: 'Account',
          entityId: account.id,
          metadata: this.toAuditMetadata(dto),
        },
      });
      return account;
    });
  }

  async archive(userId: string, accountId: string) {
    await this.findOwnedAccount(userId, accountId);
    return this.update(userId, accountId, { status: AccountStatus.ARCHIVED });
  }

  async close(userId: string, accountId: string) {
    await this.findOwnedAccount(userId, accountId);
    return this.update(userId, accountId, { status: AccountStatus.CLOSED });
  }

  private toAuditMetadata(dto: UpdateAccountDto): Prisma.InputJsonObject {
    return Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as Prisma.InputJsonObject;
  }

  private async ensureProfileBelongsToUser(userId: string, financialProfileId: string) {
    const profile = await this.prisma.financialProfile.findFirst({ where: { id: financialProfileId, userId, status: 'ACTIVE' } });
    if (!profile) throw new NotFoundException('Perfil financeiro não encontrado para este usuário.');
    return profile;
  }

  private async findOwnedAccount(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, financialProfile: { userId } } });
    if (!account) throw new NotFoundException('Conta financeira não encontrada.');
    return account;
  }
}
