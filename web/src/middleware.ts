import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth/auth.config";

// Edge runtime: authConfig has no Prisma imports; the `authorized`
// callback redirects unauthenticated requests to pages.signIn (/login).
export default NextAuth(authConfig).auth;

export const config = {
  // `/learn/*` cố ý KHÔNG có ở đây: bài giảng đọc được không cần tài khoản.
  // Các route con ghi tiến độ (exercise, vocab) tự chặn trong page của chúng.
  matcher: [
    "/dashboard/:path*",
    "/ielts/:path*",
    "/listening/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
  ],
};
