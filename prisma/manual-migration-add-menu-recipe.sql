-- 2026-04-29: 메뉴/레시피/매출항목 — 자동 재고 차감 + 원가율 산출 기반
-- 특허 청구 후보 ②③④⑨ 데이터 모델

-- 메뉴
CREATE TABLE IF NOT EXISTS "Menu" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "restaurantId" TEXT NOT NULL REFERENCES "Restaurant"("id") ON DELETE CASCADE,
  "name"         TEXT NOT NULL,
  "price"        DOUBLE PRECISION NOT NULL,
  "category"     TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Menu_restaurantId_isActive_idx" ON "Menu"("restaurantId", "isActive");

-- 메뉴-재고 매핑 (레시피)
CREATE TABLE IF NOT EXISTS "MenuRecipe" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "menuId"          TEXT NOT NULL REFERENCES "Menu"("id") ON DELETE CASCADE,
  "inventoryItemId" TEXT NOT NULL REFERENCES "InventoryItem"("id") ON DELETE CASCADE,
  "qtyUsed"         DOUBLE PRECISION NOT NULL,
  CONSTRAINT "MenuRecipe_menuId_inventoryItemId_key" UNIQUE ("menuId", "inventoryItemId")
);
CREATE INDEX IF NOT EXISTS "MenuRecipe_menuId_idx" ON "MenuRecipe"("menuId");

-- 매출 항목 (sale 1건의 메뉴별 판매)
CREATE TABLE IF NOT EXISTS "SaleItem" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "saleId"    TEXT NOT NULL REFERENCES "Sale"("id") ON DELETE CASCADE,
  "menuId"    TEXT REFERENCES "Menu"("id") ON DELETE SET NULL,
  "rawName"   TEXT NOT NULL,
  "qty"       INTEGER NOT NULL,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "subtotal"  DOUBLE PRECISION NOT NULL,
  "costAtSale" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX IF NOT EXISTS "SaleItem_menuId_idx" ON "SaleItem"("menuId");
