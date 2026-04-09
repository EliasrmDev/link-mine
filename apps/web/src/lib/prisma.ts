import { PrismaClient } from '@prisma/client'

// Prevent multiple Prisma Client instances in development (hot reload creates new instances)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// ============================================================================
// ROW LEVEL SECURITY UTILITIES
// ============================================================================

/**
 * Set the current user context for Row Level Security policies.
 * This should be called before any database operations that require user isolation.
 */
export async function setRLSContext(userId: string | null): Promise<void> {
  if (userId) {
    await prisma.$executeRaw`SELECT set_current_user_id(${userId})`
  } else {
    await prisma.$executeRaw`SELECT set_config('app.current_user_id', NULL, false)`
  }
}

/**
 * Execute database operations with RLS context set for a specific user.
 * Automatically cleans up the context after execution.
 */
export async function withRLSContext<T>(
  userId: string,
  operation: () => Promise<T>
): Promise<T> {
  await setRLSContext(userId)
  try {
    return await operation()
  } finally {
    await setRLSContext(null)
  }
}

/**
 * Create a Prisma client instance that automatically sets RLS context
 * for a specific user on every transaction.
 */
export function createUserPrismaClient(userId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          // Set RLS context before the operation
          await setRLSContext(userId)

          try {
            return await query(args)
          } finally {
            // Clean up context after the operation
            await setRLSContext(null)
          }
        },
      },
    },
  })
}

/**
 * Get the current user ID from RLS context.
 * Useful for debugging and verification.
 */
export async function getCurrentRLSUserId(): Promise<string | null> {
  const result = await prisma.$queryRaw<[{ get_current_user_id: string | null }]>`
    SELECT get_current_user_id() as get_current_user_id
  `
  return result[0]?.get_current_user_id || null
}
