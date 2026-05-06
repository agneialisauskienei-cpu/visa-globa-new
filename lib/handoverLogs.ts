import { SupabaseClient } from "@supabase/supabase-js"

export type HandoverPriority = "low" | "medium" | "high" | "critical"
export type HandoverShiftType = "morning" | "day" | "evening" | "night" | "other"

export type CreateHandoverInput = {
  organizationId: string
  residentId?: string | null
  createdBy: string
  shiftDate: string
  shiftType: HandoverShiftType
  category: string
  priority: HandoverPriority
  title: string
  note: string
  isImportant?: boolean
  needsFollowUp?: boolean
}

export async function createHandoverLog(supabase: SupabaseClient, input: CreateHandoverInput) {
  const { data, error } = await supabase
    .from("handover_logs")
    .insert({
      organization_id: input.organizationId,
      resident_id: input.residentId || null,
      created_by: input.createdBy,
      shift_date: input.shiftDate,
      shift_type: input.shiftType,
      category: input.category,
      priority: input.priority,
      title: input.title,
      note: input.note,
      is_important: input.isImportant ?? false,
      needs_follow_up: input.needsFollowUp ?? false,
    })
    .select("*")
    .single()

  if (error) throw error
  return data
}

export async function markHandoverAsRead(
  supabase: SupabaseClient,
  organizationId: string,
  handoverId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("handover_acknowledgements")
    .upsert(
      {
        organization_id: organizationId,
        handover_id: handoverId,
        user_id: userId,
        read_at: new Date().toISOString(),
      },
      { onConflict: "handover_id,user_id" }
    )
    .select("*")
    .single()

  if (error) throw error
  return data
}
