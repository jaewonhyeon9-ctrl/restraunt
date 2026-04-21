-- 세무 자동화 필드 추가 (2026-04-20)
-- 실행: Supabase SQL Editor 또는 psql에서 실행
-- 롤백 필요 시 맨 아래 주석 참고

BEGIN;

-- 1. ReceiptType enum 생성
DO $$ BEGIN
  CREATE TYPE "ReceiptType" AS ENUM ('TAX_INVOICE', 'CARD', 'CASH_RECEIPT', 'SIMPLE', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Expense 테이블에 컬럼 추가
ALTER TABLE "Expense"
  ADD COLUMN IF NOT EXISTS "isVatDeductible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "receiptType" "ReceiptType" NOT NULL DEFAULT 'NONE';

COMMIT;

-- 롤백 SQL (문제 발생 시):
-- ALTER TABLE "Expense" DROP COLUMN IF EXISTS "isVatDeductible";
-- ALTER TABLE "Expense" DROP COLUMN IF EXISTS "receiptType";
-- DROP TYPE IF EXISTS "ReceiptType";
