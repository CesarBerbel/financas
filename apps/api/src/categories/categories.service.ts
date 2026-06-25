import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Category, FinancialProfile, FinancialProfileStatus, FinancialProfileType, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryListFilters, CategoryReportQueryDto, CreateCategoryDto, UpdateCategoryDto } from './dto';

type CategoryWithRelations = Category & {
  financialProfile: Pick<FinancialProfile, 'id' | 'name' | 'type'> | null;
  parent: Pick<Category, 'id' | 'name'> | null;
};

type CategoryReportRow = {
  key: string;
  categoryId: string | null;
  categoryName: string;
  parentName: string | null;
  financialProfileId: string;
  financialProfileName: string;
  financialProfileType: string;
  currencyCode: string;
  income: Prisma.Decimal;
  expense: Prisma.Decimal;
  net: Prisma.Decimal;
  transactionCount: number;
};

const defaultCategoryNamesByProfileType: Record<FinancialProfileType, string[]> = {
  [FinancialProfileType.PERSONAL_BRAZIL]: ['Moradia', 'Alimentação', 'Transporte'],
  [FinancialProfileType.PERSONAL_PORTUGAL]: ['Moradia', 'Alimentação', 'Transporte', 'IVA', 'Segurança Social'],
  [FinancialProfileType.BUSINESS_PORTUGAL]: ['Contabilidade', 'Impostos', 'Software', 'IVA', 'Segurança Social'],
  [FinancialProfileType.BUSINESS_USA]: ['Contabilidade', 'Impostos', 'Software'],
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, filters: CategoryListFilters) {
    if (filters.financialProfileId) await this.ensureProfileBelongsToUser(userId, filters.financialProfileId);
    await this.ensureDefaultCategoriesForUserProfiles(userId);

    const categories = await this.prisma.category.findMany({
      where: {
        userId,
        ...(filters.financialProfileId ? { OR: [{ financialProfileId: filters.financialProfileId }, { financialProfileId: null }] } : {}),
        ...(filters.q?.trim() ? { name: { contains: filters.q.trim(), mode: 'insensitive' } } : {}),
      },
      include: this.defaultIncludes(),
      orderBy: [{ financialProfileId: 'asc' }, { parentId: 'asc' }, { name: 'asc' }],
    });

    return categories.map((category) => this.withFullName(category));
  }

  async report(userId: string, filters: CategoryReportQueryDto) {
    if (filters.financialProfileId) await this.ensureProfileBelongsToUser(userId, filters.financialProfileId);
    await this.ensureDefaultCategoriesForUserProfiles(userId);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        financialProfile: { userId },
        ...(filters.financialProfileId ? { financialProfileId: filters.financialProfileId } : {}),
        ...(filters.dateFrom || filters.dateTo
          ? {
              occurredAt: {
                ...(filters.dateFrom ? { gte: this.parseDate(filters.dateFrom, 'Data inicial inválida.') } : {}),
                ...(filters.dateTo ? { lte: this.parseDateUpperBound(filters.dateTo, 'Data final inválida.') } : {}),
              },
            }
          : {}),
      },
      include: {
        financialProfile: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });

    const rows = new Map<string, CategoryReportRow>();

    for (const transaction of transactions) {
      const categoryName = transaction.category?.name ?? transaction.categoryName ?? 'Sem categoria';
      const parentName = transaction.category?.parent?.name ?? null;
      const key = [transaction.financialProfileId, transaction.currencyCode, transaction.categoryId ?? `legacy:${categoryName}`].join('|');
      const row = rows.get(key) ?? {
        key,
        categoryId: transaction.categoryId,
        categoryName,
        parentName,
        financialProfileId: transaction.financialProfileId,
        financialProfileName: transaction.financialProfile.name,
        financialProfileType: transaction.financialProfile.type,
        currencyCode: transaction.currencyCode,
        income: new Prisma.Decimal(0),
        expense: new Prisma.Decimal(0),
        net: new Prisma.Decimal(0),
        transactionCount: 0,
      };

      if (transaction.type === TransactionType.INCOME) {
        row.income = row.income.plus(transaction.amount);
        row.net = row.net.plus(transaction.amount);
      } else if (transaction.type === TransactionType.EXPENSE) {
        row.expense = row.expense.plus(transaction.amount);
        row.net = row.net.minus(transaction.amount);
      } else if (transaction.type === TransactionType.ADJUSTMENT) {
        row.net = row.net.plus(transaction.amount);
        if (transaction.amount.gte(0)) row.income = row.income.plus(transaction.amount);
        else row.expense = row.expense.plus(transaction.amount.abs());
      }

      row.transactionCount += 1;
      rows.set(key, row);
    }

    return Array.from(rows.values())
      .sort((first, second) => first.categoryName.localeCompare(second.categoryName, 'pt-BR'))
      .map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        parentName: row.parentName,
        financialProfileId: row.financialProfileId,
        financialProfileName: row.financialProfileName,
        financialProfileType: row.financialProfileType,
        currencyCode: row.currencyCode,
        income: row.income.toFixed(2),
        expense: row.expense.toFixed(2),
        net: row.net.toFixed(2),
        transactionCount: row.transactionCount,
      }));
  }

  async create(userId: string, dto: CreateCategoryDto) {
    const normalizedName = this.normalizeName(dto.name);
    const scope = await this.resolveCategoryScope(userId, dto.financialProfileId, dto.parentId);
    await this.ensureUniqueSibling(userId, scope.financialProfileId, scope.parentId, normalizedName);

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          userId,
          financialProfileId: scope.financialProfileId,
          parentId: scope.parentId,
          name: dto.name.trim(),
          normalizedName,
          isDefault: false,
        },
        include: this.defaultIncludes(),
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.CATEGORY_CREATED,
          entityType: 'Category',
          entityId: category.id,
          metadata: this.toAuditMetadata(category),
        },
      });

      return this.withFullName(category);
    });
  }

  async update(userId: string, categoryId: string, dto: UpdateCategoryDto) {
    const existing = await this.findOwnedCategory(userId, categoryId);
    const normalizedName = dto.name === undefined ? existing.normalizedName : this.normalizeName(dto.name);
    const nextFinancialProfileId = dto.financialProfileId === undefined ? existing.financialProfileId : dto.financialProfileId || null;
    const nextParentId = dto.parentId === undefined ? existing.parentId : dto.parentId || null;

    if (nextParentId === categoryId) throw new BadRequestException('Categoria não pode ser subcategoria dela mesma.');

    const scope = await this.resolveCategoryScope(userId, nextFinancialProfileId ?? undefined, nextParentId ?? undefined);
    if (existing.normalizedName !== normalizedName || existing.parentId !== scope.parentId || existing.financialProfileId !== scope.financialProfileId) {
      await this.ensureUniqueSibling(userId, scope.financialProfileId, scope.parentId, normalizedName, categoryId);
    }

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.update({
        where: { id: categoryId },
        data: {
          financialProfileId: scope.financialProfileId,
          parentId: scope.parentId,
          ...(dto.name !== undefined ? { name: dto.name.trim(), normalizedName } : {}),
        },
        include: this.defaultIncludes(),
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.CATEGORY_UPDATED,
          entityType: 'Category',
          entityId: category.id,
          metadata: this.toAuditMetadata(category),
        },
      });

      return this.withFullName(category);
    });
  }

  async remove(userId: string, categoryId: string) {
    const existing = await this.findOwnedCategory(userId, categoryId);

    if (existing.isDefault) {
      throw new ConflictException(
        'Categoria padrão não pode ser removida porque faz parte da organização inicial do perfil. Você pode renomeá-la, criar uma subcategoria ou criar uma categoria personalizada.',
      );
    }

    const [childrenCount, transactionCount] = await Promise.all([
      this.prisma.category.count({ where: { parentId: categoryId, userId } }),
      this.prisma.transaction.count({ where: { categoryId, deletedAt: null, financialProfile: { userId } } }),
    ]);

    if (childrenCount > 0) {
      throw new ConflictException('Categoria com subcategorias não pode ser removida. Remova ou mova as subcategorias primeiro.');
    }

    if (transactionCount > 0) {
      throw new ConflictException('Categoria em uso por transações não pode ser removida. Remova a categoria das transações ou escolha outra categoria antes de excluir.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id: categoryId } });
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.CATEGORY_DELETED,
          entityType: 'Category',
          entityId: categoryId,
          metadata: this.toAuditMetadata(existing),
        },
      });
      return { id: categoryId, deleted: true, message: 'Categoria removida com sucesso.' };
    });
  }

  async ensureDefaultCategoriesForUserProfiles(userId: string) {
    const profiles = await this.prisma.financialProfile.findMany({ where: { userId, status: FinancialProfileStatus.ACTIVE } });

    for (const profile of profiles) {
      const defaultNames = defaultCategoryNamesByProfileType[profile.type] ?? [];

      for (const name of defaultNames) {
        const normalizedName = this.normalizeName(name);
        const existing = await this.prisma.category.findFirst({
          where: {
            userId,
            financialProfileId: profile.id,
            parentId: null,
            normalizedName,
          },
          select: { id: true },
        });

        if (existing) continue;

        await this.prisma.category.create({
          data: {
            userId,
            financialProfileId: profile.id,
            name,
            normalizedName,
            isDefault: true,
          },
        });
      }
    }
  }

  async ensureCategoryVisibleForProfile(userId: string, categoryId: string, financialProfileId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new NotFoundException('Categoria não encontrada para este usuário.');
    if (category.financialProfileId && category.financialProfileId !== financialProfileId) {
      throw new BadRequestException('Categoria não pertence ao perfil financeiro da transação.');
    }
    return category;
  }

  normalizeTagName(value: string) {
    return value.trim().replace(/\s+/g, ' ').slice(0, 40);
  }

  normalizeName(value: string) {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length < 2) throw new BadRequestException('Nome da categoria deve ter pelo menos 2 caracteres.');
    return normalized.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  normalizeTags(values?: string[]) {
    const unique = new Map<string, string>();

    for (const value of values ?? []) {
      const name = this.normalizeTagName(value);
      if (!name) continue;
      const normalizedName = this.normalizeName(name);
      unique.set(normalizedName, name);
    }

    return Array.from(unique.entries()).map(([normalizedName, name]) => ({ name, normalizedName })).slice(0, 12);
  }

  private async resolveCategoryScope(userId: string, financialProfileId?: string, parentId?: string) {
    const parent = parentId ? await this.findOwnedCategory(userId, parentId) : null;
    const resolvedFinancialProfileId = parent ? parent.financialProfileId : financialProfileId ?? null;

    if (parent && parent.financialProfileId !== resolvedFinancialProfileId) {
      throw new BadRequestException('Subcategoria deve pertencer ao mesmo perfil da categoria principal.');
    }

    if (resolvedFinancialProfileId) await this.ensureProfileBelongsToUser(userId, resolvedFinancialProfileId);

    return { financialProfileId: resolvedFinancialProfileId, parentId: parent?.id ?? null };
  }

  private async ensureUniqueSibling(userId: string, financialProfileId: string | null, parentId: string | null, normalizedName: string, ignoreCategoryId?: string) {
    const duplicate = await this.prisma.category.findFirst({
      where: {
        userId,
        financialProfileId,
        parentId,
        normalizedName,
        ...(ignoreCategoryId ? { id: { not: ignoreCategoryId } } : {}),
      },
    });

    if (duplicate) throw new ConflictException('Já existe uma categoria com este nome neste perfil e nível.');
  }

  private async ensureProfileBelongsToUser(userId: string, financialProfileId: string) {
    const profile = await this.prisma.financialProfile.findFirst({ where: { id: financialProfileId, userId, status: FinancialProfileStatus.ACTIVE } });
    if (!profile) throw new NotFoundException('Perfil financeiro não encontrado para este usuário.');
    return profile;
  }

  private async findOwnedCategory(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new NotFoundException('Categoria não encontrada para este usuário.');
    return category;
  }

  private parseDate(value: string, errorMessage: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(errorMessage);
    return date;
  }

  private parseDateUpperBound(value: string, errorMessage: string) {
    const date = this.parseDate(value, errorMessage);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date;
  }

  private toAuditMetadata(category: Pick<Category, 'id' | 'financialProfileId' | 'parentId' | 'name' | 'normalizedName' | 'isDefault'>): Prisma.InputJsonObject {
    return {
      id: category.id,
      financialProfileId: category.financialProfileId,
      parentId: category.parentId,
      name: category.name,
      normalizedName: category.normalizedName,
      isDefault: category.isDefault,
    };
  }

  private withFullName(category: CategoryWithRelations) {
    return {
      ...category,
      fullName: category.parent ? `${category.parent.name} > ${category.name}` : category.name,
    };
  }

  private defaultIncludes() {
    return {
      financialProfile: { select: { id: true, name: true, type: true } },
      parent: { select: { id: true, name: true } },
    } satisfies Prisma.CategoryInclude;
  }
}
