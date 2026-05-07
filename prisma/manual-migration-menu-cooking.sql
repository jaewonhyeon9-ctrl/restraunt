-- 2026-05-07: 메뉴에 조리 매뉴얼 + 사진 추가
-- 레시피 등록 시 조리 절차도 함께 기록 → 직원 교육 자료 자동 생성

ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "cookingSteps" TEXT;
ALTER TABLE "Menu" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
