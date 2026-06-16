-- 2026-06-16: 영수증/거래명세서 중복 감지
-- ReceiptImage 에 중복 지문(dedupeHash) 컬럼 + 조회 인덱스 추가.
ALTER TABLE "ReceiptImage" ADD COLUMN IF NOT EXISTS "dedupeHash" TEXT;
CREATE INDEX IF NOT EXISTS "ReceiptImage_restaurantId_dedupeHash_idx"
  ON "ReceiptImage" ("restaurantId", "dedupeHash");
