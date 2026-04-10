import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Read the LinkMine terms of service — the rules for using our bookmark manager.',
}

const LAST_UPDATED = 'April 9, 2026'

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="mb-10 text-sm text-gray-500 dark:text-gray-400">
            Last updated: {LAST_UPDATED}
          </p>

          <div className="space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">1. Acceptance of terms</h2>
              <p>
                By creating an account or using LinkMine (&quot;the Service&quot;), you agree to be
                bound by these Terms of Service. If you do not agree, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">2. Description of service</h2>
              <p>
                LinkMine is a bookmark management service that includes a Chrome browser extension
                and a web dashboard. It allows users to save, organize, tag, and sync bookmarks
                across devices.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">3. Account registration</h2>
              <p>
                You must sign in using a valid Google or Microsoft account. You are responsible for
                maintaining the confidentiality of your account and for all activities that occur
                under it. You must provide accurate information and keep it up to date.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">4. Acceptable use</h2>
              <p className="mb-3">You agree not to use LinkMine to:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Save or distribute illegal, harmful, or abusive content.</li>
                <li>Attempt to gain unauthorized access to our systems or other users&apos; data.</li>
                <li>
                  Scrape, crawl, or use automated methods to access the Service beyond normal use.
                </li>
                <li>Violate any applicable laws or regulations.</li>
                <li>Interfere with the integrity or performance of the Service.</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">5. Your content</h2>
              <p>
                You retain ownership of all bookmark data you create. By using the Service, you
                grant us a limited license to store and process your data solely to provide the
                Service. We do not claim any ownership over your bookmarks.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">6. Service availability</h2>
              <p>
                We aim for high availability but do not guarantee uninterrupted access to the
                Service. We may temporarily suspend the Service for maintenance, updates, or
                circumstances beyond our control. We will provide reasonable notice when possible.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">7. Beta disclaimer</h2>
              <p>
                LinkMine is currently in beta. Features may change, be removed, or behave
                unexpectedly. While we take data integrity seriously, we recommend exporting your
                bookmarks regularly during the beta period.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">8. Limitation of liability</h2>
              <p>
                To the maximum extent permitted by law, LinkMine is provided &quot;as is&quot; without
                warranties of any kind. We are not liable for any indirect, incidental, or
                consequential damages arising from your use of the Service.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">9. Termination</h2>
              <p>
                You may delete your account at any time. We reserve the right to suspend or
                terminate accounts that violate these terms. Upon termination, your data will be
                deleted within 30 days.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">10. Changes to terms</h2>
              <p>
                We may update these terms from time to time. We will notify you of material changes
                via email or an in-app notice at least 14 days before they take effect. Continued
                use after the effective date constitutes acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-white">11. Contact</h2>
              <p>
                Questions about these terms?{' '}
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
          <Link href="/privacy" className="hover:text-brand-600 transition-colors">Privacy</Link>
          <Link href="/contact" className="hover:text-brand-600 transition-colors">Contact</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} LinkMine.</p>
      </footer>
    </div>
  )
}
