import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Account, AccountStatus, AuditAction, Prisma, Transaction, TransactionType } from '@prisma/client';
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto, TransactionListFilters, UpdateTransactionDto } from './dto';

type TransactionWithAccounts = Transaction & {
  account: Account;
  destinationAccount: Account | null;
  tags: { tag: { name: string } }[];
};

type TransactionSnapshot = {
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
  tags: string[];
};

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService, private readonly categoriesService: CategoriesService) {}

  async list(userId: string, filters: TransactionListFilters) {
    if (filters.financialProfileId) await this.ensureProfileBelongsToUser(userId, filters.financialProfileId);
    if (filters.accountId) await this.ensureAccountBelongsToUser(userId, filters.accountId);
    if (filters.categoryId) await this.ensureCategoryBelongsToUser(userId, filters.categoryId);

    return this.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        financialProfile: { userId },
        ...(filters.financialProfileId ? { financialProfileId: filters.financialProfileId } : {}),
        ...(filters.accountId ? { OR: [{ accountId: filters.accountId }, { destinationAccountId: filters.accountId }] } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.categoryName ? { categoryName: { contains: filters.categoryName, mode: 'insensitive' } } : {}),
        ...(filters.tag?.trim() ? { tags: { some: { tag: { name: { contains: filters.tag.trim(), mode: 'insensitive' } } } } } : {}),
        ...(filters.dateFrom || filters.dateTo
          ? {
              occurredAt: {
                ...(filters.dateFrom ? { gte: this.parseDate(filters.dateFrom, 'Data inicial inválida.') } : {}),
                ...(filters.dateTo ? { lte: this.parseDateUpperBound(filters.dateTo, 'Data final inválida.') } : {}),
              },
            }
          : {}),
      },
      include: this.defaultIncludes(),
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const snapshot = await this.buildSnapshot(userId, dto);

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          financialProfileId: snapshot.financialProfileId,
          accountId: snapshot.accountId,
          destinationAccountId: snapshot.destinationAccountId,
          categoryId: snapshot.categoryId,
          type: snapshot.type,
          amount: snapshot.amount,
          currencyCode: snapshot.currencyCode,
          description: snapshot.description,
          categoryName: snapshot.categoryName,
          occurredAt: snapshot.occurredAt,
          notes: snapshot.notes,
        },
        include: this.defaultIncludes(),
      });

      await this.syncTransactionTags(tx, userId, transaction.id, snapshot.financialProfileId, snapshot.tags);
      await this.applyBalanceEffect(tx, snapshot, 'apply');
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.TRANSACTION_CREATED,
          entityType: 'Transaction',
          entityId: transaction.id,
          metadata: this.toAuditMetadata(snapshot),
        },
      });

      return tx.transaction.findUniqueOrThrow({ where: { id: transaction.id }, include: this.defaultIncludes() });
    });
  }

  async update(userId: string, transactionId: string, dto: UpdateTransactionDto) {
    const existing = await this.findOwnedTransaction(userId, transactionId);
    const nextType = dto.type ?? existing.type;
    const nextDestinationAccountId = nextType === TransactionType.TRANSFER
      ? dto.destinationAccountId === undefined ? existing.destinationAccountId ?? undefined : dto.destinationAccountId ?? undefined
      : undefined;
    const nextTags = dto.tags === undefined ? existing.tags.map((item) => item.tag.name) : dto.tags;
    const categoryWasCleared = dto.categoryId === null;

    const nextSnapshot = await this.buildSnapshot(userId, {
      financialProfileId: dto.financialProfileId ?? existing.financialProfileId,
      accountId: dto.accountId ?? existing.accountId,
      destinationAccountId: nextDestinationAccountId,
      categoryId: dto.categoryId === undefined ? existing.categoryId ?? undefined : dto.categoryId ?? undefined,
      type: nextType,
      amount: dto.amount ?? existing.amount.toFixed(2),
      occurredAt: dto.occurredAt ?? existing.occurredAt.toISOString(),
      description: dto.description ?? existing.description,
      categoryName: categoryWasCleared ? undefined : dto.categoryName === undefined ? existing.categoryName ?? undefined : dto.categoryName ?? undefined,
      notes: dto.notes === undefined ? existing.notes ?? undefined : dto.notes ?? undefined,
      tags: nextTags,
    });

    const previousSnapshot = this.snapshotFromTransaction(existing);

    return this.prisma.$transaction(async (tx) => {
      await this.applyBalanceEffect(tx, previousSnapshot, 'reverse');
      const transaction = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          financialProfileId: nextSnapshot.financialProfileId,
          accountId: nextSnapshot.accountId,
          destinationAccountId: nextSnapshot.destinationAccountId,
          categoryId: nextSnapshot.categoryId,
          type: nextSnapshot.type,
          amount: nextSnapshot.amount,
          currencyCode: nextSnapshot.currencyCode,
          description: nextSnapshot.description,
          categoryName: nextSnapshot.categoryName,
          occurredAt: nextSnapshot.occurredAt,
          notes: nextSnapshot.notes,
        },
        include: this.defaultIncludes(),
      });
      await this.syncTransactionTags(tx, userId, transaction.id, nextSnapshot.financialProfileId, nextSnapshot.tags);
      await this.applyBalanceEffect(tx, nextSnapshot, 'apply');
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.TRANSACTION_UPDATED,
          entityType: 'Transaction',
          entityId: transaction.id,
          metadata: this.toAuditMetadata(nextSnapshot),
        },
      });

      return tx.transaction.findUniqueOrThrow({ where: { id: transaction.id }, include: this.defaultIncludes() });
    });
  }

  async remove(userId: string, transactionId: string) {
    const existing = await this.findOwnedTransaction(userId, transactionId);
    const snapshot = this.snapshotFromTransaction(existing);

    return this.prisma.$transaction(async (tx) => {
      await this.applyBalanceEffect(tx, snapshot, 'reverse');
      const transaction = await tx.transaction.update({
        where: { id: transactionId },
        data: { deletedAt: new Date() },
        include: this.defaultIncludes(),
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: AuditAction.TRANSACTION_DELETED,
          entityType: 'Transaction',
          entityId: transaction.id,
          metadata: this.toAuditMetadata(snapshot),
        },
      });

      return transaction;
    });
  }

  private async buildSnapshot(userId: string, dto: CreateTransactionDto): Promise<TransactionSnapshot> {
    const amount = this.parseAmount(dto.amount, dto.type);
    const occurredAt = this.parseDate(dto.occurredAt, 'Data da transação inválida.');
    const sourceAccount = await this.ensureActiveAccountBelongsToUser(userId, dto.accountId);
    await this.ensureProfileBelongsToUser(userId, dto.financialProfileId);

    if (sourceAccount.financialProfileId !== dto.financialProfileId) {
      throw new BadRequestException('A conta selecionada não pertence ao perfil financeiro informado.');
    }

    let destinationAccount: Account | null = null;

    if (dto.type === TransactionType.TRANSFER) {
      if (!dto.destinationAccountId) {
        throw new BadRequestException('Transferências exigem uma conta de destino.');
      }

      if (dto.destinationAccountId === dto.accountId) {
        throw new BadRequestException('A conta de destino deve ser diferente da conta de origem.');
      }

      destinationAccount = await this.ensureActiveAccountBelongsToUser(userId, dto.destinationAccountId);

      if (destinationAccount.currencyCode !== sourceAccount.currencyCode) {
        throw new BadRequestException('Nesta fase, transferências só podem ocorrer entre contas da mesma moeda.');
      }
    } else if (dto.destinationAccountId) {
      throw new BadRequestException('Conta de destino só deve ser informada para transferências.');
    }

    const category = dto.categoryId ? await this.categoriesService.ensureCategoryVisibleForProfile(userId, dto.categoryId, dto.financialProfileId) : null;
    const tags = this.categoriesService.normalizeTags(dto.tags);

    return {
      financialProfileId: dto.financialProfileId,
      accountId: dto.accountId,
      destinationAccountId: destinationAccount?.id ?? null,
      categoryId: category?.id ?? null,
      type: dto.type,
      amount,
      currencyCode: sourceAccount.currencyCode,
      description: dto.description.trim(),
      categoryName: category?.name ?? (dto.categoryName?.trim() || null),
      occurredAt,
      notes: dto.notes?.trim() || null,
      tags: tags.map((tag) => tag.name),
    };
  }

  private parseAmount(value: string, type: TransactionType) {
    let amount: Prisma.Decimal;

    try {
      amount = new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException('Valor da transação inválido.');
    }

    if (type === TransactionType.ADJUSTMENT) {
      if (amount.equals(0)) throw new BadRequestException('Ajuste de saldo não pode ter valor zero.');
      return amount;
    }

    if (amount.lte(0)) throw new BadRequestException('Receitas, despesas e transferências exigem valor maior que zero.');
    return amount;
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

  private async applyBalanceEffect(tx: Prisma.TransactionClient, snapshot: TransactionSnapshot, mode: 'apply' | 'reverse') {
    const multiplier = mode === 'apply' ? 1 : -1;
    const sourceDelta = this.sourceDelta(snapshot).mul(multiplier);
    const destinationDelta = snapshot.type === TransactionType.TRANSFER ? snapshot.amount.mul(multiplier) : null;

    await this.incrementAccountBalance(tx, snapshot.accountId, sourceDelta);

    if (snapshot.destinationAccountId && destinationDelta) {
      await this.incrementAccountBalance(tx, snapshot.destinationAccountId, destinationDelta);
    }
  }

  private sourceDelta(snapshot: TransactionSnapshot) {
    if (snapshot.type === TransactionType.INCOME) return snapshot.amount;
    if (snapshot.type === TransactionType.EXPENSE) return snapshot.amount.neg();
    if (snapshot.type === TransactionType.TRANSFER) return snapshot.amount.neg();
    return snapshot.amount;
  }

  private async incrementAccountBalance(tx: Prisma.TransactionClient, accountId: string, delta: Prisma.Decimal) {
    await tx.account.update({
      where: { id: accountId },
      data: {
        currentBalance: { increment: delta },
        projectedBalance: { increment: delta },
      },
    });
  }

  private async syncTransactionTags(tx: Prisma.TransactionClient, userId: string, transactionId: string, financialProfileId: string, tagNames: string[]) {
    await tx.transactionTag.deleteMany({ where: { transactionId } });
    const tags = this.categoriesService.normalizeTags(tagNames);

    for (const tagData of tags) {
      let tag = await tx.tag.findUnique({
        where: {
          userId_financialProfileId_normalizedName: {
            userId,
            financialProfileId,
            normalizedName: tagData.normalizedName,
          },
        },
      });

      if (!tag) {
        tag = await tx.tag.create({
          data: {
            userId,
            financialProfileId,
            name: tagData.name,
            normalizedName: tagData.normalizedName,
          },
        });

        await tx.auditLog.create({
          data: {
            userId,
            action: AuditAction.TAG_CREATED,
            entityType: 'Tag',
            entityId: tag.id,
            metadata: { financialProfileId, name: tag.name, normalizedName: tag.normalizedName },
          },
        });
      }

      await tx.transactionTag.create({ data: { transactionId, tagId: tag.id } });
    }
  }

  private async ensureProfileBelongsToUser(userId: string, financialProfileId: string) {
    const profile = await this.prisma.financialProfile.findFirst({ where: { id: financialProfileId, userId, status: 'ACTIVE' } });
    if (!profile) throw new NotFoundException('Perfil financeiro não encontrado para este usuário.');
    return profile;
  }

  private async ensureAccountBelongsToUser(userId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({ where: { id: accountId, financialProfile: { userId } } });
    if (!account) throw new NotFoundException('Conta financeira não encontrada.');
    return account;
  }

  private async ensureActiveAccountBelongsToUser(userId: string, accountId: string) {
    const account = await this.ensureAccountBelongsToUser(userId, accountId);
    if (account.status !== AccountStatus.ACTIVE) throw new BadRequestException('Apenas contas ativas podem receber lançamentos.');
    return account;
  }

  private async ensureCategoryBelongsToUser(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new NotFoundException('Categoria não encontrada para este usuário.');
    return category;
  }

  private async findOwnedTransaction(userId: string, transactionId: string): Promise<TransactionWithAccounts> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, deletedAt: null, financialProfile: { userId } },
      include: { account: true, destinationAccount: true, tags: { include: { tag: { select: { name: true } } } } },
    });

    if (!transaction) throw new NotFoundException('Transação financeira não encontrada.');
    return transaction;
  }

  private snapshotFromTransaction(transaction: TransactionWithAccounts): TransactionSnapshot {
    return {
      financialProfileId: transaction.financialProfileId,
      accountId: transaction.accountId,
      destinationAccountId: transaction.destinationAccountId,
      categoryId: transaction.categoryId,
      type: transaction.type,
      amount: transaction.amount,
      currencyCode: transaction.currencyCode,
      description: transaction.description,
      categoryName: transaction.categoryName,
      occurredAt: transaction.occurredAt,
      notes: transaction.notes,
      tags: transaction.tags.map((item) => item.tag.name),
    };
  }

  private toAuditMetadata(snapshot: TransactionSnapshot): Prisma.InputJsonObject {
    return {
      financialProfileId: snapshot.financialProfileId,
      accountId: snapshot.accountId,
      destinationAccountId: snapshot.destinationAccountId,
      categoryId: snapshot.categoryId,
      type: snapshot.type,
      amount: snapshot.amount.toFixed(2),
      currencyCode: snapshot.currencyCode,
      description: snapshot.description,
      categoryName: snapshot.categoryName,
      occurredAt: snapshot.occurredAt.toISOString(),
      notes: snapshot.notes,
      tags: snapshot.tags,
    };
  }

  private defaultIncludes() {
    return {
      financialProfile: { select: { id: true, name: true, type: true } },
      account: { select: { id: true, name: true, currencyCode: true } },
      destinationAccount: { select: { id: true, name: true, currencyCode: true } },
      category: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
      tags: { include: { tag: { select: { id: true, name: true } } } },
    } satisfies Prisma.TransactionInclude;
  }
}
