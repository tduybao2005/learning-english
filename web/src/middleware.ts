import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Edge runtime constraint: this file must ONLY import `jose`. No Prisma, no
// nodemailer, no `@/lib/db` — session validity is checked by verifying the
// JWT signature statelessly, without hitting the database.

export const SESSION_COOKIE_NAME = "session";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

async function hasValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = await hasValidSession(token);

  if (!valid) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

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
