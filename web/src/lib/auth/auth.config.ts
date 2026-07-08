import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

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
      return !!auth?.user; // middleware: redirect to /login when false
    },
  },
} satisfies NextAuthConfig;
