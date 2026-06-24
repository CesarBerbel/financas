import { AccountStatus, Prisma } from '@prisma/client';
import { AccountsService } from '../src/accounts/accounts.service';

describe('AccountsService', () => {
  it('filters accounts by authenticated user id', async () => {
    const prisma = { account: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    const service = new AccountsService(prisma);

    await service.list('user-a');

    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { financialProfile: { userId: 'user-a' } },
      include: { financialProfile: { select: { id: true, name: true, type: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  });

  it('summarizes balances by currency and profile', async () => {
    const prisma = {
      account: {
        findMany: jest.fn().mockResolvedValue([
          { financialProfileId: 'profile-1', currencyCode: 'EUR', currentBalance: new Prisma.Decimal(10), financialProfile: { id: 'profile-1', name: 'Pessoal Portugal', type: 'PERSONAL_PORTUGAL' } },
          { financialProfileId: 'profile-1', currencyCode: 'EUR', currentBalance: new Prisma.Decimal(5.25), financialProfile: { id: 'profile-1', name: 'Pessoal Portugal', type: 'PERSONAL_PORTUGAL' } },
          { financialProfileId: 'profile-2', currencyCode: 'BRL', currentBalance: new Prisma.Decimal(20), financialProfile: { id: 'profile-2', name: 'Pessoal Brasil', type: 'PERSONAL_BRAZIL' } },
        ]),
      },
    } as any;
    const service = new AccountsService(prisma);

    const result = await service.summary('user-a');

    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { financialProfile: { userId: 'user-a' }, status: { not: AccountStatus.CLOSED } },
      include: { financialProfile: { select: { id: true, name: true, type: true } } },
      orderBy: { createdAt: 'asc' },
    });
    expect(result.byCurrency).toEqual([
      { currencyCode: 'EUR', balance: '15.25' },
      { currencyCode: 'BRL', balance: '20.00' },
    ]);
    expect(result.byProfile[0].balances.EUR).toBe('15.25');
  });
});
