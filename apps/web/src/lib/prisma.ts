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
 * Transaction client type used inside withRLS callbacks.
 * Includes all model operations, $queryRaw, and $executeRaw.
 */
export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

/**
 * Execute database operations within a transaction with RLS context set
 * for the specified user. Uses SET LOCAL so the context is scoped to the
 * transaction only — safe with Supabase PgBouncer (transaction pooling).
 *
 * All database access in authenticated routes should go through this helper.
 */
export async function withRLS<T>(
  userId: string,
  fn: (tx: PrismaTx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`
    return fn(tx)
  })
}
