import { redirect } from "next/navigation";

/** Root route `/` is unauthenticated (not in `middleware.ts`'s matcher), so it
 * can't check session validity itself — it just hands off to `/dashboard`,
 * which IS in the matcher and will bounce signed-out visitors to `/login`.
 * This replaces the leftover create-next-app scaffold page that shipped
 * through every prior task. */
export default function RootPage() {
  redirect("/dashboard");
}
