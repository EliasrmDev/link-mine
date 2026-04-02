'use client'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950">
      <p className="text-lg font-semibold text-gray-900 dark:text-white">Something went wrong</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{error.message}</p>
      <button onClick={reset} className="btn-primary">
        Try again
      </button>
    </div>
  )
}
