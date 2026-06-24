import { FinancialProfilesService } from '../src/financial-profiles/financial-profiles.service';

describe('FinancialProfilesService isolation', () => {
  it('filters profiles by authenticated user id', async () => {
    const prisma = { financialProfile: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    const service = new FinancialProfilesService(prisma);
    await service.list('user-a');
    expect(prisma.financialProfile.findMany).toHaveBeenCalledWith({ where: { userId: 'user-a' }, orderBy: { createdAt: 'asc' } });
  });
});
