import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth, signIn } from '@/lib/auth'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; from?: string; error?: string }>
}) {
  const session = await auth()
  const params = await searchParams

  if (session) {
    redirect(params.callbackUrl ?? '/dashboard')
  }

  const isFromExtension = params.from === 'extension'
  const error = params.error

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="card p-8">
          <div className="mb-6 text-center">
            <span className="text-2xl font-bold text-brand-600">SavePath</span>
            <h1 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
              {isFromExtension ? 'Connect your extension' : 'Sign in to your account'}
            </h1>
            {isFromExtension && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Sign in once to sync your bookmarks across devices
              </p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400"
            >
              {error === 'OAuthCallback'
                ? 'There was a problem with the sign-in. Please try again.'
                : 'Something went wrong. Please try again.'}
            </div>
          )}

          <form
            action={async () => {
              'use server'
              await signIn('google', {
                redirectTo: params.callbackUrl ?? '/dashboard',
              })
            }}
          >
            <button type="submit" className="btn-primary w-full py-2.5">
              <GoogleIcon />
              Continue with Google
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
            By signing in you agree to our{' '}
            <a href="#" className="underline hover:text-gray-700 dark:hover:text-gray-300">
              Terms of Service
            </a>
            .
          </p>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <a href="/" className="hover:text-gray-700 dark:hover:text-gray-300">
            &larr; Back to home
          </a>
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
