import Link from 'next/link'
import { auth } from '@/lib/auth'

export default async function LandingPage() {
  const session = await auth()

  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/">
            <span className="text-xl font-bold text-brand-400">LinkMine</span>
          </Link>
          <nav className="flex items-center gap-3">
            {session ? (
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
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-24 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <span className="h-2 w-2 rounded-full bg-brand-500"></span>
            Free while in beta
          </div>
          <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            Save the web.
            <br />
            <span className="text-brand-600">Find it later.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            LinkMine is a Chrome extension + web app that lets you bookmark any page in one click,
            organize links into folders, and sync everything across your devices.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href="https://chrome.google.com/webstore"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary py-3 px-6 text-base"
            >
              <ChromeIcon />
              Install Extension
            </a>
            <Link href="/login" className="btn-secondary py-3 px-6 text-base">
              Sign in to Dashboard
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="bg-gray-50 py-20 dark:bg-gray-900">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white">
              Everything you need. Nothing you don&apos;t.
            </h2>
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

        {/* How it works */}
        <section className="py-20">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="mb-12 text-center text-3xl font-bold text-gray-900 dark:text-white">
              How it works
            </h2>
            <ol className="space-y-8">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{step.title}</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-brand-600 py-16 text-center text-white">
          <h2 className="mb-4 text-3xl font-bold">Ready to get organized?</h2>
          <p className="mb-8 text-brand-100">Start saving bookmarks in seconds. Free forever.</p>
          <Link href="/login" className="btn bg-white text-brand-700 hover:bg-brand-50 px-8 py-3 text-base font-semibold">
            Create Free Account
          </Link>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <p>&copy; {new Date().getFullYear()} LinkMine. Built with Next.js &amp; Prisma.</p>
      </footer>
    </div>
  )
}

function ChromeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
    </svg>
  )
}

const FEATURES = [
  {
    icon: '⚡',
    title: 'One-click saving',
    description: 'Save any page instantly from the extension popup. No friction, no forms.',
  },
  {
    icon: '📁',
    title: 'Folder organization',
    description: 'Create folders and sub-folders to organize your links exactly how you want.',
  },
  {
    icon: '🔄',
    title: 'Cross-device sync',
    description: 'Your bookmarks follow you everywhere. Log in once, access from any device.',
  },
  {
    icon: '🔍',
    title: 'Instant search',
    description: 'Find any bookmark in milliseconds by title, URL, or tags.',
  },
  {
    icon: '🏷️',
    title: 'Tags',
    description: 'Add tags to bookmarks for flexible cross-folder organization.',
  },
  {
    icon: '📤',
    title: 'Export anytime',
    description: 'Your data is yours. Export all bookmarks as JSON whenever you want.',
  },
]

const STEPS = [
  {
    title: 'Install the Chrome extension',
    description: 'One click from the Chrome Web Store. No signup required to start saving.',
  },
  {
    title: 'Sign in with Google/Microsoft',
    description: 'Authenticate once to enable sync. We only ask for your email.',
  },
  {
    title: 'Save pages with one click',
    description: 'Click the extension icon on any tab and hit Save. Done.',
  },
  {
    title: 'Organize on the dashboard',
    description: 'Open the web dashboard to create folders, add tags, and search your library.',
  },
]
