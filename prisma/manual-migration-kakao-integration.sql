-- 카카오톡 연동 (나에게 보내기 자동 발송) — 2026-04-25
-- 실행: Supabase SQL Editor에서 아래 전체 블록 복사 후 Run
-- 여러 번 실행해도 안전 (IF NOT EXISTS)

BEGIN;

CREATE TABLE IF NOT EXISTS "KakaoIntegration" (
  "id"                 TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "kakaoId"            TEXT NOT NULL,
  "accessToken"        TEXT NOT NULL,
  "refreshToken"       TEXT NOT NULL,
  "expiresAt"          TIMESTAMP(3) NOT NULL,
  "dailyReportEnabled" BOOLEAN NOT NULL DEFAULT true,
  "sendHour"           INTEGER NOT NULL DEFAULT 23,
  "lastSentAt"         TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KakaoIntegration_pkey" PRIMARY KEY ("id")
);

-- userId는 User 1명당 1개
CREATE UNIQUE INDEX IF NOT EXISTS "KakaoIntegration_userId_key" ON "KakaoIntegration"("userId");

-- User FK (cascade 삭제)
DO $$ BEGIN
  ALTER TABLE "KakaoIntegration"
    ADD CONSTRAINT "KakaoIntegration_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- updatedAt 자동 갱신 트리거
CREATE OR REPLACE FUNCTION set_kakao_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kakao_integration_updated_at ON "KakaoIntegration";
CREATE TRIGGER trg_kakao_integration_updated_at
  BEFORE UPDATE ON "KakaoIntegration"
  FOR EACH ROW EXECUTE FUNCTION set_kakao_integration_updated_at();

COMMIT;
