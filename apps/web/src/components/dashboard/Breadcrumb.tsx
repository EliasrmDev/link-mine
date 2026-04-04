'use client'

interface BreadcrumbItem {
  id: string | 'all'
  name: string
}

interface Props {
  hierarchy: BreadcrumbItem[]
  onNavigate: (id: string | 'all') => void
  onBack?: () => void
  className?: string
}

export function Breadcrumb({ hierarchy, onNavigate, onBack, className = '' }: Props) {
  if (hierarchy.length <= 1) return null

  return (
    <nav className={`flex items-center gap-2 ${className}`} aria-label="Breadcrumb">
      {/* Back button for mobile */}
      {onBack && hierarchy.length > 1 && (
        <button
          onClick={onBack}
          className="lg:hidden rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          aria-label="Go back"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Breadcrumb trail */}
      <ol className="flex items-center gap-2 overflow-x-auto">
        {hierarchy.map((item, index) => (
          <li key={item.id} className="flex items-center gap-2 whitespace-nowrap">
            {index > 0 && (
              <svg
                className="h-3 w-3 shrink-0 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}

            {index === hierarchy.length - 1 ? (
              // Current page - not clickable
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {item.name}
              </span>
            ) : (
              // Clickable breadcrumb
              <button
                onClick={() => onNavigate(item.id)}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:underline"
              >
                {item.name}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}