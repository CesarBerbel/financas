import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, FinancialProfileStatus, FinancialProfileType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialProfileDto, UpdateFinancialProfileDto } from './dto';

@Injectable()
export class FinancialProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.financialProfile.findMany({ where: { userId }, orderBy: [{ status: 'asc' }, { createdAt: 'asc' }] });
  }

  async create(userId: string, dto: CreateFinancialProfileDto) {
    this.validateProfileTypeCurrency(dto.type, dto.baseCurrency);

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.financialProfile.create({ data: { userId, ...dto } });
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.PROFILE_CREATED,
          entityType: 'FinancialProfile',
          entityId: profile.id,
          metadata: this.toAuditMetadata(dto),
        },
      });
      return profile;
    });
  }

  async update(userId: string, profileId: string, dto: UpdateFinancialProfileDto) {
    const existing = await this.findOwnedProfile(userId, profileId);
    const nextType = dto.type ?? existing.type;
    const nextCurrency = dto.baseCurrency ?? existing.baseCurrency;
    this.validateProfileTypeCurrency(nextType, nextCurrency);

    if (existing.status === FinancialProfileStatus.ARCHIVED && dto.status === FinancialProfileStatus.ACTIVE) {
      throw new ForbiddenException('Perfil arquivado não pode ser reativado nesta fase.');
    }

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.financialProfile.update({
        where: { id: profileId },
        data: dto,
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.PROFILE_UPDATED,
          entityType: 'FinancialProfile',
          entityId: profile.id,
          metadata: this.toAuditMetadata(dto),
        },
      });

      return profile;
    });
  }

  async archive(userId: string, profileId: string) {
    await this.findOwnedProfile(userId, profileId);
    const activeAccounts = await this.prisma.account.count({
      where: { financialProfileId: profileId, status: { not: 'CLOSED' } },
    });
    if (activeAccounts > 0) throw new ForbiddenException('Não é possível arquivar perfil com contas abertas ou arquivadas. Feche as contas antes.');
    return this.update(userId, profileId, { status: FinancialProfileStatus.ARCHIVED });
  }

  async switchProfile(userId: string, profileId: string) {
    const profile = await this.prisma.financialProfile.findFirst({ where: { id: profileId, userId, status: FinancialProfileStatus.ACTIVE } });
    if (!profile) throw new NotFoundException('Perfil financeiro não encontrado.');
    await this.prisma.auditLog.create({ data: { userId, action: AuditAction.PROFILE_SWITCHED, entityType: 'FinancialProfile', entityId: profile.id } });
    return profile;
  }

  private async findOwnedProfile(userId: string, profileId: string) {
    const profile = await this.prisma.financialProfile.findFirst({ where: { id: profileId, userId } });
    if (!profile) throw new NotFoundException('Perfil financeiro não encontrado para este usuário.');
    return profile;
  }

  private validateProfileTypeCurrency(type: FinancialProfileType, baseCurrency: string) {
    if (type === FinancialProfileType.PERSONAL_BRAZIL && baseCurrency !== 'BRL') {
      throw new BadRequestException('Perfil Pessoal Brasil deve usar BRL como moeda base.');
    }

    if ((type === FinancialProfileType.PERSONAL_PORTUGAL || type === FinancialProfileType.BUSINESS_PORTUGAL) && baseCurrency !== 'EUR') {
      throw new BadRequestException('Perfis de Portugal devem usar EUR como moeda base.');
    }

    if (type === FinancialProfileType.BUSINESS_USA && baseCurrency !== 'USD') {
      throw new BadRequestException('Perfil Empresarial USA deve usar USD como moeda base.');
    }
  }

  private toAuditMetadata(dto: CreateFinancialProfileDto | UpdateFinancialProfileDto): Prisma.InputJsonObject {
    return Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)) as Prisma.InputJsonObject;
  }
}
