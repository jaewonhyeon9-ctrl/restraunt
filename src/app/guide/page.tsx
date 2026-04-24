import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '사용 가이드 · 오토드림',
  description:
    '오토드림 사용법 — 식당 운영 자동화 PWA (체크리스트/매출/발주/영수증 OCR/카카오 리포트)',
}

interface Section {
  id: string
  icon: string
  title: string
  desc: string
  steps: string[]
  tip?: string
}

const OWNER_SECTIONS: Section[] = [
  {
    id: 'signup',
    icon: '🎉',
    title: '1. 회원가입 & 첫 세팅',
    desc: '사장 계정 하나로 식당이 만들어집니다.',
    steps: [
      '로그인 화면에서 "사장님 회원가입" 클릭',
      '식당 이름 · 사장님 이름 · 이메일 · 비밀번호 입력',
      '가입 즉시 대시보드로 자동 로그인',
      '직원 탭에서 "+ 직원 추가"로 직원 계정 만들어 배포',
    ],
    tip: '식당 이름은 가입 후에도 수정 가능하니 편하게 입력하세요.',
  },
  {
    id: 'dashboard',
    icon: '📊',
    title: '2. 대시보드 한눈에 보기',
    desc: '매일 접속 시 오늘의 상태가 한 화면에 요약됩니다.',
    steps: [
      '오늘 매출/지출/순이익 카드 (탭하면 상세)',
      '매출 추이 7일/30일 라인 차트',
      '대기 중 발주 신청 → 바로 승인/거절',
      '사장님께 전달사항 (직원이 보낸 최근 7일)',
      '직원 업무 성과율 → 이름 클릭 시 직원 상세',
    ],
  },
  {
    id: 'checklist',
    icon: '✅',
    title: '3. 체크리스트 등록 & 관리',
    desc: '주방/서빙 체크리스트를 만들면 직원에게 자동 배포됩니다.',
    steps: [
      '대시보드 "체크리스트 관리" 클릭',
      '주방/서빙 선택 → 제목 · 시간 · 설명 입력',
      '또는 엑셀 업로드 (샘플 다운로드 제공)',
      '직원은 자동으로 자기 화면에서 체크 가능',
      '체크 시 XP 적립 + 미션 클리어 연출 (동기부여)',
    ],
    tip: '엑셀 컬럼은 "시간 / 구분 / 항목 / 체크리스트" 자유 조합 가능',
  },
  {
    id: 'sales',
    icon: '💰',
    title: '4. 매출 입력 (4가지 방법)',
    desc: '편한 방법으로 입력하세요 — 데이터는 모두 같은 일자에 합산됩니다.',
    steps: [
      '직접 입력: 재무 → 일별 손익 → "매출 추가"',
      '엑셀 업로드: 일별 매출 CSV/엑셀 일괄 업로드',
      'POS 마감 화면 사진: "📷 POS 화면 사진으로 자동 입력"',
      '배달앱 정산 화면 사진: 자동으로 배달 매출만 병합',
    ],
    tip: '같은 날 여러 번 입력하면 배달/카드/현금별로 누적됩니다',
  },
  {
    id: 'expense',
    icon: '📸',
    title: '5. 영수증 1장으로 지출+재고',
    desc: '영수증 사진 1장 → 지출 등록 + 재고 자동 입고 동시 진행.',
    steps: [
      '대시보드 상단 "📸 영수증 촬영" CTA 클릭',
      '영수증 촬영 또는 사진 선택',
      '품목/수량/금액 자동 인식 → 확인 후 저장',
      '거래처 자동 등록 + 재고 증가 + 지출 기록 한번에',
    ],
    tip: '무료 플랜은 월 30회, Standard 월 300회 OCR 사용 가능',
  },
  {
    id: 'order',
    icon: '🛒',
    title: '6. 발주 신청 & 승인',
    desc: '직원이 신청 → 사장이 승인 → 자동 알림.',
    steps: [
      '직원 화면: 재고 낮은 항목 보고 "발주 신청"',
      '사장 대시보드: 대기 발주 카드에서 품목까지 확인',
      '승인/거절 버튼으로 즉시 처리',
      '승인 시 직원에게 자동 알림',
    ],
  },
  {
    id: 'report',
    icon: '📋',
    title: '7. 마감 리포트 + 카톡 자동 발송',
    desc: '매일 밤 오늘의 상황을 카톡으로 받으세요.',
    steps: [
      '대시보드 "📊 오늘 마감 리포트" 카드 클릭',
      '매출/지출/순이익/근무/체크리스트/발주/메모 종합',
      '"📤 공유하기"로 카톡/문자 바로 공유',
      '대시보드 카카오톡 카드에서 "카카오톡 연결하기" → 자동 발송 토글',
      '매일 설정한 시간에 카톡으로 자동 발송',
    ],
    tip: '카카오 연결은 1회만 하면 60일마다 자동 갱신됩니다',
  },
  {
    id: 'attendance',
    icon: '👥',
    title: '8. 직원 & 출퇴근 관리',
    desc: 'GPS 기반 출퇴근 + 자동 급여 계산.',
    steps: [
      '직원 탭 → "+ 직원 추가" (이름/이메일/비밀번호 설정)',
      '시급 또는 월급 설정',
      '직원은 식당 위치 50m 이내에서 자동 출근 가능',
      '근무 시간 자동 집계 → 월 급여 자동 계산',
      '직원 이름 클릭 시 상세 성과 · 출퇴근 이력',
    ],
  },
]

const EMPLOYEE_SECTIONS: Section[] = [
  {
    id: 'emp-clock',
    icon: '🕐',
    title: '출퇴근 체크',
    desc: '매일 근무 시작/종료 시 1회 클릭.',
    steps: [
      '홈 화면에서 "출근하기" 버튼 클릭 (GPS 확인)',
      '근무 끝나면 "퇴근하기" 클릭',
      '자동으로 근무 시간 · 일급 계산',
    ],
  },
  {
    id: 'emp-checklist',
    icon: '✅',
    title: '체크리스트 체크',
    desc: '사장이 등록한 체크리스트를 시간대별로 체크.',
    steps: [
      '체크리스트 탭 이동',
      '주방 / 서빙 탭 선택',
      '항목 탭해서 완료 처리 → +10 XP · 미션 클리어 연출',
      '이번달 총 레벨은 상단 Lv 배지로 확인',
    ],
    tip: '연속으로 체크하면 콤보 보너스! 카테고리 전체 100% 시 Perfect Day',
  },
  {
    id: 'emp-note',
    icon: '📝',
    title: '일일 메모 작성',
    desc: '다음 타임 / 사장님 / 고객 컴플레인 전달.',
    steps: [
      '체크리스트 페이지 하단 메모 섹션',
      '4가지 타입 중 선택 (전달/특이/사장님께/컴플레인)',
      '내용 입력 후 저장',
      '사장님은 대시보드에서 즉시 확인',
    ],
  },
]

const FAQ: { q: string; a: string }[] = [
  {
    q: '비밀번호를 잊어버렸어요',
    a: '현재는 사장 계정이 직원 비밀번호를 재설정해줄 수 있습니다. 사장님은 관리자 문의.',
  },
  {
    q: 'OCR이 "월 한도 초과"로 안 돼요',
    a: '무료 30회 / Standard 300회 / Pro 무제한. 플랜 업그레이드 또는 다음달 자동 리셋 대기.',
  },
  {
    q: '카카오톡 리포트가 안 와요',
    a: '대시보드 카카오 카드에서 "자동 발송 ON" 확인. 해제됐거나 60일 미사용이면 재연결 필요.',
  },
  {
    q: '직원이 GPS 밖에서도 출근 찍게 할 수 있나요?',
    a: '사장 대시보드 "식당 위치 설정"에서 GPS 반경 조정 가능 (기본 50m).',
  },
  {
    q: '데이터 백업은 어떻게 되나요?',
    a: 'Supabase 클라우드에 자동 백업됩니다. 계정만 잃지 않으면 안전합니다.',
  },
]

function SectionCard({ s }: { s: Section }) {
  return (
    <section id={s.id} className="glass-card p-5 scroll-mt-24">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-100">{s.title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
        </div>
      </div>
      <ol className="space-y-1.5 text-sm text-slate-200 ml-1">
        {s.steps.map((step, i) => (
          <li key={i} className="flex gap-2">
            <span className="inline-flex shrink-0 w-5 h-5 items-center justify-center text-[10px] font-bold rounded-full bg-indigo-500/30 text-indigo-200">
              {i + 1}
            </span>
            <span className="leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
      {s.tip && (
        <p className="mt-3 text-[11px] text-amber-300/90 bg-amber-400/5 ring-1 ring-amber-400/20 rounded-lg px-3 py-2">
          💡 {s.tip}
        </p>
      )}
    </section>
  )
}

export default function GuidePage() {
  return (
    <div className="min-h-screen px-4 py-8 pb-16 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-xl overflow-hidden ring-1 ring-white/10">
          <Image
            src="/icon-512.png"
            alt="오토드림"
            width={48}
            height={48}
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            User Guide
          </p>
          <h1 className="text-xl font-bold text-slate-100">오토드림 사용법</h1>
        </div>
      </div>

      {/* Hero */}
      <div className="ai-border mb-6">
        <div className="ai-border-inner p-5">
          <h2 className="text-lg font-bold text-slate-100 mb-2">
            꿈꾸던 식당 운영, 자동으로
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            오토드림은 **체크리스트·출퇴근·매출/지출·재고·발주·영수증 OCR·카톡 마감 리포트**를
            한 앱에 묶은 식당 운영 PWA입니다.
          </p>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            사장 계정 1개로 시작 → 직원 초대 → 10분이면 첫날 운영 데이터가 쌓입니다.
          </p>
          <div className="flex gap-2 mt-4">
            <Link href="/signup" className="btn-primary flex-1 text-sm">
              지금 가입
            </Link>
            <Link
              href="/login"
              className="btn-ghost flex-1 text-sm text-center py-3 rounded-2xl"
            >
              로그인
            </Link>
          </div>
        </div>
      </div>

      {/* TOC */}
      <nav className="mb-6 rounded-2xl bg-white/5 ring-1 ring-white/5 p-4">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
          목차
        </p>
        <ul className="text-sm space-y-1">
          {OWNER_SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-slate-300 hover:text-indigo-300 transition-colors"
              >
                {s.icon} {s.title}
              </a>
            </li>
          ))}
          <li className="pt-2 mt-2 border-t border-white/5">
            <a
              href="#employee"
              className="text-slate-300 hover:text-indigo-300 transition-colors font-semibold"
            >
              👷 직원용 기능
            </a>
          </li>
          <li>
            <a
              href="#faq"
              className="text-slate-300 hover:text-indigo-300 transition-colors font-semibold"
            >
              ❓ 자주 묻는 질문
            </a>
          </li>
        </ul>
      </nav>

      {/* Owner sections */}
      <div className="space-y-4">
        <h2 className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-1">
          사장님 기능
        </h2>
        {OWNER_SECTIONS.map((s) => (
          <SectionCard key={s.id} s={s} />
        ))}
      </div>

      {/* Employee sections */}
      <div id="employee" className="scroll-mt-24 mt-10 space-y-4">
        <h2 className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold px-1">
          직원용 기능
        </h2>
        {EMPLOYEE_SECTIONS.map((s) => (
          <SectionCard key={s.id} s={s} />
        ))}
      </div>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 mt-10">
        <h2 className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3 px-1">
          자주 묻는 질문
        </h2>
        <div className="space-y-2">
          {FAQ.map((f, i) => (
            <details
              key={i}
              className="group rounded-xl bg-white/5 ring-1 ring-white/5 px-4 py-3"
            >
              <summary className="cursor-pointer text-sm font-semibold text-slate-100 flex items-center justify-between">
                <span>{f.q}</span>
                <span className="text-slate-500 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <p className="mt-2 text-xs text-slate-400 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Plan tier summary */}
      <section className="mt-10">
        <h2 className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-3 px-1">
          플랜 (출시 예정)
        </h2>
        <div className="space-y-2">
          <div className="rounded-xl bg-slate-500/10 ring-1 ring-slate-400/20 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-slate-200">무료</h3>
              <span className="text-base font-bold text-slate-300">0원/월</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              체크리스트·출퇴근·직원 3명·OCR 월 30장
            </p>
          </div>
          <div className="rounded-xl bg-indigo-500/10 ring-1 ring-indigo-400/30 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-indigo-200">Standard</h3>
              <span className="text-base font-bold text-indigo-300">
                19,900원/월
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              무제한 직원·재고·발주·OCR 월 300장·카톡 리포트
            </p>
          </div>
          <div className="rounded-xl bg-amber-500/10 ring-1 ring-amber-400/30 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-bold text-amber-200">Pro</h3>
              <span className="text-base font-bold text-amber-300">
                39,900원/월
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              + 매장별 대시보드·POS 연동·OCR 무제한
            </p>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-3 px-1">
          ⓘ 플랜 결제는 출시 예정입니다. 현재는 모두 무료로 체험 가능합니다.
        </p>
      </section>

      {/* CTA footer */}
      <div className="mt-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 ring-1 ring-indigo-400/30 p-6 text-center">
        <p className="text-sm text-slate-300 mb-4">
          아직 궁금한 게 있으신가요?
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <Link href="/signup" className="btn-primary text-sm">
            사장님 회원가입
          </Link>
          <Link href="/login" className="btn-ghost text-sm py-3 px-5 rounded-2xl">
            로그인
          </Link>
        </div>
      </div>

      <p className="text-center text-[11px] text-slate-600 mt-8">
        © 오토드림 · 식당 운영 자동화 PWA
      </p>
    </div>
  )
}
