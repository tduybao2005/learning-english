import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";

import { db } from "@/lib/db";

export const SESSION_COOKIE_NAME = "session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Browsers silently drop `Secure` cookies on plain-HTTP origins (anything
 * other than `localhost`), including LAN IPs like http://192.168.x.x:3000.
 * Default to secure; opt out explicitly via SESSION_COOKIE_SECURE=false for
 * LAN/plain-HTTP testing (see docker-compose.yml).
 */
const SESSION_COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE !== "false";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Signs a 30-day HS256 JWT for `userId` and sets it as an httpOnly session cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/** Verifies the session cookie's JWT and loads the corresponding User from the DB. */
export async function getSessionUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    const userId = payload.sub;
    if (!userId) return null;
    return await db.user.findUnique({ where: { id: userId } });
  } catch {
    return null;
  }
}

/** Clears the session cookie, logging the user out. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
