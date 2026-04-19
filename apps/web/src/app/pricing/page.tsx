import { Metadata } from 'next'
import Link from 'next/link'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'LinkMine is free while in beta. Explore our simple and transparent pricing plans.',
}

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    badge: 'Current plan',
    badgeColor: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    description: 'Everything you need to get started. Free while in beta.',
    features: [
      'Unlimited bookmarks',
      'Unlimited folders',
      'Tags & custom icons',
      'Chrome extension',
      'Cross-device sync',
      'JSON export',
      'Presets',
    ],
    cta: 'Get Started Free',
    ctaClass: 'btn-primary w-full justify-center py-2.5',
    featured: true,
  },
  {
    name: 'Pro',
    price: 'Coming soon',
    period: '',
    badge: 'Upcoming',
    badgeColor: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
    description: 'Advanced features for power users — details announced after beta.',
    features: [
      'Everything in Free',
      'Priority support',
      'Advanced search filters',
      'API access',
      'Team sharing',
      'More to be announced',
    ],
    cta: 'Join Waitlist',
    ctaClass: 'btn-secondary w-full justify-center py-2.5',
    featured: false,
  },
]

export default function PricingPage() {
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
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            Free while in beta
          </div>
          <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Simple, transparent{' '}
            <span className="text-brand-600">pricing</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            LinkMine is completely free during the beta period. No credit card needed.
          </p>
        </section>

        {/* Plans */}
        <section className="mx-auto max-w-4xl px-4 pb-20">
          <div className="grid gap-6 sm:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`card p-8 flex flex-col ${plan.featured ? 'ring-2 ring-brand-500' : ''}`}
              >
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${plan.badgeColor}`}>
                      {plan.badge}
                    </span>
                  </div>
                  <div className="mb-2">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="ml-1 text-gray-500 dark:text-gray-400">/ {plan.period}</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{plan.description}</p>
                </div>

                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="text-brand-500" aria-hidden="true">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link href="/login" className={plan.ctaClass}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="bg-gray-50 py-16 dark:bg-gray-900">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="mb-10 text-center text-3xl font-bold text-gray-900 dark:text-white">
              Frequently asked questions
            </h2>
            <div className="space-y-6">
              {[
                {
                  q: 'Is LinkMine really free?',
                  a: 'Yes. During the beta period, all features are completely free. We\'ll give users advance notice before any paid plans are introduced.',
                },
                {
                  q: 'What happens after beta?',
                  a: 'We plan to keep a generous free tier. Existing beta users will receive special pricing. You\'ll never lose your data.',
                },
                {
                  q: 'Can I export my data?',
                  a: 'Absolutely. You can export all your bookmarks as JSON at any time from the dashboard. Your data is yours.',
                },
                {
                  q: 'Do I need a credit card?',
                  a: 'No credit card is required to sign up or use LinkMine during the beta period.',
                },
              ].map(({ q, a }) => (
                <div key={q} className="card p-5">
                  <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">{q}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{a}</p>
                </div>
              ))}
            </div>
          </div>
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
