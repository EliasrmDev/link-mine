import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Learn about LinkMine — a bookmark manager built to save, organize, and sync your links effortlessly.',
}

export default function AboutPage() {
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
        <section className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            About <span className="text-brand-600">LinkMine</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Built by developers tired of losing interesting links in a sea of browser bookmarks.
          </p>
        </section>

        {/* Story */}
        <section className="bg-gray-50 py-16 dark:bg-gray-900">
          <div className="mx-auto max-w-3xl px-4">
            <div className="card p-8 space-y-5 text-gray-700 dark:text-gray-300 leading-relaxed">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Our story</h2>
              <p>
                LinkMine started as a personal side project. Like most developers, we had hundreds
                of browser bookmarks scattered across different browsers, devices, and folders —
                none of them organized, most of them never revisited.
              </p>
              <p>
                We wanted something that made saving a link as fast as possible (one click), but
                also gave us a proper way to organize, tag, and search everything from a single
                dashboard.
              </p>
              <p>
                We built LinkMine: a Chrome extension that saves pages instantly paired with a web
                dashboard that syncs in real time across all your devices.
              </p>
              <p>
                It&apos;s free while in beta, and we plan to keep a generous free tier forever.
                Your data is always exportable — no lock-in.
              </p>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16">
          <div className="mx-auto max-w-4xl px-4">
            <h2 className="mb-10 text-center text-3xl font-bold text-gray-900 dark:text-white">
              What we believe in
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  icon: '🚀',
                  title: 'Speed above all',
                  description:
                    'Saving a link should take one click and zero seconds. We optimize every interaction for speed.',
                },
                {
                  icon: '🔓',
                  title: 'Your data, your rules',
                  description:
                    'Export everything at any time. We will never hold your data hostage or make it hard to leave.',
                },
                {
                  icon: '🧘',
                  title: 'No bloat',
                  description:
                    'We only build features that solve real problems. We will not add AI for the sake of it.',
                },
              ].map((v) => (
                <div key={v.title} className="card p-6 text-center">
                  <div className="mb-3 text-3xl" aria-hidden="true">{v.icon}</div>
                  <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">{v.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{v.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tech stack */}
        <section className="bg-gray-50 py-16 dark:bg-gray-900">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Built with</h2>
            <div className="flex flex-wrap gap-3">
              {['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'Tailwind CSS', 'NextAuth.js', 'Chrome Extension API'].map(
                (tech) => (
                  <span
                    key={tech}
                    className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
                  >
                    {tech}
                  </span>
                )
              )}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-brand-600 py-16 text-center text-white">
          <h2 className="mb-4 text-3xl font-bold">Give it a try</h2>
          <p className="mb-8 text-brand-100">Free to use. No credit card required.</p>
          <Link
            href="/login"
            className="btn bg-white text-brand-700 hover:bg-brand-50 px-8 py-3 text-base font-semibold"
          >
            Get Started Free
          </Link>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="flex flex-wrap justify-center gap-4 mb-4">
          <Link href="/features" className="hover:text-brand-600 transition-colors">Features</Link>
          <Link href="/pricing" className="hover:text-brand-600 transition-colors">Pricing</Link>
          <Link href="/privacy" className="hover:text-brand-600 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-brand-600 transition-colors">Terms</Link>
          <Link href="/contact" className="hover:text-brand-600 transition-colors">Contact</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} LinkMine. Built with Next.js &amp; Prisma.</p>
      </footer>
    </div>
  )
}
