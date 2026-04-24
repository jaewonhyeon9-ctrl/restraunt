# 오토드림 — 진행 상황 & 다음 할 일

> 최종 업데이트: 2026-04-25 밤

---

## 🆕 2026-04-25 (오늘) 완료

### 📊 대시보드 강화 (사장 화면)
- **직원 성과 카드**: 이름 클릭 → `/employees/[id]` 직원 상세 페이지로 바로 이동
- **`/(owner)/employees/[id]`** 신설: 이번달 근무·급여, 체크리스트 성과, 출퇴근 이력
- **사장님께 전달사항 카드** (OWNER_NOTE): 최근 7일, 접기/더보기
- **대기 발주 카드 확장**: 품목 상세 펼치기 + 대시보드에서 바로 승인/거절

### 🎮 체크리스트 게임화 (직원 동기부여)
- **MissionClearToast**: 체크 시 "+10 XP" 토스트, 콤보 (x2, x3...), Perfect Day 풀스크린 연출
- 상단 **Lv 배지 + XP 진행바** (월 누적)
- `/api/gamification/me`: 월 XP/레벨/오늘 달성 카테고리 반환

### 📊 마감 리포트
- **`/api/reports/daily`**: 매출(현금/카드/배달), 지출(카테고리별), 고정비 일할, 출퇴근, 체크리스트 달성률, 발주, 메모 종합
- **`/finance/daily/report` 페이지**: 공유하기 (Web Share) + 복사 버튼
- 대시보드에 "📊 오늘 마감 리포트" 그라데이션 CTA

### 💬 카카오톡 자동 발송 연동
- **`/api/auth/kakao/*`** OAuth 흐름 (state 검증)
- **`/api/integrations/kakao/*`** 상태/해제/자동발송 토글/즉시발송
- **`/api/cron/daily-report`** + `vercel.json`: 매시간 cron, 각 사장 설정한 KST 시간에 발송
- **KakaoIntegrationCard** 대시보드 장착
- **설정 가이드**: [KAKAO_SETUP.md](./KAKAO_SETUP.md)

---

## 🚨 지금 꼭 해야 할 것 (우선순위 순)

### 1️⃣ Supabase SQL 실행 (카카오 테이블)
**왜**: `KakaoIntegration` 테이블이 DB에 없으면 카카오 연동 전체가 동작 안 함.

**어떻게**:
1. [Supabase 대시보드](https://supabase.com/dashboard) → SQL Editor → New Query
2. [prisma/manual-migration-kakao-integration.sql](./prisma/manual-migration-kakao-integration.sql) 전체 복사/붙여넣기
3. Run (여러 번 실행해도 안전)

### 2️⃣ 카카오 디벨로퍼 앱 + Vercel 환경변수
자세한 단계는 [KAKAO_SETUP.md](./KAKAO_SETUP.md).

**요약**:
- https://developers.kakao.com 에서 앱 생성 → REST API 키 복사
- 플랫폼(Web) + Redirect URI + 카카오 로그인 활성화 + `talk_message` 동의항목
- Vercel env 3개 추가: `KAKAO_REST_API_KEY`, `KAKAO_REDIRECT_URI`, `CRON_SECRET`
- Redeploy → 대시보드 "카카오톡 연결하기" 클릭

### 3️⃣ PWABuilder에서 Package ID 변경 AAB 재생성
**왜**: Package ID `com.dechalkak.app` → `com.autodream.app` 변경. Play Store 업로드 전 유일한 기회.

**어떻게**:
1. https://www.pwabuilder.com 접속
2. URL 입력: `https://restraunt-ebon-phi.vercel.app?v=5` (캐시 우회)
3. Package For Stores → Android → Google Play 탭
4. 옵션:
   - Package ID: **`com.autodream.app`** ⭐
   - App name: `오토드림`
5. "All Settings ▶" 펼치기 → Signing Key: **"New"** 선택
6. Download Package → ZIP 다운로드

**ZIP 안에서 클로드에게 줄 것**:
- `assetlinks.json` 내용 (`public/.well-known/assetlinks.json`에 배포)

**ZIP 안에서 사용자가 보관할 것**:
- `signing.keystore` — Play Store 업데이트 영구 키, 여러 곳 백업 필수
- `signing-key-info.txt` — 비밀번호/alias

### 4️⃣ Google Play 개발자 계정 승인 확인
- Gmail(`jaewonhyeon9@gmail.com`) 편지함에서 Google Play 안내 메일 확인
- 승인 완료 시 → Play Console 앱 등록 진행

### 5️⃣ Play Console에 앱 등록 (승인 후)
필요한 자료:
- **AAB 파일**: PWABuilder에서 받은 `오토드림.aab` (3번 결과물)
- **스크린샷**: 폰에서 앱 주요 화면 2~8장 (최소 2장)
- **고해상도 아이콘**: `play-store-icon-512.png` (이미 있음)
- **피처 그래픽**: https://restraunt-ebon-phi.vercel.app/feature-graphic-1024x500.png
- **앱 설명**: [PLAY_STORE_LISTING.md](./PLAY_STORE_LISTING.md)
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
- **카카오 연동 가이드**: [KAKAO_SETUP.md](./KAKAO_SETUP.md)

### 키스토어 백업 (현재는 구 버전 — dechalkak)
- `C:\Users\Hyun Jae Won\Documents\dechalkak-keystore-backup\`
- `C:\Users\Hyun Jae Won\OneDrive\dechalkak-keystore-backup\`
- `C:\Users\Hyun Jae Won\Desktop\다운로드\dechalkak-v2\`

> ⚠️ 새 Package ID(`com.autodream.app`)로 AAB 생성 후 새 키스토어로 교체됨.
> 새 키스토어 받으면 `autodream-keystore-backup/` 폴더 새로 만들어 백업.

### 마이그레이션 파일 (Supabase에서 실행)
- [prisma/manual-migration-add-checklist-category.sql](./prisma/manual-migration-add-checklist-category.sql) ✅ 실행됨
- [prisma/manual-migration-add-tax-fields.sql](./prisma/manual-migration-add-tax-fields.sql) ✅ 실행됨 (이전 세션 기준)
- [prisma/manual-migration-kakao-integration.sql](./prisma/manual-migration-kakao-integration.sql) ⚠️ **아직 실행 필요**

---

## 💰 수익 모델 (결정 사항)

### Freemium + 월 구독 3-tier (애드센스 대신)
| 티어 | 월 가격 | 포함 |
|-----|--------|------|
| 무료 | 0원 | 체크리스트·출퇴근·직원 3명·OCR 월 30장 |
| Standard | 19,900원 | 무제한 직원·재고·발주·OCR 월 300장·마감 리포트 |
| Pro | 39,900원 | + 매장별 대시보드·POS 연동·OCR 무제한 |

**전환 시점**: 사용자 100명 돌파 후 Standard 티어 론칭.

### 현재 개발 중
- **OCR 월 제한 로직** (Plan enum + OcrUsage 집계) — 유료 플랜 준비용
- **매출 추이 차트** (대시보드) — 7일/30일 탭

---

## 💡 개발 워크플로우 (기억해둘 것)

- **배포 방식**: CLI `vercel deploy` 쓰지 말고 **`git push`만** — 자동 배포됨
- **CLI 배포하면 롤백 위험**: 로컬이 origin/main보다 뒤져 있으면 프로덕션을 과거로 돌림
- **스키마 변경 시**: `prisma/schema.prisma` 수정 → `prisma/manual-migration-*.sql` 파일 생성 → Supabase SQL Editor 수동 실행 (`prisma migrate` 사용 안 함)
- **이미지 생성**: Python + Pillow (시스템에 설치됨, Malgun/MalgunBd 폰트로 한글 렌더링)
- **커밋 메시지 Co-Authored-By 포함** 유지

---

## 🎯 그 외 여유 있을 때

- [ ] 로고 아이콘 전문 디자인 교체 (현재 임시 접시+포크&나이프+셔터링)
- [ ] 앱 온보딩 튜토리얼 (첫 로그인 시 기능 안내)
- [ ] 이용약관 `/terms` 페이지 작성
- [ ] 주문 화면 QR 메뉴 기능
- [ ] PWA 설치 프롬프트 (InstallPrompt 컴포넌트)
- [ ] 커뮤니티 Phase 1: 네이버 카페 or 카톡 오픈채팅방 + 앱 내 링크
- [ ] 커뮤니티 Phase 2: 앱 내 "팁/공지" 섹션 (읽기 전용, 주 1~2회 포스팅)
