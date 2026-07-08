import type { User } from "@prisma/client";

import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";

/**
 * Returns the full Prisma User for the current NextAuth session, or null.
 * Same contract as the old cookie-JWT implementation — every page/API
 * call site and answers.test.ts's mock depend on this exact signature.
 */
export async function getSessionUser(): Promise<User | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return db.user.findUnique({ where: { id: userId } });
}
