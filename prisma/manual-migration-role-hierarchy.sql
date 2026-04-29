-- 2026-04-29: 직급 계층 추가 (점장/대리/사원)
-- Postgres enum은 값 추가만 가능 (제거 불가). EMPLOYEE는 호환 유지.

DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MANAGER';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DEPUTY';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'STAFF';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
