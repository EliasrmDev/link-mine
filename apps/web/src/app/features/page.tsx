import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Explore all LinkMine features: one-click saving, folder organization, cross-device sync, tags, search, and more.',
}

const FEATURES = [
  {
    icon: '⚡',
    title: 'One-click saving',
    description:
      'Save any page instantly from the Chrome extension popup. No friction, no forms — just click and done.',
  },
  {
    icon: '📁',
    title: 'Folder organization',
    description:
      'Create nested folders and sub-folders to organize your links exactly how you want. Unlimited depth.',
  },
  {
    icon: '🔄',
    title: 'Cross-device sync',
    description:
      'Your bookmarks follow you everywhere. Log in once and access your full library from any device.',
  },
  {
    icon: '🔍',
    title: 'Instant search',
    description:
      'Find any bookmark in milliseconds by title, URL, or tags. No waiting, no loading.',
  },
  {
    icon: '🏷️',
    title: 'Tags',
    description:
      'Add tags to bookmarks for flexible cross-folder organization. Filter quickly by any tag.',
  },
  {
    icon: '📤',
    title: 'Export anytime',
    description:
      'Your data is yours. Export all bookmarks as JSON whenever you want. No lock-in.',
  },
  {
    icon: '🎨',
    title: 'Custom icons',
    description:
      'Assign custom icons to folders and tags to make your library instantly recognizable.',
  },
  {
    icon: '📌',
    title: 'Presets',
    description:
      'Save and reuse bookmark configurations. Apply presets to quickly categorize new links.',
  },
  {
    icon: '🔒',
    title: 'Secure by default',
    description:
      'All data is stored securely. Authentication via Google and Microsoft OAuth — no passwords.',
  },
]

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/">
            <span className="text-xl font-bold text-brand-400">LinkMine</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary">Sign in</Link>
            <Link href="/login" className="btn-primary">Get Started Free</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-4 py-20 text-center">
          <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Everything you need to manage{' '}
            <span className="text-brand-600">your bookmarks</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            LinkMine combines a lightning-fast browser extension with a powerful web dashboard so
            you never lose an interesting link again.
          </p>
        </section>

        {/* Features grid */}
        <section className="bg-gray-50 py-16 dark:bg-gray-900">
          <div className="mx-auto max-w-6xl px-4">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="card p-6">
                  <div className="mb-4 text-3xl" aria-hidden="true">{f.icon}</div>
                  <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">{f.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-brand-600 py-16 text-center text-white">
          <h2 className="mb-4 text-3xl font-bold">Start using LinkMine for free</h2>
          <p className="mb-8 text-brand-100">No credit card required. Free while in beta.</p>
          <Link
            href="/login"
            className="btn bg-white text-brand-700 hover:bg-brand-50 px-8 py-3 text-base font-semibold"
          >
            Create Free Account
          </Link>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="flex flex-wrap justify-center gap-4 mb-4">
          <Link href="/about" className="hover:text-brand-600 transition-colors">About</Link>
          <Link href="/privacy" className="hover:text-brand-600 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-brand-600 transition-colors">Terms</Link>
          <Link href="/contact" className="hover:text-brand-600 transition-colors">Contact</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} LinkMine. Built with Next.js &amp; Prisma.</p>
      </footer>
    </div>
  )
}
