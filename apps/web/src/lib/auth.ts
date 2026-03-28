import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import MicrosoftEntraId from 'next-auth/providers/microsoft-entra-id'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // Uncomment to enable Microsoft login:
    // MicrosoftEntraId({
    //   clientId: process.env.MICROSOFT_CLIENT_ID!,
    //   clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
    //   tenantId: 'common',
    // }),
  ],
  session: {
    // JWT strategy: session data is in a signed cookie, not in DB.
    // Faster reads, works well with extension auth (no DB lookup per request).
    strategy: 'jwt',
  },
  callbacks: {
    jwt({ token, user }) {
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
})
