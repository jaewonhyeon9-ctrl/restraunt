-- 2026-04-29: GPS 검증 옵션 + 기본 반경 완화
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "gpsEnforced" BOOLEAN NOT NULL DEFAULT true;

-- 기존 매장의 너무 좁은 반경 완화 (50m → 200m, 사용자가 수동으로 변경한 경우 유지)
UPDATE "Restaurant" SET "gpsRadius" = 200 WHERE "gpsRadius" = 50;

-- 기본값 변경
ALTER TABLE "Restaurant" ALTER COLUMN "gpsRadius" SET DEFAULT 200;
