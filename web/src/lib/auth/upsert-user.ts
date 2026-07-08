import { db } from "@/lib/db";

/**
 * Finds-or-creates the app User for a Google sign-in, keyed by email —
 * preserves the old OTP flow's upsert-by-email semantics. `update: {}` so a
 * returning user's edited profile name is never clobbered by Google's.
 */
export async function upsertUserByEmail(
  email: string,
  name?: string | null
): Promise<{ id: string }> {
  return db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: name ?? null },
    select: { id: true },
  });
}
