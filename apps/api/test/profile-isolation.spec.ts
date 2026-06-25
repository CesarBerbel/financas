import { AuditAction, FinancialProfileStatus } from '@prisma/client';
import { FinancialProfilesService } from '../src/financial-profiles/financial-profiles.service';

describe('FinancialProfilesService', () => {
  it('filters profiles by authenticated user id', async () => {
    const prisma = { financialProfile: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    const service = new FinancialProfilesService(prisma);

    await service.list('user-a');

    expect(prisma.financialProfile.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-a' },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('creates an additional profile for the authenticated user and audits the action', async () => {
    const profile = { id: 'profile-new', type: 'PERSONAL_PORTUGAL', baseCurrency: 'EUR' };
    const tx = {
      financialProfile: { create: jest.fn().mockResolvedValue(profile) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) } as any;
    const service = new FinancialProfilesService(prisma);

    const result = await service.create('user-a', { name: 'Viagens Portugal', type: 'PERSONAL_PORTUGAL' as any, baseCurrency: 'EUR' });

    expect(result).toBe(profile);
    expect(tx.financialProfile.create).toHaveBeenCalledWith({ data: { userId: 'user-a', name: 'Viagens Portugal', type: 'PERSONAL_PORTUGAL', baseCurrency: 'EUR' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-a',
        action: AuditAction.PROFILE_CREATED,
        entityType: 'FinancialProfile',
        entityId: 'profile-new',
        metadata: { name: 'Viagens Portugal', type: 'PERSONAL_PORTUGAL', baseCurrency: 'EUR' },
      },
    });
  });

  it('updates only profiles owned by the authenticated user', async () => {
    const profile = { id: 'profile-1', userId: 'user-a', name: 'Pessoal PT', type: 'PERSONAL_PORTUGAL', baseCurrency: 'EUR', status: FinancialProfileStatus.ACTIVE };
    const tx = {
      financialProfile: { update: jest.fn().mockResolvedValue({ ...profile, name: 'Portugal Principal' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      financialProfile: { findFirst: jest.fn().mockResolvedValue(profile) },
      $transaction: jest.fn((callback) => callback(tx)),
    } as any;
    const service = new FinancialProfilesService(prisma);

    await service.update('user-a', 'profile-1', { name: 'Portugal Principal' });

    expect(prisma.financialProfile.findFirst).toHaveBeenCalledWith({ where: { id: 'profile-1', userId: 'user-a' } });
    expect(tx.financialProfile.update).toHaveBeenCalledWith({ where: { id: 'profile-1' }, data: { name: 'Portugal Principal' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-a',
        action: AuditAction.PROFILE_UPDATED,
        entityType: 'FinancialProfile',
        entityId: 'profile-1',
        metadata: { name: 'Portugal Principal' },
      },
    });
  });
});
