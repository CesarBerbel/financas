import { FinancialProfileStatus, FinancialProfileType, Prisma, TransactionType } from '@prisma/client';
import { CategoriesService } from '../src/categories/categories.service';

describe('CategoriesService', () => {
  it('creates default categories for active profiles without duplicating existing names', async () => {
    const prisma = {
      financialProfile: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'profile-br', userId: 'user-a', type: FinancialProfileType.PERSONAL_BRAZIL, status: FinancialProfileStatus.ACTIVE },
        ]),
      },
      category: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'category-food' }).mockResolvedValueOnce(null),
        create: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const service = new CategoriesService(prisma);

    await service.ensureDefaultCategoriesForUserProfiles('user-a');

    expect(prisma.category.create).toHaveBeenCalledTimes(2);
    expect(prisma.category.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-a', financialProfileId: 'profile-br', name: 'Moradia', isDefault: true }),
    }));
  });

  it('blocks duplicate category names in the same profile and level', async () => {
    const prisma = {
      financialProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'profile-1', userId: 'user-a', status: FinancialProfileStatus.ACTIVE }) },
      category: { findFirst: jest.fn().mockResolvedValue({ id: 'duplicated' }) },
    } as any;
    const service = new CategoriesService(prisma);

    await expect(service.create('user-a', { financialProfileId: 'profile-1', name: 'Alimentação' })).rejects.toThrow('Já existe uma categoria');
  });

  it('blocks deleting default categories with a friendly message', async () => {
    const prisma = {
      category: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'category-default',
          userId: 'user-a',
          financialProfileId: 'profile-1',
          parentId: null,
          name: 'Alimentação',
          normalizedName: 'alimentacao',
          isDefault: true,
        }),
      },
    } as any;
    const service = new CategoriesService(prisma);

    await expect(service.remove('user-a', 'category-default')).rejects.toThrow('Categoria padrão não pode ser removida');
  });

  it('deletes custom categories when they have no children or active transactions', async () => {
    const category = {
      id: 'category-custom',
      userId: 'user-a',
      financialProfileId: 'profile-1',
      parentId: null,
      name: 'Pets',
      normalizedName: 'pets',
      isDefault: false,
    };
    const tx = {
      category: { delete: jest.fn().mockResolvedValue(category) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      category: {
        findFirst: jest.fn().mockResolvedValue(category),
        count: jest.fn().mockResolvedValue(0),
      },
      transaction: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    } as any;
    const service = new CategoriesService(prisma);

    await expect(service.remove('user-a', 'category-custom')).resolves.toEqual({
      id: 'category-custom',
      deleted: true,
      message: 'Categoria removida com sucesso.',
    });
    expect(tx.category.delete).toHaveBeenCalledWith({ where: { id: 'category-custom' } });
  });

  it('aggregates income and expenses by category, profile and currency', async () => {
    const prisma = {
      financialProfile: { findMany: jest.fn().mockResolvedValue([]) },
      transaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 't1',
            financialProfileId: 'profile-1',
            categoryId: 'category-1',
            categoryName: 'Alimentação',
            type: TransactionType.EXPENSE,
            amount: new Prisma.Decimal(30),
            currencyCode: 'EUR',
            financialProfile: { id: 'profile-1', name: 'Pessoal Portugal', type: FinancialProfileType.PERSONAL_PORTUGAL },
            category: { id: 'category-1', name: 'Alimentação', parent: null },
          },
          {
            id: 't2',
            financialProfileId: 'profile-1',
            categoryId: 'category-1',
            categoryName: 'Alimentação',
            type: TransactionType.INCOME,
            amount: new Prisma.Decimal(10),
            currencyCode: 'EUR',
            financialProfile: { id: 'profile-1', name: 'Pessoal Portugal', type: FinancialProfileType.PERSONAL_PORTUGAL },
            category: { id: 'category-1', name: 'Alimentação', parent: null },
          },
        ]),
      },
    } as any;
    const service = new CategoriesService(prisma);

    const report = await service.report('user-a', {});

    expect(report).toEqual([
      expect.objectContaining({
        categoryId: 'category-1',
        categoryName: 'Alimentação',
        financialProfileName: 'Pessoal Portugal',
        currencyCode: 'EUR',
        income: '10.00',
        expense: '30.00',
        net: '-20.00',
        transactionCount: 2,
      }),
    ]);
  });
});
