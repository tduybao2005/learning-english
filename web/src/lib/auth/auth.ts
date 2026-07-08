import NextAuth from "next-auth";

import { authConfig } from "./auth.config";
import { upsertUserByEmail } from "./upsert-user";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, profile }) {
      // `profile` is only present on the sign-in request — upsert once,
      // then the userId rides the JWT for the session's lifetime.
      if (profile?.email) {
        const user = await upsertUserByEmail(profile.email, profile.name);
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.userId === "string") {
        session.user.id = token.userId;
      }
      return session;
    },
  },
});
