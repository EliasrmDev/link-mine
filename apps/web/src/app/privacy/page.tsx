import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'LinkMine privacy policy — how we collect, use, and protect your data.',
}

const LAST_UPDATED = 'April 9, 2026'

export default function PrivacyPage() {
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
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Privacy Policy
          </h1>
          <p className="mb-10 text-sm text-gray-500 dark:text-gray-400">
            Last updated: {LAST_UPDATED}
          </p>

          <div className="space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">1. Overview</h2>
              <p>
                LinkMine (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) respects your privacy. This policy explains what
                data we collect, how we use it, and the choices you have. By using LinkMine, you
                agree to the practices described here.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">2. Data we collect</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>
                  <strong>Account information:</strong> Your name and email address, provided via
                  Google or Microsoft OAuth. We never store your password.
                </li>
                <li>
                  <strong>Bookmark data:</strong> URLs, page titles, notes, tags, and folder
                  structure that you save through the extension or dashboard.
                </li>
                <li>
                  <strong>Usage data:</strong> Basic analytics about feature usage to help us
                  improve the product (no cross-site tracking).
                </li>
                <li>
                  <strong>Technical data:</strong> IP address, browser type, and device type for
                  security and debugging purposes.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">3. How we use your data</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>To provide, operate, and sync your bookmarks across devices.</li>
                <li>To authenticate you securely via OAuth.</li>
                <li>To improve the reliability and performance of the service.</li>
                <li>To contact you about important changes to the service (no marketing spam).</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">4. Data sharing</h2>
              <p>
                We do not sell, rent, or share your personal data with third parties for advertising
                purposes. We may share data with infrastructure providers (e.g., hosting, database)
                strictly to operate the service, under agreements that protect your privacy.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">5. Data retention</h2>
              <p>
                Your data is retained as long as your account is active. You may delete your account
                and all associated data at any time from the dashboard settings. We will permanently
                delete your data within 30 days of account deletion.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">6. Security</h2>
              <p>
                We use industry-standard security practices including HTTPS encryption, hashed
                tokens, and row-level security on the database. No system is 100% secure, but we
                take the protection of your data seriously.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">7. Your rights</h2>
              <p>
                You have the right to access, export, correct, or delete your data at any time.
                Use the export feature in the dashboard or contact us at{' '}
                <a
                  href="mailto:hello@linkmine.eliasrm.dev"
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  hello@linkmine.eliasrm.dev
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">8. Cookies</h2>
              <p>
                We use session cookies strictly for authentication. We do not use third-party
                tracking cookies or advertising cookies.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">9. Changes to this policy</h2>
              <p>
                We may update this policy from time to time. If changes are material, we will
                notify you by email or via a banner in the dashboard before the changes take effect.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">10. Contact</h2>
              <p>
                Questions about this policy?{' '}
                <a
                  href="mailto:hello@linkmine.eliasrm.dev"
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  hello@linkmine.eliasrm.dev
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 py-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
        <div className="flex flex-wrap justify-center gap-4 mb-4">
          <Link href="/about" className="hover:text-brand-600 transition-colors">About</Link>
          <Link href="/terms" className="hover:text-brand-600 transition-colors">Terms</Link>
          <Link href="/contact" className="hover:text-brand-600 transition-colors">Contact</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} LinkMine.</p>
      </footer>
    </div>
  )
}
