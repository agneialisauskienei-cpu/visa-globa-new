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

function assertUuidLike(value: string, label: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${label} turi būti UUID.`);
  }
}

function normalizeReason(value?: string | null) {
  const reason = String(value || "").trim();
  if (reason.length < 8) {
    throw new Error("Minusiniam atostogų likučiui būtina aiški priežastis, bent 8 simboliai.");
  }
  return reason;
}

/**
 * Server-side approval wrapper.
 *
 * This intentionally delegates the critical work to a Postgres RPC because the
 * RPC runs in one DB transaction:
 * approve request → validate schedule/balance/substitute → create substitution
 * → create temporary grants → audit_log.
 *
 * Put this file in: lib/vacations/approveVacationRequestServer.ts
 */
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

  const { data, error } = await supabase.rpc("approve_vacation_request_transaction", {
    p_request_id: input.requestId,
    p_actor_user_id: input.actorUserId,
    p_substitute_user_id: substituteUserId,
    p_negative_balance_reason: negativeBalanceReason,
  });

  if (error) {
    throw new Error(error.message || "Nepavyko patvirtinti prašymo.");
  }

  return data as ApproveVacationRequestResult;
}
