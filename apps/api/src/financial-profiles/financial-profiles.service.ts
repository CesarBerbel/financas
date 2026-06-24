import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancialProfileDto } from './dto';

@Injectable()
export class FinancialProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.financialProfile.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  async create(userId: string, dto: CreateFinancialProfileDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const profile = await tx.financialProfile.create({ data: { userId, ...dto } });
        await tx.auditLog.create({ data: { userId, action: AuditAction.PROFILE_CREATED, entityType: 'FinancialProfile', entityId: profile.id, metadata: { type: profile.type, baseCurrency: profile.baseCurrency } } });
        return profile;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Já existe um perfil desse tipo para este usuário.');
      throw error;
    }
  }

  async switchProfile(userId: string, profileId: string) {
    const profile = await this.prisma.financialProfile.findFirst({ where: { id: profileId, userId, status: 'ACTIVE' } });
    if (!profile) throw new NotFoundException('Perfil financeiro não encontrado.');
    await this.prisma.auditLog.create({ data: { userId, action: AuditAction.PROFILE_SWITCHED, entityType: 'FinancialProfile', entityId: profile.id } });
    return profile;
  }
}
