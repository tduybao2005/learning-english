import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import { isAllowedEmail } from "./allowed-emails";

/**
 * Edge-safe NextAuth config shared by middleware.ts (edge runtime) and
 * auth.ts (node). MUST NOT import Prisma/@/lib/db — the Prisma-touching
 * jwt/session callbacks live only in auth.ts.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30d, matches old cookie
  pages: { signIn: "/login" },
  trustHost: true, // behind Cloudflare tunnel / docker
  callbacks: {
    authorized({ auth }) {
      // Xét lại allowlist ở MỌI request, không chỉ lúc đăng nhập: phiên là
      // JWT 30 ngày và không có bảng `Session` để thu hồi, nên nếu chỉ kiểm
      // trong callback `signIn` thì người bị gỡ khỏi `ALLOWED_EMAILS` vẫn
      // dùng tiếp được tới cả tháng. `isAllowedEmail` là hàm thuần đọc biến
      // môi trường nên vẫn chạy được ở edge runtime của middleware.
      const email = auth?.user?.email;
      if (!email) return false;
      return isAllowedEmail(email);
    },
  },
} satisfies NextAuthConfig;
