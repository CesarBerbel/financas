-- Fase 2 - Transacoes financeiras
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT');

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRANSACTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRANSACTION_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TRANSACTION_DELETED';

CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL,
  "financialProfileId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "destinationAccountId" TEXT,
  "type" "TransactionType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currencyCode" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "categoryName" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Transaction_financialProfileId_occurredAt_idx" ON "Transaction"("financialProfileId", "occurredAt");
CREATE INDEX "Transaction_accountId_occurredAt_idx" ON "Transaction"("accountId", "occurredAt");
CREATE INDEX "Transaction_destinationAccountId_occurredAt_idx" ON "Transaction"("destinationAccountId", "occurredAt");
CREATE INDEX "Transaction_currencyCode_idx" ON "Transaction"("currencyCode");
CREATE INDEX "Transaction_categoryName_idx" ON "Transaction"("categoryName");
CREATE INDEX "Transaction_deletedAt_idx" ON "Transaction"("deletedAt");

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_financialProfileId_fkey" FOREIGN KEY ("financialProfileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
