import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the LinkMine team. We read every message.',
}

export default function ContactPage() {
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
        <section className="mx-auto max-w-2xl px-4 py-20">
          <div className="mb-10 text-center">
            <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Get in <span className="text-brand-600">touch</span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Have a question, found a bug, or want to share feedback? We read every message.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 mb-10">
            <div className="card p-6">
              <div className="mb-3 text-2xl" aria-hidden="true">🐛</div>
              <h2 className="mb-1 font-semibold text-gray-900 dark:text-white">Bug reports</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Found something broken? Open an issue on GitHub and include steps to reproduce.
              </p>
            </div>
            <div className="card p-6">
              <div className="mb-3 text-2xl" aria-hidden="true">💡</div>
              <h2 className="mb-1 font-semibold text-gray-900 dark:text-white">Feature requests</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Have an idea that would make LinkMine better for you? We&apos;d love to hear it.
              </p>
            </div>
            <div className="card p-6">
              <div className="mb-3 text-2xl" aria-hidden="true">🔒</div>
              <h2 className="mb-1 font-semibold text-gray-900 dark:text-white">Security issues</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Please report security vulnerabilities privately via email rather than public issues.
              </p>
            </div>
            <div className="card p-6">
              <div className="mb-3 text-2xl" aria-hidden="true">💬</div>
              <h2 className="mb-1 font-semibold text-gray-900 dark:text-white">General feedback</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Anything else — we&apos;re happy to chat. Send us an email anytime.
              </p>
            </div>
          </div>

          <div className="card p-8 text-center">
            <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">Reach us by email</h2>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              The best way to contact us directly:
            </p>
            <a
              href="mailto:hello@linkmine.eliasrm.dev"
              className="btn-primary text-base px-6 py-2.5"
            >
              hello@linkmine.eliasrm.dev
            </a>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              We typically respond within 2 business days.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="flex flex-wrap justify-center gap-4 mb-4">
          <Link href="/about" className="hover:text-brand-600 transition-colors">About</Link>
          <Link href="/privacy" className="hover:text-brand-600 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-brand-600 transition-colors">Terms</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} LinkMine. Built with Next.js &amp; Prisma.</p>
      </footer>
    </div>
  )
}
