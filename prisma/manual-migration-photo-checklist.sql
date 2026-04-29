-- 2026-04-29: 사진 인증 체크리스트
ALTER TABLE "ChecklistTemplate" ADD COLUMN IF NOT EXISTS "requiresPhoto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChecklistTemplate" ADD COLUMN IF NOT EXISTS "requiredOnClockOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChecklistLog" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
