import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

type VacationRequestRow = {
  id: string;
  organization_id: string;
  employee_id: string;
  type: string | null;
  start_date: string;
  end_date: string;
  status: string;
  requested_days: number | null;
  note: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

async function readParams(params: RouteContext["params"]) {
  return await Promise.resolve(params);
}

function isAnnualVacation(type?: string | null) {
  return String(type || "").trim().toLowerCase() === "annual_leave";
}

async function getAuthenticatedUser(request: Request, supabase: Awaited<ReturnType<typeof createClient>>) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

  let userResult = await supabase.auth.getUser();

  if ((!userResult.data.user || userResult.error) && token) {
    userResult = await supabase.auth.getUser(token);
  }

  return userResult.data.user || null;
}

async function recalculateVacationEntitlement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  request: VacationRequestRow,
) {
  if (!isAnnualVacation(request.type)) return;

  const year = new Date(`${request.start_date}T00:00:00`).getFullYear();

  await supabase.from("vacation_entitlements").upsert(
    {
      organization_id: request.organization_id,
      employee_id: request.employee_id,
      year,
      annual_days: 30,
      carried_over_days: 0,
      used_days: 0,
      reserved_days: 0,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "organization_id,employee_id,year",
      ignoreDuplicates: true,
    },
  );

  const { data: rows, error: rowsError } = await supabase
    .from("vacation_requests")
    .select("status, requested_days, type, start_date")
    .eq("organization_id", request.organization_id)
    .eq("employee_id", request.employee_id);

  if (rowsError) throw rowsError;

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
    .filter((row) => row.status === "approved")
    .reduce((sum, row) => sum + Number(row.requested_days || 0), 0);

  const reservedDays = annualRows
    .filter((row) => row.status === "submitted" || row.status === "pending")
    .reduce((sum, row) => sum + Number(row.requested_days || 0), 0);

  const { error: entitlementError } = await supabase
    .from("vacation_entitlements")
    .update({
      used_days: usedDays,
      reserved_days: reservedDays,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", request.organization_id)
    .eq("employee_id", request.employee_id)
    .eq("year", year);

  if (entitlementError) throw entitlementError;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { id } = await readParams(context.params);
    const user = await getAuthenticatedUser(request, supabase);

    if (!user) {
      return NextResponse.json(
        { error: "Prisijungimas būtinas." },
        { status: 401 },
      );
    }

    const { data: currentRequest, error: currentError } = await supabase
      .from("vacation_requests")
      .select(
        "id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, created_at, updated_at",
      )
      .eq("id", id)
      .maybeSingle();

    if (currentError) throw currentError;
    if (!currentRequest) throw new Error("Prašymas nerastas.");

    const existing = currentRequest as VacationRequestRow;

    const { data: membership, error: membershipError } = await supabase
      .from("organization_members")
      .select("role, is_active")
      .eq("organization_id", existing.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) throw membershipError;

    const role = String(membership?.role || "").toLowerCase();
    const isAdmin = ["owner", "admin"].includes(role);
    const ownsRequest = existing.employee_id === user.id;

    if (!membership?.is_active || (!isAdmin && !ownsRequest)) {
      throw new Error("Galite atšaukti tik savo laukiantį prašymą.");
    }

    if (!["submitted", "pending"].includes(existing.status)) {
      throw new Error("Galima atšaukti tik laukiantį prašymą.");
    }

    const { data: canceledRequest, error: cancelError } = await supabase
      .from("vacation_requests")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("organization_id", existing.organization_id)
      .in("status", ["submitted", "pending"])
      .select(
        "id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, created_at, updated_at",
      )
      .maybeSingle();

    if (cancelError) throw cancelError;
    if (!canceledRequest) throw new Error("Prašymo atšaukti nepavyko.");

    await recalculateVacationEntitlement(supabase, canceledRequest as VacationRequestRow);

    return NextResponse.json({ request: canceledRequest });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nepavyko atšaukti prašymo.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
