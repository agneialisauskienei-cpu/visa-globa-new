import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function readParams(params: RouteContext["params"]) {
  return await Promise.resolve(params);
}

function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function isAnnualVacation(type?: string | null) {
  return String(type || "").trim().toLowerCase() === "annual_leave";
}

async function recalculateVacationEntitlement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  employeeId: string,
  year: number,
) {
  const { data: rows, error } = await supabase
    .from("vacation_requests")
    .select("status, requested_days, type, start_date")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId);

  if (error) throw error;

  const annualRows = ((rows || []) as Array<{
    status: string | null;
    requested_days: number | null;
    type: string | null;
    start_date: string | null;
  }>).filter((row) => {
    if (!isAnnualVacation(row.type) || !row.start_date) return false;
    return new Date(`${row.start_date}T00:00:00`).getFullYear() === year;
  });

  const usedDays = annualRows
    .filter((row) => normalizeStatus(row.status) === "approved")
    .reduce((sum, row) => sum + Number(row.requested_days || 0), 0);

  const reservedDays = annualRows
    .filter((row) => ["submitted", "pending"].includes(normalizeStatus(row.status)))
    .reduce((sum, row) => sum + Number(row.requested_days || 0), 0);

  const { error: updateError } = await supabase
    .from("vacation_entitlements")
    .update({
      used_days: usedDays,
      reserved_days: reservedDays,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId)
    .eq("year", year);

  if (updateError) throw updateError;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id } = await readParams(context.params);

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

    const { data: vacationRequest, error: requestError } = await supabase
      .from("vacation_requests")
      .select("id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, rejection_reason, created_at")
      .eq("id", id)
      .maybeSingle();

    if (requestError) throw requestError;
    if (!vacationRequest) {
      return NextResponse.json({ error: "Prašymas nerastas." }, { status: 404 });
    }

    if (!["submitted", "pending"].includes(normalizeStatus(vacationRequest.status))) {
      return NextResponse.json(
        { error: "Galima atšaukti tik laukiantį prašymą." },
        { status: 400 },
      );
    }

    const { data: member, error: memberError } = await supabase
      .from("organization_members")
      .select("role, is_active")
      .eq("organization_id", vacationRequest.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) throw memberError;

    const role = String(member?.role || "").toLowerCase();
    const isAdmin = ["owner", "admin", "director", "hr"].includes(role);

    if (!member?.is_active) {
      return NextResponse.json({ error: "Prieiga negalima." }, { status: 403 });
    }

    if (!isAdmin && vacationRequest.employee_id !== user.id) {
      return NextResponse.json(
        { error: "Galite atšaukti tik savo prašymą." },
        { status: 403 },
      );
    }

    const { data: canceledRequest, error: cancelError } = await supabase
      .from("vacation_requests")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, rejection_reason, created_at")
      .maybeSingle();

    if (cancelError) throw cancelError;
    if (!canceledRequest) {
      return NextResponse.json(
        { error: "Prašymo atšaukti nepavyko." },
        { status: 400 },
      );
    }

    if (isAnnualVacation(canceledRequest.type)) {
      const year = new Date(`${canceledRequest.start_date}T00:00:00`).getFullYear();
      await recalculateVacationEntitlement(
        supabase,
        canceledRequest.organization_id,
        canceledRequest.employee_id,
        year,
      );
    }

    return NextResponse.json({
      request: canceledRequest,
      temporaryGrantIds: [],
      substitutionId: null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nepavyko atšaukti prašymo.",
      },
      { status: 400 },
    );
  }
}
