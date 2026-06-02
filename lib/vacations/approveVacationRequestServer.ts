import type { SupabaseClient } from "@supabase/supabase-js";

export type ApproveVacationRequestInput = {
  requestId: string;
  actorUserId: string;
  substitution?: {
    substituteUserId: string;
  };
  negativeBalance?: {
    allowNegativeBalance: true;
    reason: string;
  };
};

export type ApproveVacationRequestResult = {
  request: Record<string, unknown>;
  substitutionId: string | null;
  temporaryGrantIds: string[];
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

function assertUuidLike(value: string, label: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error(`${label} turi būti UUID.`);
  }
}

function normalizeReason(value?: string | null) {
  const reason = String(value || "").trim();

  if (reason.length < 8) {
    throw new Error(
      "Minusiniam atostogų likučiui būtina aiški priežastis, bent 8 simboliai.",
    );
  }

  return reason;
}

function isAnnualVacation(type?: string | null) {
  return String(type || "").trim().toLowerCase() === "annual_leave";
}

async function ensureVacationEntitlement(
  supabase: SupabaseClient,
  request: VacationRequestRow,
  year: number,
) {
  const { error } = await supabase.from("vacation_entitlements").upsert(
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

  if (error) throw error;
}

async function recalculateVacationEntitlement(
  supabase: SupabaseClient,
  request: VacationRequestRow,
) {
  if (!isAnnualVacation(request.type)) return;

  const year = new Date(`${request.start_date}T00:00:00`).getFullYear();

  await ensureVacationEntitlement(supabase, request, year);

  const { data: requests, error: requestsError } = await supabase
    .from("vacation_requests")
    .select("status, requested_days, type, start_date")
    .eq("organization_id", request.organization_id)
    .eq("employee_id", request.employee_id);

  if (requestsError) throw requestsError;

  const rows = (requests || []) as Array<{
    status: string | null;
    requested_days: number | null;
    type: string | null;
    start_date: string | null;
  }>;

  const sameYearAnnual = rows.filter((row) => {
    if (!isAnnualVacation(row.type) || !row.start_date) return false;
    return new Date(`${row.start_date}T00:00:00`).getFullYear() === year;
  });

  const usedDays = sameYearAnnual
    .filter((row) => row.status === "approved")
    .reduce((sum, row) => sum + Number(row.requested_days || 0), 0);

  const reservedDays = sameYearAnnual
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

async function fallbackApproveVacationRequest(
  supabase: SupabaseClient,
  input: ApproveVacationRequestInput,
  negativeBalanceReason: string | null,
): Promise<ApproveVacationRequestResult> {
  const { data: request, error: requestError } = await supabase
    .from("vacation_requests")
    .select(
      "id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, created_at, updated_at",
    )
    .eq("id", input.requestId)
    .maybeSingle();

  if (requestError) throw requestError;
  if (!request) throw new Error("Prašymas nerastas.");

  const currentRequest = request as VacationRequestRow;

  const { data: member, error: memberError } = await supabase
    .from("organization_members")
    .select("role, is_active")
    .eq("organization_id", currentRequest.organization_id)
    .eq("user_id", input.actorUserId)
    .maybeSingle();

  if (memberError) throw memberError;

  const role = String(member?.role || "").toLowerCase();

  if (!member?.is_active || !["owner", "admin"].includes(role)) {
    throw new Error("Neturite teisės patvirtinti šio prašymo.");
  }

  if (currentRequest.status === "approved") {
    await recalculateVacationEntitlement(supabase, currentRequest);

    return {
      request: currentRequest,
      substitutionId: null,
      temporaryGrantIds: [],
    };
  }

  if (!["submitted", "pending"].includes(currentRequest.status)) {
    throw new Error("Galima patvirtinti tik pateiktą arba laukiantį prašymą.");
  }

  if (isAnnualVacation(currentRequest.type)) {
    const year = new Date(`${currentRequest.start_date}T00:00:00`).getFullYear();

    await ensureVacationEntitlement(supabase, currentRequest, year);

    const { data: entitlement } = await supabase
      .from("vacation_entitlements")
      .select("remaining_days")
      .eq("organization_id", currentRequest.organization_id)
      .eq("employee_id", currentRequest.employee_id)
      .eq("year", year)
      .maybeSingle();

    const remainingDays = Number(entitlement?.remaining_days ?? 30);
    const requestedDays = Number(currentRequest.requested_days || 0);

    if (remainingDays < requestedDays && !negativeBalanceReason) {
      throw new Error("Nepakanka atostogų likučio.");
    }
  }

  const { data: approvedRequest, error: approveError } = await supabase
    .from("vacation_requests")
    .update({
      status: "approved",
      updated_at: new Date().toISOString(),
    })
    .eq("id", currentRequest.id)
    .select(
      "id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, created_at, updated_at",
    )
    .maybeSingle();

  if (approveError) throw approveError;
  if (!approvedRequest) throw new Error("Prašymo statusas DB nepasikeitė.");

  const savedRequest = approvedRequest as VacationRequestRow;

  await recalculateVacationEntitlement(supabase, savedRequest);

  let substitutionId: string | null = null;

  if (input.substitution?.substituteUserId) {
    const { data: substitution, error: substitutionError } = await supabase
      .from("employee_substitutions")
      .insert({
        organization_id: savedRequest.organization_id,
        absent_user_id: savedRequest.employee_id,
        substitute_user_id: input.substitution.substituteUserId,
        source_vacation_request_id: savedRequest.id,
        status: "active",
        starts_on: savedRequest.start_date,
        ends_on: savedRequest.end_date,
        reason: "Pavadavimas patvirtinto neatvykimo laikotarpiui.",
        created_by: input.actorUserId,
        activated_at: new Date().toISOString(),
        activated_by: input.actorUserId,
      })
      .select("id")
      .maybeSingle();

    if (substitutionError) throw substitutionError;
    substitutionId = substitution?.id || null;
  }

  return {
    request: savedRequest,
    substitutionId,
    temporaryGrantIds: [],
  };
}

export async function approveVacationRequestServer(
  supabase: SupabaseClient,
  input: ApproveVacationRequestInput,
): Promise<ApproveVacationRequestResult> {
  assertUuidLike(input.requestId, "requestId");
  assertUuidLike(input.actorUserId, "actorUserId");

  const substituteUserId = input.substitution?.substituteUserId || null;
  if (substituteUserId) assertUuidLike(substituteUserId, "substituteUserId");

  const negativeBalanceReason = input.negativeBalance?.allowNegativeBalance
    ? normalizeReason(input.negativeBalance.reason)
    : null;

  const { data, error } = await supabase.rpc(
    "approve_vacation_request_transaction",
    {
      p_request_id: input.requestId,
      p_actor_user_id: input.actorUserId,
      p_substitute_user_id: substituteUserId,
      p_negative_balance_reason: negativeBalanceReason,
    },
  );

  if (!error && data) {
    return data as ApproveVacationRequestResult;
  }

  return fallbackApproveVacationRequest(supabase, input, negativeBalanceReason);
}
