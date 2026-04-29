-- 2026-04-29: PWA Web Push 구독 테이블

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "endpoint"  TEXT NOT NULL UNIQUE,
  "p256dh"    TEXT NOT NULL,
  "authKey"   TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
