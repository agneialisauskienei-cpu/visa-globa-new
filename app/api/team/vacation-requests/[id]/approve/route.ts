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

type OrganizationMemberRow = {
  id?: string | null;
  user_id?: string | null;
  role?: string | null;
  legacy_role?: string | null;
  is_active?: boolean | null;
  position?: string | null;
  department?: string | null;
  staff_type?: string | null;
  position_id?: string | null;
  department_id?: string | null;
  staffing_group_id?: string | null;
  termination_date?: string | null;
  employment_start_date?: string | null;
  extra_permissions?: unknown;
};

type VacationEntitlementRow = {
  remaining_days?: number | string | null;
  annual_days?: number | string | null;
  entitlement_days?: number | string | null;
  days?: number | string | null;
  carried_over_days?: number | string | null;
  used_days?: number | string | null;
  reserved_days?: number | string | null;
  is_active?: boolean | null;
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
  const reason = String(value || "").trim().replace(/\s+/g, " ");

  if (reason.length < 8) {
    throw new Error(
      "Minusiniam atostogų likučiui būtina aiški priežastis, bent 8 simboliai.",
    );
  }

  return reason;
}

function normalizeStatus(value?: string | null) {
  const raw = String(value || "").trim().toLowerCase();
  if (["approved", "confirmed", "patvirtinta"].includes(raw)) return "approved";
  if (["submitted", "pending", "laukia", "pateikta"].includes(raw)) return raw === "pending" || raw === "laukia" ? "pending" : "submitted";
  if (["rejected", "cancelled", "canceled", "atmesta", "atšaukta"].includes(raw)) return "rejected";
  return raw;
}

function isAnnualVacation(type?: string | null) {
  return String(type || "").trim().toLowerCase() === "annual_leave";
}

function isTemporaryLeave(type?: string | null) {
  const normalized = String(type || "").trim().toLowerCase();
  return normalized === "temporary_leave" || normalized === "short_leave";
}

function parseNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function dateRangesOverlap(
  aStart?: string | null,
  aEnd?: string | null,
  bStart?: string | null,
  bEnd?: string | null,
) {
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

function normalizeExtraPermissions(value: unknown) {
  if (!value) return [] as string[];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    } catch {
      return [];
    }
  }
  return [];
}

function isHrApprover(member?: OrganizationMemberRow | null) {
  if (!member?.is_active) return false;
  const role = String(member.role || member.legacy_role || "").toLowerCase();
  const permissions = normalizeExtraPermissions(member.extra_permissions);

  return (
    ["owner", "admin", "director", "hr"].includes(role) ||
    permissions.includes("employees.view_sensitive") ||
    permissions.includes("vacation_requests.approve")
  );
}

function canApproveNegativeBalance(member?: OrganizationMemberRow | null) {
  if (!member?.is_active) return false;
  const role = String(member.role || member.legacy_role || "").toLowerCase();
  const permissions = normalizeExtraPermissions(member.extra_permissions);

  return (
    ["owner", "admin", "director", "hr"].includes(role) ||
    permissions.includes("vacation_requests.allow_negative_balance")
  );
}

function staffingGroupKey(member?: OrganizationMemberRow | null) {
  if (!member) return "";
  return (
    String(member.staffing_group_id || "").trim() ||
    String(member.position_id || "").trim() ||
    [member.department_id, member.position, member.staff_type, member.department]
      .filter(Boolean)
      .join("|")
      .toLowerCase()
      .trim()
  );
}

function isMemberActiveDuringRequest(member: OrganizationMemberRow, request: VacationRequestRow) {
  const startsAfterRequest =
    member.employment_start_date && member.employment_start_date > request.end_date;
  const endedBeforeRequest =
    member.termination_date && member.termination_date < request.start_date;

  return member.is_active !== false && !startsAfterRequest && !endedBeforeRequest;
}

async function ensureVacationEntitlement(
  supabase: SupabaseClient,
  request: VacationRequestRow,
  year: number,
) {
  const { data, error } = await supabase
    .from("vacation_entitlements")
    .select("remaining_days, annual_days, entitlement_days, days, carried_over_days, used_days, reserved_days, is_active")
    .eq("organization_id", request.organization_id)
    .eq("employee_id", request.employee_id)
    .eq("year", year)
    .maybeSingle();

  if (error) throw error;
  if (!data || (data as VacationEntitlementRow).is_active === false) {
    throw new Error(
      "Darbuotojui nėra aktyvaus atostogų likučio įrašo DB. Patvirtinimas sustabdytas.",
    );
  }

  const row = data as VacationEntitlementRow;
  const annualDays =
    parseNumber(row.annual_days) ??
    parseNumber(row.entitlement_days) ??
    parseNumber(row.days);

  if (annualDays === null || annualDays <= 0) {
    throw new Error("Darbuotojui nėra DB atostogų normos. Patvirtinimas sustabdytas.");
  }

  return row;
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
    .filter((row) => normalizeStatus(row.status) === "approved")
    .reduce((sum, row) => sum + Number(row.requested_days || 0), 0);

  const reservedDays = sameYearAnnual
    .filter((row) => ["submitted", "pending"].includes(normalizeStatus(row.status)))
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

async function loadMember(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "id, user_id, role, legacy_role, is_active, position, department, staff_type, position_id, department_id, staffing_group_id, termination_date, employment_start_date, extra_permissions",
    )
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as OrganizationMemberRow | null;
}

async function assertNoExistingApprovedSubstitution(
  supabase: SupabaseClient,
  request: VacationRequestRow,
) {
  const { data, error } = await supabase
    .from("employee_substitutions")
    .select("id")
    .eq("organization_id", request.organization_id)
    .eq("source_vacation_request_id", request.id)
    .limit(1);

  if (error) {
    // If the table does not exist yet, the actual insert below will also fail with a clearer error.
    return;
  }

  if ((data || []).length > 0) {
    throw new Error("Šiam prašymui pavadavimas jau sukurtas.");
  }
}

async function assertNoScheduleConflict(
  supabase: SupabaseClient,
  request: VacationRequestRow,
) {
  if (isTemporaryLeave(request.type)) return;

  const { data, error } = await supabase
    .from("work_schedule_entries")
    .select("id, date, start_datetime, end_datetime, status")
    .eq("organization_id", request.organization_id)
    .eq("employee_id", request.employee_id)
    .gte("date", request.start_date)
    .lte("date", request.end_date)
    .limit(1);

  if (error) {
    // Different installations may not have this table yet. RPC remains the preferred path.
    return;
  }

  const conflict = (data || []).find((entry: any) => {
    const status = String(entry.status || "").toLowerCase();
    if (status.startsWith("absence_")) return false;
    if (["off", "free", "poilsis", "laisva", "holiday", "svente", "šventė"].includes(status)) return false;
    return Boolean(entry.start_datetime && entry.end_datetime) || ["work", "p", "d", "dirba"].includes(status);
  });

  if (conflict) {
    throw new Error(
      "Darbuotojas turi darbo grafiko įrašą šiam laikotarpiui. Pirmiausia išspręskite grafiko konfliktą.",
    );
  }
}

async function assertSubstituteIsValid(
  supabase: SupabaseClient,
  request: VacationRequestRow,
  substituteUserId: string,
) {
  if (substituteUserId === request.employee_id) {
    throw new Error("Darbuotojas negali pavaduoti pats savęs.");
  }

  const [absentMember, substituteMember] = await Promise.all([
    loadMember(supabase, request.organization_id, request.employee_id),
    loadMember(supabase, request.organization_id, substituteUserId),
  ]);

  if (!absentMember) throw new Error("Neaptiktas neatvykstančio darbuotojo įrašas organizacijoje.");
  if (!substituteMember) throw new Error("Pasirinktas pavaduotojas nerastas organizacijoje.");

  if (!isMemberActiveDuringRequest(substituteMember, request)) {
    throw new Error("Pasirinktas pavaduotojas tuo laikotarpiu nėra aktyvus darbuotojas.");
  }

  const absentGroup = staffingGroupKey(absentMember);
  const substituteGroup = staffingGroupKey(substituteMember);

  if (!absentGroup || !substituteGroup || absentGroup !== substituteGroup) {
    throw new Error("Pavaduotojas turi būti iš tos pačios pareigybės / personalo grupės.");
  }

  const { data: overlappingRequests, error: overlapError } = await supabase
    .from("vacation_requests")
    .select("id, status, type, start_date, end_date")
    .eq("organization_id", request.organization_id)
    .eq("employee_id", substituteUserId)
    .neq("status", "rejected")
    .lte("start_date", request.end_date)
    .gte("end_date", request.start_date)
    .limit(1);

  if (overlapError) throw overlapError;

  const hasOverlap = (overlappingRequests || []).some((row: any) => {
    if (row.id === request.id) return false;
    if (normalizeStatus(row.status) === "rejected") return false;
    if (isTemporaryLeave(row.type)) return false;
    return dateRangesOverlap(request.start_date, request.end_date, row.start_date, row.end_date);
  });

  if (hasOverlap) {
    throw new Error("Pasirinktas pavaduotojas tuo laikotarpiu pats turi neatvykimą.");
  }
}

async function insertAuditEvent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    actorUserId: string;
    action: string;
    tableName: string;
    recordId: string;
    changes: Record<string, unknown>;
  },
) {
  const payload = {
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId,
    user_id: input.actorUserId,
    action: input.action,
    table_name: input.tableName,
    record_id: input.recordId,
    changes: input.changes,
    created_at: new Date().toISOString(),
  };

  const first = await supabase.from("audit_log").insert(payload);
  if (!first.error) return;

  const second = await supabase.from("audit_logs").insert(payload);
  if (!second.error) return;

  // Do not silently approve without at least trying to write audit. If both common tables fail,
  // keep approval working only when RPC handled the transaction before this fallback.
  throw new Error(
    `Prašymas patvirtintas tikrinimo metu negali būti tęsiamas: audit_log įrašyti nepavyko (${first.error.message || second.error.message}).`,
  );
}

async function insertTemporaryPermissionGrant(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    substituteUserId: string;
    absentUserId: string;
    sourceRequestId: string;
    startsOn: string;
    endsOn: string;
    actorUserId: string;
  },
) {
  const payload = {
    organization_id: input.organizationId,
    user_id: input.substituteUserId,
    substitute_user_id: input.substituteUserId,
    absent_user_id: input.absentUserId,
    source_vacation_request_id: input.sourceRequestId,
    permission: "temporary_substitution",
    permissions: ["temporary_substitution"],
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    valid_from: input.startsOn,
    valid_until: input.endsOn,
    status: "active",
    created_by: input.actorUserId,
    created_at: new Date().toISOString(),
  };

  const result = await supabase
    .from("temporary_permission_grants")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (result.error) {
    // Some deployments do not yet have a dedicated temporary grants table.
    // The substitution row is still date-bounded and server-validated; RPC should be used for full permission fan-out.
    return null;
  }

  return String(result.data?.id || "") || null;
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
  const actorMember = await loadMember(
    supabase,
    currentRequest.organization_id,
    input.actorUserId,
  );

  if (!isHrApprover(actorMember)) {
    throw new Error("Neturite teisės patvirtinti šio prašymo.");
  }

  if (normalizeStatus(currentRequest.status) === "approved") {
    await recalculateVacationEntitlement(supabase, currentRequest);

    return {
      request: currentRequest,
      substitutionId: null,
      temporaryGrantIds: [],
    };
  }

  if (!["submitted", "pending"].includes(normalizeStatus(currentRequest.status))) {
    throw new Error("Galima patvirtinti tik pateiktą arba laukiantį prašymą.");
  }

  await assertNoScheduleConflict(supabase, currentRequest);

  if (isAnnualVacation(currentRequest.type)) {
    const year = new Date(`${currentRequest.start_date}T00:00:00`).getFullYear();
    const entitlement = await ensureVacationEntitlement(supabase, currentRequest, year);
    const remainingDays = parseNumber(entitlement.remaining_days);
    const requestedDays = Number(currentRequest.requested_days || 0);

    if (remainingDays === null) {
      throw new Error("DB nerastas vacation_entitlements.remaining_days. Patvirtinimas sustabdytas.");
    }

    if (remainingDays < requestedDays) {
      if (!negativeBalanceReason) {
        throw new Error("Nepakanka atostogų likučio.");
      }
      if (!canApproveNegativeBalance(actorMember)) {
        throw new Error("Neturite teisės patvirtinti minusinio atostogų likučio.");
      }
    }
  }

  const substituteUserId = input.substitution?.substituteUserId || null;
  if (substituteUserId) {
    await assertNoExistingApprovedSubstitution(supabase, currentRequest);
    await assertSubstituteIsValid(supabase, currentRequest, substituteUserId);
  }

  const { data: approvedRequest, error: approveError } = await supabase
    .from("vacation_requests")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: input.actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", currentRequest.id)
    .eq("organization_id", currentRequest.organization_id)
    .in("status", ["submitted", "pending"])
    .select(
      "id, organization_id, employee_id, type, start_date, end_date, status, requested_days, note, created_at, updated_at",
    )
    .maybeSingle();

  if (approveError) throw approveError;
  if (!approvedRequest) throw new Error("Prašymo statusas DB nepasikeitė.");

  const savedRequest = approvedRequest as VacationRequestRow;

  await recalculateVacationEntitlement(supabase, savedRequest);

  let substitutionId: string | null = null;
  const temporaryGrantIds: string[] = [];

  if (substituteUserId) {
    const { data: substitution, error: substitutionError } = await supabase
      .from("employee_substitutions")
      .insert({
        organization_id: savedRequest.organization_id,
        absent_user_id: savedRequest.employee_id,
        substitute_user_id: substituteUserId,
        source_vacation_request_id: savedRequest.id,
        status: "active",
        starts_on: savedRequest.start_date,
        ends_on: savedRequest.end_date,
        valid_from: savedRequest.start_date,
        valid_until: savedRequest.end_date,
        reason: "Pavadavimas patvirtinto neatvykimo laikotarpiui.",
        created_by: input.actorUserId,
        activated_at: new Date().toISOString(),
        activated_by: input.actorUserId,
      })
      .select("id")
      .maybeSingle();

    if (substitutionError) throw substitutionError;
    substitutionId = substitution?.id || null;

    const grantId = await insertTemporaryPermissionGrant(supabase, {
      organizationId: savedRequest.organization_id,
      substituteUserId,
      absentUserId: savedRequest.employee_id,
      sourceRequestId: savedRequest.id,
      startsOn: savedRequest.start_date,
      endsOn: savedRequest.end_date,
      actorUserId: input.actorUserId,
    });

    if (grantId) temporaryGrantIds.push(grantId);
  }

  await insertAuditEvent(supabase, {
    organizationId: savedRequest.organization_id,
    actorUserId: input.actorUserId,
    action: "vacation_request.approved",
    tableName: "vacation_requests",
    recordId: savedRequest.id,
    changes: {
      before: {
        status: currentRequest.status,
      },
      after: {
        status: "approved",
        substitutionId,
        temporaryGrantIds,
        negativeBalanceReason: negativeBalanceReason || null,
      },
    },
  });

  return {
    request: savedRequest,
    substitutionId,
    temporaryGrantIds,
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
