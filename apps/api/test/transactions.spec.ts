import { AccountStatus, AuditAction, Prisma, TransactionType } from '@prisma/client';
import { TransactionsService } from '../src/transactions/transactions.service';

function categoriesServiceMock(overrides: Record<string, unknown> = {}) {
  return {
    ensureCategoryVisibleForProfile: jest.fn().mockResolvedValue({ id: 'category-1', name: 'Alimentação', financialProfileId: 'profile-1' }),
    normalizeTags: jest.fn((values?: string[]) => (values ?? []).map((name) => ({ name, normalizedName: name.toLowerCase() }))),
    ...overrides,
  } as any;
}

function activeAccount(overrides: Partial<{ id: string; financialProfileId: string; currencyCode: string; status: AccountStatus }> = {}) {
  const now = new Date('2026-06-25T00:00:00.000Z');
  return {
    id: 'account-1',
    financialProfileId: 'profile-1',
    name: 'Conta teste',
    type: 'CHECKING',
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

function transactionFixture(overrides: Partial<{
  id: string;
  financialProfileId: string;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  type: TransactionType;
  amount: Prisma.Decimal;
  currencyCode: string;
  description: string;
  categoryName: string | null;
  occurredAt: Date;
  notes: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tags: { tag: { name: string } }[];
}> = {}) {
  const now = new Date('2026-06-25T00:00:00.000Z');
  return {
    id: 'transaction-1',
    financialProfileId: 'profile-1',
    accountId: 'account-1',
    destinationAccountId: null,
    categoryId: null,
    type: TransactionType.EXPENSE,
    amount: new Prisma.Decimal(25),
    currencyCode: 'EUR',
    description: 'Mercado',
    categoryName: 'Alimentação',
    occurredAt: now,
    notes: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    account: activeAccount(),
    destinationAccount: null,
    tags: [],
    ...overrides,
  };
}

describe('TransactionsService', () => {
  it('lists transactions only for the authenticated user', async () => {
    const prisma = {
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const service = new TransactionsService(prisma, categoriesServiceMock());

    await service.list('user-a', {});

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ deletedAt: null, financialProfile: { userId: 'user-a' } }),
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    }));
  });

  it('creates income and increments current and projected account balances', async () => {
    const account = activeAccount();
    const profile = { id: 'profile-1', userId: 'user-a', status: 'ACTIVE' };
    const created = transactionFixture({ type: TransactionType.INCOME, amount: new Prisma.Decimal(100), description: 'Salário' });
    const tx = {
      transaction: {
        create: jest.fn().mockResolvedValue(created),
        findUniqueOrThrow: jest.fn().mockResolvedValue(created),
      },
      transactionTag: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      account: { update: jest.fn().mockResolvedValue(account) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      account: { findFirst: jest.fn().mockResolvedValue(account) },
      financialProfile: { findFirst: jest.fn().mockResolvedValue(profile) },
      $transaction: jest.fn((callback) => callback(tx)),
    } as any;
    const service = new TransactionsService(prisma, categoriesServiceMock());

    await service.create('user-a', {
      financialProfileId: 'profile-1',
      accountId: 'account-1',
      type: TransactionType.INCOME,
      amount: '100.00',
      occurredAt: '2026-06-25',
      description: 'Salário',
    });

    const balanceUpdate = tx.account.update.mock.calls[0][0];
    expect(balanceUpdate.where).toEqual({ id: 'account-1' });
    expect(balanceUpdate.data.currentBalance.increment.toFixed(2)).toBe('100.00');
    expect(balanceUpdate.data.projectedBalance.increment.toFixed(2)).toBe('100.00');
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: AuditAction.TRANSACTION_CREATED, entityType: 'Transaction' }),
    }));
  });

  it('creates transaction with category and free tags', async () => {
    const account = activeAccount();
    const created = transactionFixture({ categoryId: 'category-1', categoryName: 'Alimentação' });
    const tx = {
      transaction: {
        create: jest.fn().mockResolvedValue(created),
        findUniqueOrThrow: jest.fn().mockResolvedValue(created),
      },
      transactionTag: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      tag: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'tag-2', name: 'recorrente', normalizedName: 'recorrente' }),
        create: jest.fn().mockResolvedValue({ id: 'tag-1', name: 'mercado', normalizedName: 'mercado' }),
      },
      account: { update: jest.fn().mockResolvedValue(account) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      account: { findFirst: jest.fn().mockResolvedValue(account) },
      financialProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'profile-1', userId: 'user-a', status: 'ACTIVE' }) },
      $transaction: jest.fn((callback) => callback(tx)),
    } as any;
    const categoryService = categoriesServiceMock();
    const service = new TransactionsService(prisma, categoryService);

    await service.create('user-a', {
      financialProfileId: 'profile-1',
      accountId: 'account-1',
      type: TransactionType.EXPENSE,
      amount: '25.00',
      occurredAt: '2026-06-25',
      description: 'Mercado',
      categoryId: 'category-1',
      tags: ['mercado', 'recorrente'],
    });

    expect(categoryService.ensureCategoryVisibleForProfile).toHaveBeenCalledWith('user-a', 'category-1', 'profile-1');
    expect(tx.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ categoryId: 'category-1', categoryName: 'Alimentação' }),
    }));
    expect(tx.transactionTag.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: AuditAction.TAG_CREATED, entityType: 'Tag' }),
    }));
  });

  it('blocks transfer between different currencies in phase 2', async () => {
    const source = activeAccount({ id: 'source', currencyCode: 'EUR' });
    const destination = activeAccount({ id: 'destination', financialProfileId: 'profile-2', currencyCode: 'USD' });
    const prisma = {
      account: { findFirst: jest.fn().mockResolvedValueOnce(source).mockResolvedValueOnce(destination) },
      financialProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'profile-1', userId: 'user-a', status: 'ACTIVE' }) },
    } as any;
    const service = new TransactionsService(prisma, categoriesServiceMock());

    await expect(service.create('user-a', {
      financialProfileId: 'profile-1',
      accountId: 'source',
      destinationAccountId: 'destination',
      type: TransactionType.TRANSFER,
      amount: '20.00',
      occurredAt: '2026-06-25',
      description: 'Reserva',
    })).rejects.toThrow('mesma moeda');
  });

  it('deletes transaction by reversing its balance effect and soft deleting the record', async () => {
    const existing = transactionFixture({ type: TransactionType.EXPENSE, amount: new Prisma.Decimal(25) });
    const tx = {
      transaction: { update: jest.fn().mockResolvedValue({ ...existing, deletedAt: new Date('2026-06-26T00:00:00.000Z') }) },
      account: { update: jest.fn().mockResolvedValue(activeAccount()) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      transaction: { findFirst: jest.fn().mockResolvedValue(existing) },
      $transaction: jest.fn((callback) => callback(tx)),
    } as any;
    const service = new TransactionsService(prisma, categoriesServiceMock());

    await service.remove('user-a', 'transaction-1');

    const balanceUpdate = tx.account.update.mock.calls[0][0];
    expect(balanceUpdate.data.currentBalance.increment.toFixed(2)).toBe('25.00');
    expect(tx.transaction.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'transaction-1' },
      data: { deletedAt: expect.any(Date) },
    }));
  });
});
