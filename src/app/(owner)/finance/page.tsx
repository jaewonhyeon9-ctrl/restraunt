import Link from 'next/link'

const MENU_ITEMS = [
  {
    href: '/finance/daily',
    emoji: '📅',
    title: '일별 손익',
    description: '날짜별 매출/지출 확인',
  },
  {
    href: '/finance/monthly',
    emoji: '📈',
    title: '월별 누적',
    description: '월간 손익 분석',
  },
]

export default function FinancePage() {
  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">재무 관리</h1>

      <div className="space-y-3">
        {MENU_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 hover:border-orange-200 hover:shadow-md transition-all"
          >
            <span className="text-3xl">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-400 mt-0.5">{item.description}</p>
            </div>
            <svg
              className="w-5 h-5 text-orange-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
