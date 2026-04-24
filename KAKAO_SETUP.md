# 카카오톡 마감 리포트 연동 설정 가이드

## 1. Supabase SQL 마이그레이션 실행

1. https://supabase.com/dashboard 접속 → 프로젝트 → **SQL Editor** → New Query
2. [prisma/manual-migration-kakao-integration.sql](./prisma/manual-migration-kakao-integration.sql) 내용 전체 복사 · 붙여넣기
3. **Run** 클릭 (여러 번 실행해도 안전)

---

## 2. 카카오 디벨로퍼 앱 등록

### 2-1. 앱 생성
1. https://developers.kakao.com 접속 → 카카오 계정으로 로그인
2. **내 애플리케이션** → **애플리케이션 추가하기**
   - 앱 이름: `오토드림`
   - 사업자명: 본인 이름 (개인)
   - 카테고리: 기타
3. 생성된 앱 → **요약 정보**에서 **REST API 키** 복사

### 2-2. 플랫폼 등록
**앱 설정 → 플랫폼 → Web 플랫폼 등록**
- 사이트 도메인:
  ```
  https://restraunt-ebon-phi.vercel.app
  ```

### 2-3. 카카오 로그인 활성화
**제품 설정 → 카카오 로그인**
- **카카오 로그인 활성화 설정**: ON
- **OpenID Connect 활성화**: OFF (불필요)
- **Redirect URI 등록**:
  ```
  https://restraunt-ebon-phi.vercel.app/api/auth/kakao/callback
  ```

### 2-4. 동의 항목 설정
**제품 설정 → 카카오 로그인 → 동의항목**
- **닉네임 (profile_nickname)**: 필수 동의
- **카카오톡 메시지 전송 (talk_message)**: 선택 동의 (개인 개발자는 기본 허용)

> ⚠️ **"친구에게 메시지 보내기(friends)"는 비즈 계정 전환 필요 — 본인에게만 보내면 불필요**

---

## 3. Vercel 환경변수 등록

Vercel 대시보드 → 프로젝트 `restraunt` → **Settings → Environment Variables**

| Key | Value | 환경 |
|-----|-------|------|
| `KAKAO_REST_API_KEY` | (2-1에서 복사한 REST API 키) | Production, Preview, Development |
| `KAKAO_REDIRECT_URI` | `https://restraunt-ebon-phi.vercel.app/api/auth/kakao/callback` | Production, Preview |
| `CRON_SECRET` | (아무 랜덤 문자열, 예: `openssl rand -hex 32` 결과) | Production |

저장 후 **Deployments → 최신 배포 → Redeploy** 클릭해서 환경변수 적용.

---

## 4. Vercel Cron 활성화 확인

`vercel.json`의 cron 설정:
```json
{
  "crons": [
    { "path": "/api/cron/daily-report", "schedule": "0 * * * *" }
  ]
}
```
→ **매시간 정각** 실행 → 각 사장의 `sendHour` 설정 시각과 일치할 때만 발송 (한국 시간 기준).

Vercel 대시보드 → 프로젝트 → **Settings → Cron Jobs** 에서 등록된 것 확인.

> 💡 Vercel Hobby 플랜은 cron 월 100회 제한이지만, 매시간 = 월 720회라 **Pro 플랜($20/월) 필요**. 당분간 Hobby면 cron 빈도를 `"0 22 * * *"` (매일 22시 UTC = KST 07시) 한 번으로 줄이고, 발송 시간 선택지를 한정할 수도 있음.

---

## 5. 사용 방법 (사장님 화면)

1. 배포 완료 후 사장 계정으로 로그인
2. **대시보드**에 "💬 카카오톡 마감 리포트" 카드 표시됨
3. **카카오톡 연결하기** 버튼 클릭 → 카카오 로그인 → 자동으로 돌아옴
4. "매일 자동 발송" 토글 ON + 발송 시간 선택
5. **지금 보내기** 버튼으로 즉시 테스트 발송
6. 카카오톡 → 나와의 채팅방 확인

---

## 📝 발송 메시지 예시

```
📊 오토드림 4/25(토) 마감
💰 매출 145만원
💸 지출 62만원
📈 순이익 83만원
👥 근무 3명 22시간30분
✅ 체크리스트 28/30
🛒 대기 발주 1건
📝 메모 2건

[ 상세 리포트 열기 ]
```

버튼을 누르면 앱의 상세 리포트 페이지로 이동.

---

## 🔧 문제 해결

### "not_configured" 에러
→ Vercel 환경변수 (`KAKAO_REST_API_KEY`, `KAKAO_REDIRECT_URI`) 누락. Redeploy 필요.

### "state_mismatch"
→ 쿠키 차단 브라우저 or Safari 프라이빗 모드. 일반 모드에서 재시도.

### "already_sent" (cron 로그)
→ 오늘 이미 발송됨 — 정상 동작 (중복 발송 방지).

### 토큰 만료 오류
→ 로그아웃 후 재연결. refresh token도 만료 (60일 미사용) 시 필요.
