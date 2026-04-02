'use client'

import { useEffect, useState } from 'react'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent hydration mismatch
  if (!mounted) return <>{children}</>
  return <>{children}</>
}

export function useTheme() {
  const toggle = () => {
    const isDark = document.documentElement.classList.toggle('dark')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }
  const isDark = () =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  return { toggle, isDark }
}
