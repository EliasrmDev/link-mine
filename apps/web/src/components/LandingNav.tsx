'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'

export function LandingNav() {
  const { data: session, status } = useSession()

  return (
    <nav className="flex items-center gap-3">
      {status === 'loading' ? (
        <span className="h-10 w-28 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      ) : session ? (
        <Link href="/dashboard" className="btn-primary">
          Open Dashboard
        </Link>
      ) : (
        <>
          <Link href="/login" className="btn-secondary">
            Sign in
          </Link>
          <Link href="/login" className="btn-primary">
            Get Started Free
          </Link>
        </>
      )}
    </nav>
  )
}
