import { NextResponse } from "next/server";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

type PatchBody = {
  type?: string;
  start_date?: string;
  end_date?: string;
  note?: string | null;
};

async function readParams(params: RouteContext["params"]) {
  return await Promise.resolve(params);
}

function createRequestClient(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization =
    request.headers.get("authorization") ||
    request.headers.get("Authorization") ||
    "";

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Trūksta Supabase URL arba publishable/anon key.");
  }

  return createSupabaseClient(supabaseUrl, supabaseKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or service role key.");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDate(value?: string | null) {
  const date = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function isAnnualVacation(type?: string | null) {
  return String(type || "").trim().toLowerCase() === "annual_leave";
}

function isTemporaryVacation(type?: string | null) {
  return String(type || "").trim().toLowerCase() === "temporary_leave";
}

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lithuanianEasterDate(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isLithuanianPublicHoliday(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const fixed = new Set([
    "1-1",
    "2-16",
    "3-11",
    "5-1",
    "6-24",
    "7-6",
    "8-15",
    "11-1",
    "11-2",
    "12-24",
    "12-25",
    "12-26",
  ]);

  if (fixed.has(`${month}-${day}`)) return true;

  const easter = lithuanianEasterDate(year);
  const easterMonday = addDays(easter, 1);
  const mothersDay = new Date(year, 4, 1);
  mothersDay.setDate(1 + ((7 - mothersDay.getDay()) % 7));
  const fathersDay = new Date(year, 5, 1);
  fathersDay.setDate(1 + ((7 - fathersDay.getDay()) % 7));

  return [easter, easterMonday, mothersDay, fathersDay].some(
    (holiday) => toDateInput(holiday) === toDateInput(date),
  );
}

function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6 && !isLithuanianPublicHoliday(date);
}

function businessDaysBetween(start: string, end: string) {
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  let count = 0;

  while (!Number.isNaN(cursor.getTime()) && cursor <= last) {
    if (isBusinessDay(cursor)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

async function recalculateVacationEntitlement(
  supabase: SupabaseClient,
  organizationId: string,
  employeeId: string,
  years: number[],
) {
  const { data: rows, error } = await supabase
    .from("vacation_requests")
    .select("status, requested_days, type, start_date, end_date")
    .eq("organization_id", organizationId)
    .eq("employee_id", employeeId);

  if (error) throw error;

  for (const year of Array.from(new Set(years.filter(Boolean)))) {
    const annualRows = ((rows || []) as Array<{
      status: string | null;
      requested_days: number | null;
      type: string | null;
      start_date: string | null;
      end_date: string | null;
    }>).filter((row) => {
      if (!isAnnualVacation(row.type) || !row.start_date) return false;
      return new Date(`${row.start_date}T00:00:00`).getFullYear() === year;
    });

    const usedDays = annualRows
      .filter((row) => normalizeStatus(row.status) === "approved")
      .reduce((sum, row) => sum + businessDaysBetween(row.start_date || "", row.end_date || row.start_date || ""), 0);

    const reservedDays = annualRows
      .filter((row) => ["submitted", "pending"].includes(normalizeStatus(row.status)))
      .reduce((sum, row) => sum + businessDaysBetween(row.start_date || "", row.end_date || row.start_date || ""), 0);

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
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const supabase = createAdminClient();
    const { id } = await readParams(context.params);
    const body = (await request.json()) as PatchBody;

    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("Authorization") ||
      "";
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

    let userResult = await supabase.auth.getUser();

    if ((!userResult.data.user || userResult.error) && token) {
      userResult = await supabase.auth.getUser(token);
    }

    const user = userResult.data.user;

    if (!user) {
      return NextResponse.json({ error: "Prisijungimas būtinas." }, { status: 401 });
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
        { error: "Galima redaguoti tik nepatvirtintą prašymą." },
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
        { error: "Galite redaguoti tik savo prašymą." },
        { status: 403 },
      );
    }

    const type = String(body.type || vacationRequest.type || "annual_leave").trim();
    const startDate = normalizeDate(body.start_date || vacationRequest.start_date);
    const endDate = isTemporaryVacation(type)
      ? startDate
      : normalizeDate(body.end_date || vacationRequest.end_date);

    if (!startDate || !endDate || endDate < startDate) {
      return NextResponse.json(
        { error: "Nurodykite teisingą pradžios ir pabaigos datą." },
        { status: 400 },
      );
    }

    const requestedDays = isTemporaryVacation(type)
      ? 0
      : businessDaysBetween(startDate, endDate);

    if (isAnnualVacation(type) && requestedDays < 1) {
      return NextResponse.json(
        { error: "Pasirinktame laikotarpyje nėra darbo dienų." },
        { status: 400 },
      );
    }

    const updatePayload = {
      type,
      start_date: startDate,
      end_date: endDate,
      requested_days: requestedDays,
      note: String(body.note || "").trim() || null,
    };

    let updateResult = await supabase
      .from("vacation_requests")
      .update({
        ...updatePayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, rejection_reason, created_at")
      .maybeSingle();

    if (
      updateResult.error &&
      String(updateResult.error.message || "").toLowerCase().includes("updated_at")
    ) {
      updateResult = await supabase
        .from("vacation_requests")
        .update(updatePayload)
        .eq("id", id)
        .select("id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, rejection_reason, created_at")
        .maybeSingle();
    }

    const { data: updatedRequest, error: updateError } = updateResult;

    if (updateError) throw updateError;
    if (!updatedRequest) {
      return NextResponse.json({ error: "Prašymo atnaujinti nepavyko." }, { status: 400 });
    }

    const previousYear = new Date(`${vacationRequest.start_date}T00:00:00`).getFullYear();
    const nextYear = new Date(`${startDate}T00:00:00`).getFullYear();

    if (isAnnualVacation(vacationRequest.type) || isAnnualVacation(type)) {
      await recalculateVacationEntitlement(
        supabase,
        vacationRequest.organization_id,
        vacationRequest.employee_id,
        [previousYear, nextYear],
      );
    }

    return NextResponse.json({ request: updatedRequest });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Nepavyko atnaujinti prašymo.",
      },
      { status: 400 },
    );
  }
}
