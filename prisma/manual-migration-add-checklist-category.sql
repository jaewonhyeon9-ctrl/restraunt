-- 체크리스트 카테고리(주방/서빙) + 일일 메모 (2026-04-22)
-- 실행: Supabase SQL Editor 또는 psql에서 실행

BEGIN;

-- 1. ChecklistCategory enum
DO $$ BEGIN
  CREATE TYPE "ChecklistCategory" AS ENUM ('KITCHEN', 'HALL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. ChecklistTemplate 테이블에 category, scheduledTime 컬럼 추가
ALTER TABLE "ChecklistTemplate"
  ADD COLUMN IF NOT EXISTS "category" "ChecklistCategory" NOT NULL DEFAULT 'HALL',
  ADD COLUMN IF NOT EXISTS "scheduledTime" TEXT;

-- 3. DailyNoteType enum
DO $$ BEGIN
  CREATE TYPE "DailyNoteType" AS ENUM ('HANDOVER', 'ANOMALY', 'OWNER_NOTE', 'COMPLAINT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. DailyNote 테이블
CREATE TABLE IF NOT EXISTS "DailyNote" (
  "id" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "type" "DailyNoteType" NOT NULL,
  "category" "ChecklistCategory",
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DailyNote_pkey" PRIMARY KEY ("id")
);

-- 5. 인덱스 / FK
CREATE INDEX IF NOT EXISTS "DailyNote_restaurantId_date_idx"
  ON "DailyNote" ("restaurantId", "date");

DO $$ BEGIN
  ALTER TABLE "DailyNote"
    ADD CONSTRAINT "DailyNote_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant" ("id") ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN duplicate_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "DailyNote"
    ADD CONSTRAINT "DailyNote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

COMMIT;

-- 롤백 SQL (문제 발생 시):
-- DROP TABLE IF EXISTS "DailyNote";
-- DROP TYPE IF EXISTS "DailyNoteType";
-- ALTER TABLE "ChecklistTemplate" DROP COLUMN IF EXISTS "scheduledTime";
-- ALTER TABLE "ChecklistTemplate" DROP COLUMN IF EXISTS "category";
-- DROP TYPE IF EXISTS "ChecklistCategory";
