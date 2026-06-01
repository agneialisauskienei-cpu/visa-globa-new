import { NextRequest, NextResponse } from "next/server";
import {
  assertEmployeeBelongsToOrganization,
  assertOrganizationPermission,
  getAdminSupabase,
  getCurrentUserId,
  jsonError,
  writeServerAudit,
} from "@/lib/personnel/training-api";

export async function POST(req: NextRequest) {
  try {
    const supabase = getAdminSupabase();
    const userId = await getCurrentUserId(req, supabase);
    if (!userId) return jsonError("Prisijungimas nerastas.", 401);
    const body = await req.json();
    const organizationId = String(body.organization_id || "");
    const employeeId = String(body.employee_id || "");
    const title = String(body.title || "").trim();
    if (!organizationId || !employeeId || !title) return jsonError("Trūksta organization_id, employee_id arba title.", 400);
    const permission = await assertOrganizationPermission({ supabase, userId, organizationId, permission: "trainings.manage" });
    if (!permission.ok) return jsonError(permission.message, permission.status);
    const employeeOk = await assertEmployeeBelongsToOrganization({ supabase, organizationId, employeeId });
    if (!employeeOk) return jsonError("Darbuotojas nepriklauso šiai organizacijai arba yra archyvuotas.", 403);
    const canApprove = await assertOrganizationPermission({ supabase, userId, organizationId, permission: "trainings.approve" });
    const autoApprove = canApprove.ok === true;
    const today = new Date().toISOString().slice(0, 10);
    const payload = {
      organization_id: organizationId,
      employee_id: employeeId,
      title,
      provider: body.provider ? String(body.provider).trim() : null,
      completed_at: body.completed_at || null,
      expires_at: body.expires_at || null,
      valid_until: body.expires_at || body.valid_until || null,
      hours: Number(body.hours || 0),
      certificate_number: body.certificate_number ? String(body.certificate_number).trim() : null,
      status: autoApprove ? "valid" : "pending",
      approval_status: autoApprove ? "approved" : "pending",
      approved_at: autoApprove ? today : null,
      approved_by: autoApprove ? userId : null,
      verified_at: autoApprove ? today : null,
      verified_by: autoApprove ? userId : null,
      reviewed_at: autoApprove ? today : null,
      reviewed_by: autoApprove ? userId : null,
      submitted_by: userId,
      created_by: userId,
      is_archived: false,
    };
    const { data, error } = await supabase.from("personnel_trainings").insert(payload).select("*").single();
    if (error) return jsonError(error.message, 400);
    await writeServerAudit({ supabase, organizationId, actorUserId: userId, tableName: "personnel_trainings", recordId: data.id, action: "training.created", before: null, after: data });
    return NextResponse.json({ data });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : String(error), 500);
  }
}
