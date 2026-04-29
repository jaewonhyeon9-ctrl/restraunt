-- 2026-04-29: 다점포 지원 — UserRestaurant 다대다 + activeRestaurantId
-- Phase 1: 스키마 추가 + 기존 데이터 백필 (호환성 유지)

-- UserRestaurant 다대다 테이블
CREATE TABLE IF NOT EXISTS "UserRestaurant" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"       TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "restaurantId" TEXT NOT NULL REFERENCES "Restaurant"("id") ON DELETE CASCADE,
  "role"         "Role" NOT NULL DEFAULT 'OWNER',
  "isPrimary"    BOOLEAN NOT NULL DEFAULT FALSE,
  "joinedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRestaurant_userId_restaurantId_key" UNIQUE ("userId", "restaurantId")
);
CREATE INDEX IF NOT EXISTS "UserRestaurant_userId_idx" ON "UserRestaurant"("userId");
CREATE INDEX IF NOT EXISTS "UserRestaurant_restaurantId_idx" ON "UserRestaurant"("restaurantId");

-- User에 activeRestaurantId
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeRestaurantId" TEXT;

-- 기존 (User → Restaurant) 1:1 데이터를 UserRestaurant로 복사
INSERT INTO "UserRestaurant" ("userId", "restaurantId", "role", "isPrimary", "joinedAt")
SELECT u."id", u."restaurantId", u."role", true, u."createdAt"
FROM "User" u
WHERE u."restaurantId" IS NOT NULL
ON CONFLICT ("userId", "restaurantId") DO NOTHING;

-- 처음엔 activeRestaurantId = 주 매장
UPDATE "User"
SET "activeRestaurantId" = "restaurantId"
WHERE "activeRestaurantId" IS NULL;
