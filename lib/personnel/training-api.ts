import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type TrainingPermission =
  | "trainings.manage"
  | "trainings.approve"
  | "training_requirements.manage";

const ROLE_PERMISSIONS: Record<string, TrainingPermission[]> = {
  owner: ["trainings.manage", "trainings.approve", "training_requirements.manage"],
  admin: ["trainings.manage", "trainings.approve", "training_requirements.manage"],
  hr: ["trainings.manage", "trainings.approve", "training_requirements.manage"],
  manager: ["trainings.manage", "trainings.approve"],
  employee: [],
};

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function getAdminSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function getCurrentUserId(req: NextRequest, supabase = getAdminSupabase()) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user.id;
}

export async function assertOrganizationPermission(args: {
  supabase: SupabaseClient;
  userId: string;
  organizationId: string;
  permission: TrainingPermission;
}) {
  const { supabase, userId, organizationId, permission } = args;
  const { data: member, error } = await supabase
    .from("organization_members")
    .select("user_id, organization_id, role, is_active, is_archived")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!member || member.is_archived === true) {
    return { ok: false as const, status: 403, message: "Neturi prieigos prie šios organizacijos." };
  }
  const role = String(member.role || "").toLowerCase();
  if ((ROLE_PERMISSIONS[role] || []).includes(permission)) return { ok: true as const, member };
  try {
    const { data: directPermission } = await supabase
      .from("member_permissions")
      .select("permission, is_allowed")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("permission", permission)
      .eq("is_allowed", true)
      .maybeSingle();
    if (directPermission) return { ok: true as const, member };
  } catch {}
  return { ok: false as const, status: 403, message: "Neturi reikiamos teisės šiam veiksmui." };
}

export async function assertEmployeeBelongsToOrganization(args: {
  supabase: SupabaseClient;
  organizationId: string;
  employeeId: string;
}) {
  const { data, error } = await args.supabase
    .from("organization_members")
    .select("user_id, organization_id, is_active, is_archived")
    .eq("organization_id", args.organizationId)
    .eq("user_id", args.employeeId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data && data.is_archived !== true);
}

export async function writeServerAudit(args: {
  supabase: SupabaseClient;
  organizationId: string;
  actorUserId: string;
  tableName: string;
  recordId: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  const payload = {
    organization_id: args.organizationId,
    actor_user_id: args.actorUserId,
    table_name: args.tableName,
    record_id: args.recordId,
    action: args.action,
    changes: { before: args.before || null, after: args.after || null },
    created_at: new Date().toISOString(),
  };
  const first = await args.supabase.from("audit_logs").insert(payload);
  if (!first.error) return;
  const second = await args.supabase.from("audit_log").insert(payload);
  if (second.error) throw second.error;
}
