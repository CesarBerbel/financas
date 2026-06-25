import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Account, AccountStatus, AuditAction, Prisma, Transaction, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto, TransactionListFilters, UpdateTransactionDto } from './dto';

type TransactionWithAccounts = Transaction & {
  account: Account;
  destinationAccount: Account | null;
};

type TransactionSnapshot = {
  financialProfileId: string;
  accountId: string;
  destinationAccountId: string | null;
  type: TransactionType;
  amount: Prisma.Decimal;
  currencyCode: string;
  description: string;
  categoryName: string | null;
  occurredAt: Date;
  notes: string | null;
};

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, filters: TransactionListFilters) {
    if (filters.financialProfileId) await this.ensureProfileBelongsToUser(userId, filters.financialProfileId);
    if (filters.accountId) await this.ensureAccountBelongsToUser(userId, filters.accountId);

    return this.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        financialProfile: { userId },
        ...(filters.financialProfileId ? { financialProfileId: filters.financialProfileId } : {}),
        ...(filters.accountId ? { OR: [{ accountId: filters.accountId }, { destinationAccountId: filters.accountId }] } : {}),
        ...(filters.categoryName ? { categoryName: { contains: filters.categoryName, mode: 'insensitive' } } : {}),
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

      return transaction;
    });
  }

  async update(userId: string, transactionId: string, dto: UpdateTransactionDto) {
    const existing = await this.findOwnedTransaction(userId, transactionId);
    const nextType = dto.type ?? existing.type;
    const nextDestinationAccountId = nextType === TransactionType.TRANSFER
      ? dto.destinationAccountId === undefined ? existing.destinationAccountId ?? undefined : dto.destinationAccountId ?? undefined
      : undefined;

    const nextSnapshot = await this.buildSnapshot(userId, {
      financialProfileId: dto.financialProfileId ?? existing.financialProfileId,
      accountId: dto.accountId ?? existing.accountId,
      destinationAccountId: nextDestinationAccountId,
      type: nextType,
      amount: dto.amount ?? existing.amount.toFixed(2),
      occurredAt: dto.occurredAt ?? existing.occurredAt.toISOString(),
      description: dto.description ?? existing.description,
      categoryName: dto.categoryName === undefined ? existing.categoryName ?? undefined : dto.categoryName ?? undefined,
      notes: dto.notes === undefined ? existing.notes ?? undefined : dto.notes ?? undefined,
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

      return transaction;
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

    return {
      financialProfileId: dto.financialProfileId,
      accountId: dto.accountId,
      destinationAccountId: destinationAccount?.id ?? null,
      type: dto.type,
      amount,
      currencyCode: sourceAccount.currencyCode,
      description: dto.description.trim(),
      categoryName: dto.categoryName?.trim() || null,
      occurredAt,
      notes: dto.notes?.trim() || null,
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

  private async findOwnedTransaction(userId: string, transactionId: string): Promise<TransactionWithAccounts> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, deletedAt: null, financialProfile: { userId } },
      include: { account: true, destinationAccount: true },
    });

    if (!transaction) throw new NotFoundException('Transação financeira não encontrada.');
    return transaction;
  }

  private snapshotFromTransaction(transaction: Transaction): TransactionSnapshot {
    return {
      financialProfileId: transaction.financialProfileId,
      accountId: transaction.accountId,
      destinationAccountId: transaction.destinationAccountId,
      type: transaction.type,
      amount: transaction.amount,
      currencyCode: transaction.currencyCode,
      description: transaction.description,
      categoryName: transaction.categoryName,
      occurredAt: transaction.occurredAt,
      notes: transaction.notes,
    };
  }

  private toAuditMetadata(snapshot: TransactionSnapshot): Prisma.InputJsonObject {
    return {
      financialProfileId: snapshot.financialProfileId,
      accountId: snapshot.accountId,
      destinationAccountId: snapshot.destinationAccountId,
      type: snapshot.type,
      amount: snapshot.amount.toFixed(2),
      currencyCode: snapshot.currencyCode,
      description: snapshot.description,
      categoryName: snapshot.categoryName,
      occurredAt: snapshot.occurredAt.toISOString(),
      notes: snapshot.notes,
    };
  }

  private defaultIncludes() {
    return {
      financialProfile: { select: { id: true, name: true, type: true } },
      account: { select: { id: true, name: true, currencyCode: true } },
      destinationAccount: { select: { id: true, name: true, currencyCode: true } },
    } satisfies Prisma.TransactionInclude;
  }
}
