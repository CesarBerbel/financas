import { AccountStatus, AccountType, Prisma } from '@prisma/client';
import { AccountsService } from '../src/accounts/accounts.service';

function accountFixture(overrides: Partial<{
  id: string;
  financialProfileId: string;
  name: string;
  type: AccountType;
  currencyCode: string;
  initialBalance: Prisma.Decimal;
  currentBalance: Prisma.Decimal;
  reconciledBalance: Prisma.Decimal;
  projectedBalance: Prisma.Decimal;
  status: AccountStatus;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  const now = new Date('2026-06-25T00:00:00.000Z');

  return {
    id: 'account-1',
    financialProfileId: 'profile-1',
    name: 'Conta teste',
    type: AccountType.CHECKING,
    currencyCode: 'EUR',
    initialBalance: new Prisma.Decimal(0),
    currentBalance: new Prisma.Decimal(0),
    reconciledBalance: new Prisma.Decimal(0),
    projectedBalance: new Prisma.Decimal(0),
    status: AccountStatus.ACTIVE,
    description: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AccountsService', () => {
  it('filters accounts by authenticated user id', async () => {
    const prisma = { account: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    const service = new AccountsService(prisma);

    await service.list('user-a');

    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { financialProfile: { userId: 'user-a' }, status: { not: AccountStatus.CLOSED } },
      include: { financialProfile: { select: { id: true, name: true, type: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  });


  it('does not include closed accounts in operational list', async () => {
    const prisma = { account: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    const service = new AccountsService(prisma);

    await service.list('user-a', 'profile-1');

    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: {
        financialProfileId: 'profile-1',
        status: { not: AccountStatus.CLOSED },
        financialProfile: { userId: 'user-a' },
      },
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
          { financialProfileId: 'profile-3', currencyCode: 'USD', currentBalance: new Prisma.Decimal(7.5), financialProfile: { id: 'profile-3', name: 'Reserva dólar', type: 'PERSONAL_PORTUGAL' } },
        ]),
      },
    } as any;
    const service = new AccountsService(prisma);

    const result = await service.summary('user-a');

    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: { financialProfile: { userId: 'user-a' }, status: AccountStatus.ACTIVE },
      include: { financialProfile: { select: { id: true, name: true, type: true } } },
      orderBy: { createdAt: 'asc' },
    });
    expect(result.byCurrency).toEqual([
      { currencyCode: 'EUR', balance: '15.25' },
      { currencyCode: 'BRL', balance: '20.00' },
      { currencyCode: 'USD', balance: '7.50' },
    ]);
    expect(result.byProfile[0].balances.EUR).toBe('15.25');
  });

  it('blocks archiving account with non-zero balance', async () => {
    const prisma = {
      account: { findFirst: jest.fn().mockResolvedValue(accountFixture({ currentBalance: new Prisma.Decimal(10) })) },
    } as any;
    const service = new AccountsService(prisma);

    await expect(service.archive('user-a', 'account-1')).rejects.toThrow('saldo diferente de zero');
  });

  it('blocks closing archived account', async () => {
    const prisma = {
      account: { findFirst: jest.fn().mockResolvedValue(accountFixture({ status: AccountStatus.ARCHIVED })) },
    } as any;
    const service = new AccountsService(prisma);

    await expect(service.close('user-a', 'account-1')).rejects.toThrow('Desarquive a conta antes de fechá-la');
  });

  it('blocks editing archived account data', async () => {
    const prisma = {
      account: { findFirst: jest.fn().mockResolvedValue(accountFixture({ status: AccountStatus.ARCHIVED })) },
    } as any;
    const service = new AccountsService(prisma);

    await expect(service.update('user-a', 'account-1', { name: 'Nova conta' })).rejects.toThrow('Conta arquivada não pode ser editada');
  });

  it('unarchives archived account back to active', async () => {
    const archived = accountFixture({ status: AccountStatus.ARCHIVED });
    const active = accountFixture({ status: AccountStatus.ACTIVE });
    const tx = {
      account: { update: jest.fn().mockResolvedValue(active) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      account: { findFirst: jest.fn().mockResolvedValueOnce(archived).mockResolvedValueOnce(archived) },
      $transaction: jest.fn((callback: (txClient: typeof tx) => unknown) => callback(tx)),
    } as any;
    const service = new AccountsService(prisma);

    const result = await service.unarchive('user-a', 'account-1');

    expect(tx.account.update).toHaveBeenCalledWith({ where: { id: 'account-1' }, data: { status: AccountStatus.ACTIVE } });
    expect(result.status).toBe(AccountStatus.ACTIVE);
  });
});
