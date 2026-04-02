import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: {
    default: 'SavePath — Save and organize your bookmarks',
    template: '%s | SavePath',
  },
  description:
    'SavePath lets you save, organize, and sync bookmarks across all your devices with a simple Chrome extension.',
  openGraph: {
    title: 'SavePath',
    description: 'Save and organize your bookmarks. Sync across devices.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('theme')
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
                  const isDark = stored === 'dark' || (!stored && prefersDark)
                  if (isDark) {
                    document.documentElement.classList.add('dark')
                  }
                } catch {}
              })()
            `,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
