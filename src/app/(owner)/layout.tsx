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
    <div className="min-h-screen flex flex-col">
      <OwnerHeader />

      <main className="flex-1 pb-24 max-w-md mx-auto w-full">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-[rgba(7,9,14,0.72)] backdrop-blur-xl">
        <div className="mx-auto max-w-md flex items-stretch h-16 pb-[env(safe-area-inset-bottom)]">
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
