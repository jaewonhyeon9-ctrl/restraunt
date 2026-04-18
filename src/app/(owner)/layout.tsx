import TabItem from '@/components/owner/TabItem'
import OwnerHeader from '@/components/owner/OwnerHeader'

const TAB_ITEMS = [
  { href: '/dashboard', label: '대시보드', icon: '📊' },
  { href: '/finance', label: '재무', icon: '💰' },
  { href: '/employees', label: '직원', icon: '👥' },
  { href: '/inventory', label: '재고', icon: '📦' },
  { href: '/suppliers', label: '거래처', icon: '🏪' },
]

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OwnerHeader />

      {/* 메인 콘텐츠 영역 (하단 탭바 높이만큼 패딩) */}
      <main className="flex-1 pb-20 max-w-md mx-auto w-full">
        {children}
      </main>

      {/* 하단 탭바 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="max-w-md mx-auto flex items-stretch h-16">
          {TAB_ITEMS.map((item) => (
            <TabItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </div>
      </nav>
    </div>
  )
}
