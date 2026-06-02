import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveVacationRequestServer } from "@/lib/vacations/approveVacationRequestServer";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function readParams(params: RouteContext["params"]) {
  return await Promise.resolve(params);
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id } = await readParams(context.params);
    const body = await request.json().catch(() => ({}));

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

    let userResult = await supabase.auth.getUser();

    if ((!userResult.data.user || userResult.error) && token) {
      userResult = await supabase.auth.getUser(token);
    }

    const user = userResult.data.user;

    if (!user) {
      return NextResponse.json(
        { error: "Prisijungimas būtinas." },
        { status: 401 },
      );
    }

    const result = await approveVacationRequestServer(supabase, {
      requestId: id,
      actorUserId: user.id,
      substitution: body?.substitution?.substituteUserId
        ? { substituteUserId: body.substitution.substituteUserId }
        : undefined,
      negativeBalance: body?.negativeBalance?.allowNegativeBalance
        ? {
            allowNegativeBalance: true,
            reason: String(body.negativeBalance.reason || ""),
          }
        : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nepavyko patvirtinti prašymo.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}