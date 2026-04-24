-- 유료 플랜 + OCR 월 사용량 집계 (2026-04-25)
-- 실행: Supabase SQL Editor에서 전체 실행
-- 여러 번 실행해도 안전

BEGIN;

-- 1. Plan enum
DO $$ BEGIN
  CREATE TYPE "Plan" AS ENUM ('FREE', 'STANDARD', 'PRO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Restaurant.plan 컬럼 추가
ALTER TABLE "Restaurant"
  ADD COLUMN IF NOT EXISTS "plan" "Plan" NOT NULL DEFAULT 'FREE';

-- 3. OcrUsage 테이블 (월별 사용량 카운터)
CREATE TABLE IF NOT EXISTS "OcrUsage" (
  "id"           TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "yearMonth"    TEXT NOT NULL,
  "count"        INTEGER NOT NULL DEFAULT 0,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OcrUsage_pkey" PRIMARY KEY ("id")
);

-- 4. 고유키 (사업장 × 월당 한 row)
CREATE UNIQUE INDEX IF NOT EXISTS "OcrUsage_restaurantId_yearMonth_key"
  ON "OcrUsage"("restaurantId", "yearMonth");

CREATE INDEX IF NOT EXISTS "OcrUsage_restaurantId_idx"
  ON "OcrUsage"("restaurantId");

-- 5. FK
DO $$ BEGIN
  ALTER TABLE "OcrUsage"
    ADD CONSTRAINT "OcrUsage_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 6. updatedAt 자동 갱신 트리거
CREATE OR REPLACE FUNCTION set_ocr_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ocr_usage_updated_at ON "OcrUsage";
CREATE TRIGGER trg_ocr_usage_updated_at
  BEFORE UPDATE ON "OcrUsage"
  FOR EACH ROW EXECUTE FUNCTION set_ocr_usage_updated_at();

COMMIT;
