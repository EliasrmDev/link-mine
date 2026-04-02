export default function DashboardLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600"
        aria-label="Loading dashboard"
        role="status"
      />
    </div>
  )
}
