import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/Providers'
import { StructuredData } from './structured-data'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  metadataBase: new URL('https://linkmine.eliasrm.dev'),
  title: {
    default: 'LinkMine — Save, Organize & Sync Your Bookmarks Across All Devices',
    template: '%s | LinkMine',
  },
  description:
    'Save, organize, and sync bookmarks effortlessly across all your devices. LinkMine Chrome extension + web dashboard makes bookmark management simple and powerful. Free while in beta.',
  keywords: [
    'bookmark manager',
    'save bookmarks',
    'organize bookmarks',
    'sync bookmarks',
    'chrome extension',
    'bookmark sync',
    'web bookmarks',
    'bookmark organizer',
    'cross device sync',
    'bookmark dashboard',
    'save links',
    'link manager',
    'bookmark tool',
    'productivity',
    'web app'
  ],
  authors: [{ name: 'LinkMine Team' }],
  creator: 'LinkMine',
  publisher: 'LinkMine',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  category: 'productivity',
  classification: 'Business',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://linkmine.eliasrm.dev',
    siteName: 'LinkMine',
    title: 'LinkMine — Save, Organize & Sync Your Bookmarks Across All Devices',
    description:
      'Save, organize, and sync bookmarks effortlessly across all your devices. LinkMine Chrome extension + web dashboard makes bookmark management simple and powerful.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'LinkMine - Bookmark Manager',
        type: 'image/png',
      },
      {
        url: '/og-image-square.png',
        width: 1080,
        height: 1080,
        alt: 'LinkMine - Save and Organize Bookmarks',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@linkmine_app',
    creator: '@linkmine_app',
    title: 'LinkMine — Save, Organize & Sync Your Bookmarks Across All Devices',
    description:
      'Save, organize, and sync bookmarks effortlessly across all your devices. Chrome extension + web dashboard.',
    images: [
      {
        url: '/twitter-image.png',
        width: 1200,
        height: 600,
        alt: 'LinkMine - Bookmark Manager',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
    other: {
      'msvalidate.01': process.env.BING_VERIFICATION || '',
    },
  },
  alternates: {
    canonical: 'https://linkmine.eliasrm.dev',
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#3b82f6',
      },
    ],
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'LinkMine',
    'application-name': 'LinkMine',
    'mobile-web-app-capable': 'yes',
    'msapplication-TileColor': '#3b82f6',
    'msapplication-config': '/browserconfig.xml',
    'theme-color': '#ffffff',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <StructuredData type="WebSite" />
        <StructuredData type="Organization" />
        <StructuredData type="WebApplication" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
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
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-S2XNY93GLB"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-S2XNY93GLB');
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
