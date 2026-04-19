import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...(process.env.AUTH_MICROSOFT_ENTRA_ID_ID ? [
      MicrosoftEntraID({
        clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
        issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      }),
    ] : []),
  ],
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    // JWT strategy: session data is in a signed cookie, not in DB.
    // Faster reads, works well with extension auth (no DB lookup per request).
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production' ? '.eliasrm.dev' : undefined,
      },
    },
  },
  callbacks: {
    async signIn({ user, account, profile: _profile }) {
      try {
        // For OAuth providers, check if user with same email exists
        if (account?.provider === 'google' || account?.provider === 'microsoft-entra-id') {
          if (user?.email) {
            // Check if user already exists with this email
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email },
              include: { accounts: true }
            })

            // If user exists, allow sign in (this enables account linking)
            if (existingUser) {
              console.log(`Account linking: ${account.provider} account for existing user ${user.email}`)
              return true
            }
          }
          return true
        }
        return true
      } catch (error) {
        console.error('SignIn error:', error)
        // Allow sign in to continue, let the adapter handle issues
        return true
      }
    },
    jwt({ token, user, account: _account }) {
      // Persist the DB user ID into the JWT on first sign-in
      if (user?.id) token.id = user.id
      return token
    },
    session({ session, token }) {
      // Expose user ID to client via session
      if (token.id) session.user.id = token.id as string
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  debug: process.env.NODE_ENV === 'development' && process.env.AUTH_DEBUG !== 'false',
})
