import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth/auth.config";

// Edge runtime: authConfig has no Prisma imports; the `authorized`
// callback redirects unauthenticated requests to pages.signIn (/login).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/learn/:path*",
    "/ielts/:path*",
    "/listening/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
  ],
};
