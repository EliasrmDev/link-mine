import { DefaultSession } from 'next-auth'

// Extend the built-in session types so `session.user.id` is typed
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}
