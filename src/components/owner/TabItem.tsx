'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface TabItemProps {
  href: string
  label: string
  icon: string
}

export default function TabItem({ href, label, icon }: TabItemProps) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-150 ${
        isActive
          ? 'text-orange-500'
          : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className={`font-medium ${isActive ? 'text-orange-500' : ''}`}>
        {label}
      </span>
    </Link>
  )
}
