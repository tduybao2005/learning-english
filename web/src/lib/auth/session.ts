import type { User } from "@prisma/client";

import { auth } from "@/lib/auth/auth";
import { isAllowedEmail } from "@/lib/auth/allowed-emails";
import { db } from "@/lib/db";

/**
 * Returns the full Prisma User for the current NextAuth session, or null.
 * Same contract as the old cookie-JWT implementation — every page/API
 * call site and answers.test.ts's mock depend on this exact signature.
 *
 * Cũng xét lại allowlist ở đây chứ không chỉ ở middleware: `middleware.ts`
 * chỉ chạy trên các route trong `config.matcher` (toàn trang), KHÔNG chạy cho
 * `/api/*`. Thiếu bước này thì một phiên JWT cũ vẫn gọi API đọc/ghi dữ liệu
 * được sau khi chủ nhân đã bị gỡ khỏi `ALLOWED_EMAILS`.
 */
export async function getSessionUser(): Promise<User | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await db.user.findUnique({ where: { id: userId } });
  if (user === null || !isAllowedEmail(user.email)) return null;
  return user;
}
