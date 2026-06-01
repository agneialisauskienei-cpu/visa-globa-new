import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationPermission, getAdminSupabase, getCurrentUserId, jsonError, writeServerAudit } from "@/lib/personnel/training-api";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: Params) {
  try {
    const supabase = getAdminSupabase();
    const userId = await getCurrentUserId(req, supabase);
    if (!userId) return jsonError("Prisijungimas nerastas.", 401);
    const { id } = await context.params;
    if (!id) return jsonError("Trūksta mokymo ID.", 400);
    const { data: previous, error: previousError } = await supabase.from("personnel_trainings").select("*").eq("id", id).maybeSingle();
    if (previousError) return jsonError(previousError.message, 400);
    if (!previous || previous.is_archived === true) return jsonError("Mokymas nerastas arba archyvuotas.", 404);
    const organizationId = previous.organization_id;
    if (!organizationId) return jsonError("Mokymas neturi organization_id.", 400);
    const permission = await assertOrganizationPermission({ supabase, userId, organizationId, permission: "trainings.manage" });
    if (!permission.ok) return jsonError(permission.message, permission.status);
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: userId,
    };
    const { data, error } = await supabase.from("personnel_trainings").update(payload).eq("id", id).eq("organization_id", organizationId).select("*").single();
    if (error) return jsonError(error.message, 400);
    await writeServerAudit({ supabase, organizationId, actorUserId: userId, tableName: "personnel_trainings", recordId: id, action: "training.archived", before: previous, after: data });
    return NextResponse.json({ data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 500);
  }
}
