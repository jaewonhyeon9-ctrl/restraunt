# 오토드림 — 아침에 확인할 요약 ☀️

> 작성: 2026-04-25 새벽 / 잠자기 전 마지막 배포 완료된 상태

---

## ✅ 어제 밤(4-25) 완료한 것

### 1. 대시보드 강화 (사장 화면)
- 직원 성과 카드 이름 클릭 → **`/employees/[id]`** 직원 상세 페이지로 바로 이동
- **사장님께 전달사항** (OWNER_NOTE) 카드 — 최근 7일, 접기/더보기
- **대기 발주 카드 확장** — 품목 상세 펼치기 + 대시보드에서 바로 승인/거절

### 2. 체크리스트 게임화 🎮
- MissionClearToast: +10 XP 토스트, 콤보, **Perfect Day 풀스크린** 연출
- 상단 Lv 배지 + XP 진행바 (월 누적)
- `/api/gamification/me` 엔드포인트

### 3. 마감 리포트 📊
- **`/finance/daily/report`** — 매출/지출/근무/체크리스트/발주/메모 종합
- 카톡/문자 공유 + 복사 버튼
- 대시보드 상단에 그라데이션 CTA 카드

### 4. 카카오톡 자동 발송 💬
- **OAuth 흐름** (`/api/auth/kakao/start` + `/callback`)
- **나에게 보내기** API + 토큰 자동 refresh
- `/api/cron/daily-report` + Vercel Cron
- KakaoIntegrationCard 대시보드 장착
- 카카오 디벨로퍼 앱 등록 + Vercel env 3개 등록 완료

### 5. 유료 플랜 + OCR 한도 🔒
- **Plan enum** (`FREE` / `STANDARD` / `PRO`) + Restaurant.plan
- **OcrUsage** 모델 — 월별 카운터
- 3개 OCR 라우트(`sales`/`expenses`/`suppliers`) 모두 한도 체크 + 실패 시 자동 환불
- OcrUsageCard 대시보드 표시

### 6. 매출 추이 차트 📈
- `/api/dashboard/sales-trend` (7일/30일)
- recharts AreaChart로 매출(sky) + 지출(rose)

### 7. 회원가입 + 사용 가이드 ⭐ 새로 추가
- **`/signup`** — 식당 + OWNER 동시 생성, 자동 로그인 후 대시보드
- **`/guide`** — 사장/직원 기능 + FAQ + 플랜 소개
- 로그인 페이지에 두 링크 + 가입 완료 플래시 메시지

### 8. 카카오 로그인은 보류 (방법 B)
사용자 100명 돌파 후 재검토 결정. 현재는 이메일/비밀번호만.

---

## 🚨 한 가지 알아두실 점 (Vercel Hobby 플랜 제약)

### 카톡 자동 발송 시간 = **매일 밤 11시(KST) 고정**
- Vercel Hobby는 cron을 **하루 1번만** 허용
- 그래서 `vercel.json`을 매시간 → 매일 14:00 UTC (= 23:00 KST)로 변경
- KakaoIntegrationCard에서 시간 선택 드롭다운도 제거됨
- "지금 바로 보내기" 버튼은 시간과 무관하게 동작
- **시간 변경 기능 부활 조건**: Vercel Pro ($20/월) 전환 시 매시간 cron으로 복구 가능

---

## 🌐 라이브 URL 점검

| 페이지 | 상태 |
|------|-----|
| `/login` | ✅ 200 |
| `/signup` | ✅ 200 (신규) |
| `/guide` | ✅ 200 (신규) |
| `/dashboard` | ✅ 사장 로그인 시 표시, OCR/매출추이/카카오 카드 모두 장착 |
| `/finance/daily/report` | ✅ Suspense 래핑으로 빌드 정상 |

**최종 배포 ID**: `dpl_gUZ4wPNFKtYNLjRg11fUwmBuE4qn`  
**커밋**: `2a62917` (Hobby Cron 대응 + UI 정리)

---

## 🛠 마지막 트러블슈팅 기록

1. **빌드 실패** — Next.js 16에서 `useSearchParams()`가 Suspense boundary 필요. `DailyReportInner` + Suspense wrapper로 해결.
2. **Vercel webhook 끊김** — 빈 커밋 푸시로 복구 시도했으나 안 됨. CLI `npx vercel --prod`로 직접 배포 (로컬 = origin/main 동일 확인 후 안전하게 진행).
3. **Hobby Cron 거부** — `0 * * * *`(매시간) 거부됨. `0 14 * * *`(하루 1번)으로 변경.

---

## 🎯 일어나신 후 할 일 (우선순위)

### A. 카카오 연동 실제 테스트 (5분)
1. https://restraunt-ebon-phi.vercel.app/login → 사장 계정 로그인
2. 대시보드 하단 **💬 카카오톡 마감 리포트** 카드에서 "카카오톡 연결하기"
3. 카카오 동의 → 다시 대시보드로
4. **"지금 보내기"** 클릭 → 본인 카톡 → 나와의 채팅에서 리포트 확인

만약 안 되면 [KAKAO_SETUP.md](./KAKAO_SETUP.md) 5단계(동의항목) 재확인.

### B. PWABuilder AAB 재생성 — Play Store 진행
[NEXT_STEPS.md](./NEXT_STEPS.md) 3번 항목 참고.
- URL: `https://restraunt-ebon-phi.vercel.app?v=6` (캐시 우회)
- Package ID: `com.autodream.app`

### C. 회원가입 흐름 새 식당 만들어서 테스트
직접 만들어보고 어색한 UX 있으면 알려주세요.

### D. (여유 있을 때) 가이드 페이지 텍스트 검토
[/guide](https://restraunt-ebon-phi.vercel.app/guide) 들어가서 본인이 보기에 어색한 표현 있으면 수정 요청.

---

## 📝 git 커밋 히스토리 (오늘 밤)

```
2a62917 fix: Vercel Hobby Cron 제한 대응 (매일 23:00 KST 고정)
cbb25f3 chore: trigger vercel webhook
71b22d7 feat: 사장님 회원가입 + 사용 가이드 페이지
a83679a fix: 리포트 페이지 useSearchParams Suspense 래핑
090fcfe chore: trigger redeploy for Kakao env vars
65bf5e1 feat: 유료 플랜 기반 OCR 월 한도 + 매출 추이 차트
be2cdf2 feat: 카카오톡 마감 리포트 자동 발송 연동
9d99902 feat: 마감 리포트 + 체크리스트 게임화 + 대시보드 강화
```

---

푹 주무세요 😴 잘 자고 일어나서 카톡 한 번만 발송 테스트 해주시면 모든 기능 작동 확인 끝납니다.
