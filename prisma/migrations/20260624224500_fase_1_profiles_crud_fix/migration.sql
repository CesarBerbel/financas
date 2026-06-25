DROP INDEX IF EXISTS "FinancialProfile_userId_type_key";
CREATE INDEX IF NOT EXISTS "FinancialProfile_userId_type_idx" ON "FinancialProfile"("userId", "type");
