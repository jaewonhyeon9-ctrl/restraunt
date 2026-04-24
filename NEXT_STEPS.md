# 오토드림 — 진행 상황 & 내일 할 일

> 최종 업데이트: 2026-04-25 저녁

---

## 🆕 2026-04-25 완료

### ✅ Supabase SQL 마이그레이션 실행 완료
- `ChecklistCategory` enum, `ChecklistTemplate.category/scheduledTime` 컬럼 추가
- `DailyNote` 테이블 + `DailyNoteType` enum 추가
- 프로덕션 DB 반영 완료 (Node + pg로 직접 실행)

### ✅ 체크리스트 엑셀 업로드 확장
- 헤더 행 자동 탐지 (상위 15행 중 키워드 매칭)
- 병합 셀 forward-fill (시간/구분 컬럼)
- `항목` + `체크리스트` 둘 다 있으면 → 항목=제목, 체크리스트=설명
- 카테고리 컬럼 없으면 UI 드롭다운 기본값 사용
- 자연어 시간 (예: "오픈 1시간전") → timeSlot으로 흡수

### ✅ 매출 연동 4-tier 기능 추가
- 엑셀/CSV 업로드: [/api/sales/bulk](src/app/api/sales/bulk/route.ts)
  - 컬럼 자동 감지 (날짜/총매출/현금/카드/배달 다양한 alias)
  - 소스 선택 (자동/POS/배민/쿠팡이츠/요기요)
  - 배달앱 소스 시 배달 부분만 병합 (기존 POS 매출 유지)
- 사진 OCR: [/api/sales/ocr](src/app/api/sales/ocr/route.ts)
  - Gemini 2.5 Flash Vision 재사용 (영수증 OCR과 동일 인프라)
  - POS 마감 화면/배달앱 정산 화면 자동 구분
  - `GEMINI_API_KEY` 기존 키 그대로 사용
- UI: 일별 손익 페이지 헤더에 "📥 POS" 버튼 + 매출 입력 모달에 "📷 POS 화면 사진으로 자동 입력" 버튼

### 🎯 제품 전략 결정
- **무료 기본 기능**: 직접 입력 / 엑셀 / CSV / OCR (4-tier)
- **유료 B2B 분리**: 헤르메스 에이전트 등 실시간 연동 → 개별 컨설팅/교육/연동비
- **푸드테크 파트너십**: 사용자 1000명+ 후 재검토

---

## ✅ 오늘까지 완료한 것

### 🎨 브랜딩 전환
- **더찰칵 → 오토드림** 전면 리브랜딩
  - manifest, layout, 로그인, 헤더, 개인정보처리방침
  - 피처 그래픽 1024x500 재생성 ("꿈꾸던 식당 운영, 자동으로")
- 데스크탑 바로가기: `C:\Users\Hyun Jae Won\Desktop\오토드림.lnk` (Chrome 앱 모드)

### 🛠 주요 기능 추가
- **PWA 설정**: manifest.ts, sw.js, icons(192/512/maskable), offline 페이지
- **개인정보처리방침**: `/privacy` 라우트 배포
- **체크리스트**:
  - 주방(KITCHEN)·서빙(HALL) 카테고리 분리
  - 타임라인 시간(HH:mm) 지정 + 시간순 정렬
  - 엑셀 업로드 + 샘플 다운로드 (직접 입력/엑셀 탭)
  - 사장 관리 페이지 `/checklist-admin`
- **일일 메모 4종**: 다음 타임 전달 / 특이사항 / 사장 전달 / 고객 컴플레인
- **재고 엑셀 업로드**: `/inventory` 헤더 "📥 엑셀" 버튼
- **대시보드 직원 업무 성과율 카드**: 오늘/7일/이번달 탭, 메달, 주방/서빙 세부 %

### 🎨 UI 디자인
- AI 다크 테마 시스템 (`globals.css`: glass-card, ai-border, btn-primary, chip)
- 사장/직원 레이아웃, 탭바, 대시보드 전체 다크 네이비 + 인디고 액센트

### 🔐 인증·배포 인프라
- GitHub 자동 배포 동작 확인 (jaewonhyeon9-ctrl/restraunt → Vercel restraunt 프로젝트)
- `git push` 후 약 40초~1분 내 Production 반영

---

## 🚨 내일 꼭 해야 할 것 (우선순위 순)

### 1️⃣ Supabase SQL 마이그레이션 실행
**왜**: 체크리스트 카테고리/시간, 일일 메모 테이블이 DB에 아직 없음 — 현재 프로덕션에서 /checklist 접속하면 에러

**어떻게**:
1. [Supabase 대시보드](https://supabase.com/dashboard) → 프로젝트 → SQL Editor → New Query
2. [prisma/manual-migration-add-checklist-category.sql](./prisma/manual-migration-add-checklist-category.sql) 내용 전체 복사/붙여넣기
3. Run 클릭 (BEGIN/COMMIT으로 감싸져 있어 실패 시 자동 롤백)

`IF NOT EXISTS`/`duplicate_object` 예외 처리로 **여러 번 실행해도 안전**.

### 2️⃣ PWABuilder에서 Package ID 변경 AAB 재생성
**왜**: Package ID `com.dechalkak.app` → `com.autodream.app` 변경. Play Store 업로드 전이라 지금이 바꿀 수 있는 유일한 기회.

**어떻게**:
1. https://www.pwabuilder.com 접속
2. URL 입력: `https://restraunt-ebon-phi.vercel.app?v=3` (캐시 우회)
3. Package For Stores → Android → Google Play 탭
4. 옵션:
   - Package ID: **`com.autodream.app`** ⭐
   - App name: `오토드림`
5. "All Settings ▶" 펼치기 → Signing Key: **"New"** 선택
6. Download Package → ZIP 다운로드

**ZIP 안에서 클로드에게 줄 것**:
- `assetlinks.json` 내용 (클로드가 `public/.well-known/assetlinks.json`에 배포)

**ZIP 안에서 사용자가 보관할 것**:
- `signing.keystore` — Play Store 업데이트 영구 키, **여러 곳 백업 필수**
- `signing-key-info.txt` — 비밀번호/alias

### 3️⃣ Google Play Developer 계정 승인 확인
**현재 상태**: 신원 확인 중 (오늘 기준)

**할 일**:
- Gmail(`jaewonhyeon9@gmail.com`) 편지함에서 Google Play 안내 메일 확인
- 승인 완료 시 → Play Console 접속해서 앱 등록 가능

### 4️⃣ Play Console에 앱 등록 (승인 후)
필요한 자료:
- **AAB 파일**: PWABuilder에서 받은 `오토드림.aab` (2번 결과물)
- **스크린샷**: 폰에서 앱 주요 화면 2~8장 (최소 2장)
- **고해상도 아이콘**: `play-store-icon-512.png` (이미 있음)
- **피처 그래픽**: https://restraunt-ebon-phi.vercel.app/feature-graphic-1024x500.png
- **앱 설명**: [PLAY_STORE_LISTING.md](./PLAY_STORE_LISTING.md) 에 정리됨
- **개인정보처리방침 URL**: https://restraunt-ebon-phi.vercel.app/privacy
- **콘텐츠 등급/타겟 고객/데이터 보안** 설문

---

## 📁 중요 경로 & 링크

### 배포 & 저장소
- **라이브 사이트**: https://restraunt-ebon-phi.vercel.app
- **GitHub 레포**: https://github.com/jaewonhyeon9-ctrl/restraunt
- **Vercel 프로젝트 이름**: `restraunt` (오타 있음, 계속 사용)

### 로컬 경로
- **프로젝트**: `C:\Users\Hyun Jae Won\Desktop\restaurant-app`
- **데스크탑 바로가기**: `C:\Users\Hyun Jae Won\Desktop\오토드림.lnk`
- **Play Store 등록 자료**: [PLAY_STORE_LISTING.md](./PLAY_STORE_LISTING.md)

### 키스토어 백업 (현재는 구 버전)
- `C:\Users\Hyun Jae Won\Documents\dechalkak-keystore-backup\`
- `C:\Users\Hyun Jae Won\OneDrive\dechalkak-keystore-backup\`
- `C:\Users\Hyun Jae Won\Desktop\다운로드\dechalkak-v2\`

> ⚠️ 위 키스토어는 `com.dechalkak.app` 용이라 새 Package ID(`com.autodream.app`)로 AAB 생성 후 **새 키스토어로 교체됨**. 새 키스토어 받으면 백업 폴더도 `autodream-keystore-backup`으로 새로 만들 것.

### 마이그레이션 파일
- [prisma/manual-migration-add-checklist-category.sql](./prisma/manual-migration-add-checklist-category.sql) — Supabase에서 실행할 SQL

---

## 🔑 현재 서명 정보 (dechalkak, 곧 교체 예정)

```
Package ID:    com.dechalkak.app
SHA256:        5F:98:30:99:8C:46:8E:23:B3:76:0D:75:06:C2:C7:B2:F6:8D:1E:FA:3B:21:F9:13:8F:1E:3C:0C:4A:AB:89:3F
Keystore:      signing.keystore
비밀번호:      fXMZSEjc9_sd
Key alias:     my-key-alias
```

새 AAB 받으면 이 정보는 폐기.

---

## 💡 개발 워크플로우 (클로드가 기억할 것)

- **배포 방식**: CLI `vercel deploy` 쓰지 말고 **`git push`만** — 자동 배포됨
- **CLI 배포하면 롤백 위험**: 로컬이 origin/main보다 뒤져 있으면 프로덕션을 과거로 돌림 (이미 한 번 겪음)
- **스키마 변경 시**: `prisma/schema.prisma` 수정 → `prisma/manual-migration-*.sql` 파일 생성 → Supabase SQL Editor 수동 실행 (Next.js 프로젝트에 `prisma migrate` 사용 안 함)
- **이미지 생성**: Python + Pillow (시스템에 설치됨, Malgun/MalgunBd 폰트로 한글 렌더링)

---

## 🎯 그 외 여유 있을 때 할 만한 것

- [ ] 로고 아이콘 전문 디자인 교체 (현재 임시 접시+포크&나이프+셔터링)
- [ ] 앱 온보딩 튜토리얼 (첫 로그인 시 기능 안내)
- [ ] 이용약관 `/terms` 페이지 작성 (현재 proxy.ts에서 공개 경로로만 설정됨)
- [ ] 주문 화면 QR 메뉴 기능
- [ ] 대시보드에 매출 추이 차트
- [ ] PWA 설치 프롬프트 (InstallPrompt 컴포넌트)
