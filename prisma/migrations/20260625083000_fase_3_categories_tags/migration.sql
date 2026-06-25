-- Fase 3 - Categorias hierarquicas, tags livres e relatorio por categoria.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CATEGORY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CATEGORY_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CATEGORY_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TAG_CREATED';

CREATE TABLE "Category" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "financialProfileId" TEXT,
  "parentId" TEXT,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tag" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "financialProfileId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransactionTag" (
  "transactionId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TransactionTag_pkey" PRIMARY KEY ("transactionId", "tagId")
);

ALTER TABLE "Transaction" ADD COLUMN "categoryId" TEXT;

CREATE INDEX "Category_userId_financialProfileId_idx" ON "Category"("userId", "financialProfileId");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");
CREATE INDEX "Category_normalizedName_idx" ON "Category"("normalizedName");
CREATE UNIQUE INDEX "Tag_userId_financialProfileId_normalizedName_key" ON "Tag"("userId", "financialProfileId", "normalizedName");
CREATE INDEX "Tag_financialProfileId_idx" ON "Tag"("financialProfileId");
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");
CREATE INDEX "TransactionTag_tagId_idx" ON "TransactionTag"("tagId");

ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_financialProfileId_fkey" FOREIGN KEY ("financialProfileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_financialProfileId_fkey" FOREIGN KEY ("financialProfileId") REFERENCES "FinancialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TransactionTag" ADD CONSTRAINT "TransactionTag_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransactionTag" ADD CONSTRAINT "TransactionTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
