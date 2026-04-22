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
      className="group relative flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-150"
    >
      {isActive && (
        <span className="absolute -top-px left-1/2 h-0.5 w-10 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-indigo-400" />
      )}
      <span
        className={`text-xl leading-none transition-transform duration-150 ${
          isActive ? 'scale-110' : 'opacity-70 group-hover:opacity-100'
        }`}
      >
        {icon}
      </span>
      <span
        className={`font-medium ${
          isActive ? 'text-slate-100' : 'text-slate-500 group-hover:text-slate-300'
        }`}
      >
        {label}
      </span>
    </Link>
  )
}
