import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { approveVacationRequestServer } from "@/lib/vacations/approveVacationRequestServer";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function readParams(params: RouteContext["params"]) {
  return await Promise.resolve(params);
}

export async function POST(
  request: Request,
  context: RouteContext,
) {
  try {
    const supabase = await createClient();

    const { id } = await readParams(context.params);

    const body = await request.json().catch(() => ({}));

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Prisijungimas būtinas." },
        { status: 401 },
      );
    }

    const result = await approveVacationRequestServer(supabase, {
      requestId: id,
      actorUserId: user.id,
      substitution: body?.substitution?.substituteUserId
        ? {
            substituteUserId:
              body.substitution.substituteUserId,
          }
        : undefined,
      negativeBalance: body?.negativeBalance?.allowNegativeBalance
        ? {
            allowNegativeBalance: true,
            reason: String(
              body.negativeBalance.reason || "",
            ),
          }
        : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nepavyko patvirtinti prašymo.",
      },
      { status: 400 },
    );
  }
}
