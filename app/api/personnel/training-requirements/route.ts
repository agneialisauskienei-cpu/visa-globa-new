import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationPermission, getAdminSupabase, getCurrentUserId, jsonError, writeServerAudit } from "@/lib/personnel/training-api";

function normalizeTitle(value: unknown) {
  return String(value || "").trim();
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const userId = await getCurrentUserId(req, supabase);
    if (!userId) return jsonError("Prisijungimas nerastas.", 401);
    const body = await req.json();
    const organizationId = String(body.organization_id || "");
    const positionKey = String(body.position_key || "");
    const nextItems = Array.isArray(body.next_items) ? body.next_items : [];
    const deleteTitle = body.delete_title ? String(body.delete_title) : null;
    const auditAction = String(body.audit_action || "updated");
    if (!organizationId || !positionKey) return jsonError("Trūksta organization_id arba position_key.", 400);
    const permission = await assertOrganizationPermission({ supabase, userId, organizationId, permission: "training_requirements.manage" });
    if (!permission.ok) return jsonError(permission.message, permission.status);
    const normalizedItems = Array.from(new Map(nextItems.map((item: any) => ({ title: normalizeTitle(item.title), hours: Number(item.hours || 0) })).filter((item: any) => item.title).map((item: any) => [item.title.toLowerCase(), item])).values()) as Array<{ title: string; hours: number }>;
    const { data: beforeRows, error: beforeError } = await supabase.from("personnel_training_position_requirements").select("*").eq("organization_id", organizationId).eq("position_key", positionKey).eq("is_active", true);
    if (beforeError) return jsonError(beforeError.message, 400);
    let upsertedRows: any[] = [];
    if (normalizedItems.length > 0) {
      const { data, error } = await supabase.from("personnel_training_position_requirements").upsert(normalizedItems.map((item) => ({ organization_id: organizationId, position_key: positionKey, title: item.title, hours: item.hours, is_active: true, valid_to: null })), { onConflict: "organization_id,position_key,title" }).select("*");
      if (error) return jsonError(error.message, 400);
      upsertedRows = data || [];
    }
    let deletedRow: any = null;
    if (deleteTitle && !normalizedItems.some((item) => item.title.toLowerCase() === deleteTitle.toLowerCase())) {
      const { data, error } = await supabase.from("personnel_training_position_requirements").update({ is_active: false, valid_to: new Date().toISOString().slice(0, 10) }).eq("organization_id", organizationId).eq("position_key", positionKey).eq("title", deleteTitle).eq("is_active", true).select("*").maybeSingle();
      if (error) return jsonError(error.message, 400);
      deletedRow = data;
    }
    const { data: afterRows, error: afterError } = await supabase.from("personnel_training_position_requirements").select("*").eq("organization_id", organizationId).eq("position_key", positionKey).eq("is_active", true).order("title", { ascending: true });
    if (afterError) return jsonError(afterError.message, 400);
    await writeServerAudit({ supabase, organizationId, actorUserId: userId, tableName: "personnel_training_position_requirements", recordId: `${organizationId}:${positionKey}`, action: `training_requirement.${auditAction}`, before: { rows: beforeRows || [] }, after: { rows: afterRows || [], upsertedRows, deletedRow } });
    return NextResponse.json({ data: afterRows || [] });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 500);
  }
}
