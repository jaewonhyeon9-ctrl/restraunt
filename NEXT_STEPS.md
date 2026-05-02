# 오토드림 — 진행 상황 & 다음 할 일

> 최종 업데이트: 2026-04-29 → 2026-05-02 이어서

---

## 🆕 2026-04-29 완료 (전날 push까지 적용 완료)

### 1. 모달 / UI 픽스
- 모든 모달 z-index `z-50` → `z-[60]` (바텀 네비 위로 정상 표시)
- `vh` → `dvh` (모바일 키보드 가림 해결)
- safe-area 패딩 (저장 버튼 가려짐 방지)
- `RestaurantSwitcher` LocationPicker 200px로 컴팩트화

### 2. DB 연결 풀 전환
- `DATABASE_URL`: Session Pooler(5432) → **Transaction Pooler(6543)** + `pgbouncer=true`
- `DIRECT_URL` 추가 (마이그레이션 전용)
- `MaxClientsInSessionMode` 에러 해결

### 3. 다점포 (Multi-store)
- `UserRestaurant` 다대다 + `User.activeRestaurantId`
- `RestaurantSwitcher` 헤더 드롭다운 + 새 매장 추가 모달
- API: `/api/restaurants/me|switch|create`
- 기존 1:1 데이터 자동 백필됨

### 4. 매장 위치 지도 클릭 (Leaflet, API 키 0원)
- `LocationPicker` — 클릭 / 드래그 / "현재 위치 사용"
- 매장 추가 시 lat/lng 자동 저장

### 5. 메뉴 / 레시피 / 매출항목 스키마
- `Menu`, `MenuRecipe`, `SaleItem` 모델
- 자동 재고 차감 + 원가율 산출 기반
- **UI는 다음 작업**

### 6. 달력 매출 OCR 일괄 등록
- `/api/sales/ocr-calendar` (Gemini Vision 캘린더 전용 프롬프트)
- `/api/sales/bulk-import` (skip/replace/add)
- `CalendarSalesOcr` 컴포넌트, `/finance/daily` "📅 달력" 버튼

### 7. PWA Web Push + AI 점장
- VAPID 키 + Vercel env
- `PushSubscription` 모델 + `/api/push/subscribe`
- `PushSubscribeCard` 대시보드
- `/api/push/test` 즉시 테스트 알림
- **AI 점장** (`lib/ai-manager.ts`) — Gemini Flash 분석 + 자연어 리포트
- 매일 22:00 KST 자동 푸시 (Vercel cron `0 13 * * *`)

### 8. 직급 계층 (점장/대리/사원)
- `Role` enum: OWNER, MANAGER, DEPUTY, STAFF (EMPLOYEE 호환)
- `lib/permissions.ts` — 직급별 권한 헬퍼
- `proxy.ts` — MANAGER도 사장 영역 접근 OK
- 6개 API의 OWNER-only 체크 → OWNER+MANAGER 허용
- **MANAGER (점장)** = 사장 권한 (단 일일 리포트는 OWNER만)
- **DEPUTY (대리)** = 영수증 OCR + 직원 권한
- **STAFF (사원)** = 기본 직원 권한

### 9. 사진 인증 체크리스트 (스키마만)
- `ChecklistTemplate.requiresPhoto`, `requiredOnClockOut`
- `ChecklistLog.photoUrl`
- 마이그레이션 적용 완료
- **UI는 다음 작업**

### 10. 특허 명세서 PDF 4종
- `PATENT_DRAFT.pdf` / `PATENT_PRIOR_ART.pdf` / `PATENT_ONE_PAGER.pdf` / `PATENT_DRAFT_EN.pdf`
- 청구 후보 11개 (다단계/OCR 매출/재고차감/매핑학습/정규화/PWA/AI리포트/발주예측/원가율/GPS급여/엑셀고정비)

---

## 📋 진행 중 / 미완성

### 우선순위 A — 약속한 기능 마무리

**1. 직원 등록 시 직급 선택 UI** ⏳ 작업 시작
- 현재 `/api/employees`가 `role: 'EMPLOYEE'` 강제 저장
- 폼에 직급 selector (점장/대리/사원) 추가
- 영향:
  - `src/app/api/employees/route.ts` POST/GET (role 필터 + 입력)
  - `src/app/api/employees/[id]/route.ts` PATCH (role 변경)
  - `src/app/(owner)/employees/page.tsx` 폼 + 리스트 표시
- `lib/permissions.ts` 의 `ROLE_OPTIONS` 사용

**2. 퇴근 사진 체크리스트 UI**
- 스키마는 적용됨
- 사장 admin: `/checklist-admin` 에 `requiresPhoto` / `requiredOnClockOut` 토글
- 직원 UI: 클럭아웃 전 체크 + 사진 업로드 강제
- 사진 업로드: Cloudinary (기존 인프라 재사용)

**3. 메뉴 / 레시피 / 원가율 UI**
- 메뉴 CRUD 페이지 (`/menu` 신설)
- 메뉴별 레시피(재고 매핑)
- 매출 입력 시 메뉴 선택 → 자동 차감
- 원가율 대시보드 (메뉴별 / 전체)

### 우선순위 B — UI 정리 / 온보딩 (베타 피드백 후)

**4. 대시보드 카드 재배치 + "설정" 페이지 분리**
- 대시보드 = 매일 보는 핵심만
- 설정 페이지 신설: 카카오/푸시/매장/OCR 사용량

**5. 신규 사용자 온보딩 가이드**

---

## 🛠 운영 가이드

### DB 마이그레이션 (프로덕션)

```bash
DATABASE_URL='postgresql://postgres.xtujnrdxlcfmpjpvsiqe:guswodnjs12%5E%5E@aws-1-ap-south-1.pooler.supabase.com:5432/postgres' \
node scripts/run-migrations.mjs prisma/manual-migration-XXX.sql
```

### 배포

```bash
git add -A && git commit -m "..." && git push  # Vercel 자동 배포
```

### Prisma 클라이언트 재생성

```bash
npx prisma generate
```

---

## 📝 마이그레이션 히스토리 (최신)

| 파일 | 내용 |
|---|---|
| `manual-migration-add-checklist-category.sql` | 체크리스트 카테고리 |
| `manual-migration-add-tax-fields.sql` | 세금 필드 |
| `manual-migration-kakao-integration.sql` | 카카오톡 연동 |
| `manual-migration-plan-ocr-usage.sql` | OCR 사용량 |
| `manual-migration-add-menu-recipe.sql` | Menu / MenuRecipe / SaleItem |
| `manual-migration-multi-store.sql` | UserRestaurant + activeRestaurantId |
| `manual-migration-push-subscription.sql` | PushSubscription |
| `manual-migration-role-hierarchy.sql` | Role enum 확장 |
| `manual-migration-photo-checklist.sql` | requiresPhoto, requiredOnClockOut, photoUrl |

---

## 🔐 Vercel 환경변수 (현재)

```
DATABASE_URL                    ✓ Transaction Pooler 6543
DIRECT_URL                      ✓ Session Pooler 5432
NEXTAUTH_SECRET                 ✓
NEXTAUTH_URL                    ✓
GEMINI_API_KEY                  ✓ (OCR + AI 점장)
CLOUDINARY_*                    ✓
KAKAO_REST_API_KEY              ✓
KAKAO_REDIRECT_URI              ✓
NEXT_PUBLIC_VAPID_PUBLIC_KEY    ✓ Web Push
VAPID_PRIVATE_KEY               ✓
VAPID_SUBJECT                   ✓
```

---

## 🎯 사용자 테스트 흐름

### 1. 다점포
- 헤더 매장 드롭다운 → "+ 새 매장 추가" → 지도 클릭으로 위치 지정 → 자동 전환

### 2. 푸시 알림
- 대시보드 "🔔 앱 알림" → "AI 점장 알림 켜기" → 권한 허용
- "🔔 테스트 알림 보내기" → 즉시 폰에 알림
- 매일 22:00 KST 자동 발송

### 3. 달력 매출 일괄 등록
- /finance/daily → "📅 달력" → 사진 업로드 → 분석 → 일괄 등록

### 4. 직급 권한
- DB에서 `User.role` 직접 수정 (UI 다음 배치)
- MANAGER: 사장과 동일 권한
- DEPUTY: 영수증 OCR 추가
- STAFF: 기본 직원 화면만

---

## 🚀 다음 세션 시작 메시지

> "오토드림 이어서. 직원 등록 직급 선택 UI부터."

또는

> "테스트 피드백 [구체 내용]"
