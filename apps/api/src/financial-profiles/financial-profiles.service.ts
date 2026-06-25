import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, FinancialProfileStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialProfileDto, UpdateFinancialProfileDto } from './dto';

@Injectable()
export class FinancialProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.financialProfile.findMany({ where: { userId }, orderBy: [{ status: 'asc' }, { createdAt: 'asc' }] });
  }

  async create(userId: string, dto: CreateFinancialProfileDto) {
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

  private toAuditMetadata(dto: CreateFinancialProfileDto | UpdateFinancialProfileDto): Prisma.InputJsonObject {
    return Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)) as Prisma.InputJsonObject;
  }
}
