-- 2026-05-07: 메뉴 원가율 임계값 + 식당 전체 임계값 추가
-- 청구 #9: 임계 초과 시 사장 푸시 알림 트리거

-- 메뉴별 임계 원가율 (퍼센트, 예: 35.0 = 35%)
ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "costRatioThreshold" DOUBLE PRECISION;

-- 식당 전체 임계 원가율 (퍼센트, 기본값은 NULL 비활성)
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "globalCostRatioThreshold" DOUBLE PRECISION;