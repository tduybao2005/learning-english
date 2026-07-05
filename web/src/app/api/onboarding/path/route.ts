import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

const pathSchema = z.discriminatedUnion("goalType", [
  z.object({
    goalType: z.literal("IELTS"),
    goalValue: z.enum(["5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0"]),
  }),
  z.object({
    goalType: z.literal("CEFR"),
    goalValue: z.enum(["A1", "A2", "B1", "B2", "C1"]),
  }),
]);

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = pathSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const { goalType, goalValue } = parsed.data;

  await db.user.update({
    where: { id: user.id },
    data: { goalType, goalValue },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
