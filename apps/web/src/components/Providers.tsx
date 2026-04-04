'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from './ThemeProvider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={5 * 60} // refetch session every 5 minutes
      refetchOnWindowFocus={true}
      basePath="/api/auth"
    >
      <ThemeProvider>{children}</ThemeProvider>
    </SessionProvider>
  )
}
