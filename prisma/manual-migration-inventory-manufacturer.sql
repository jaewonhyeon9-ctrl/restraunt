-- 2026-05-06: 재고 품목에 제조사 + 패키지 중량(g) 필드 추가
-- 목적: 거래처/품목/제조사/가격/10g당 가격 비교가 가능하도록

ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "manufacturer" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "packageWeightG" DOUBLE PRECISION;

-- packageWeightG는 패키지 1개당 중량(g).
-- 예) 5kg 포대 = 5000, 1팩 350g = 350
-- unit과 무관하게 클라이언트에서 unitPrice / packageWeightG * 10으로 10g당 가격 계산.
