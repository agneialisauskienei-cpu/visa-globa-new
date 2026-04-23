function shouldGenerateForDate(activity: any, date: Date) {
  const weekday = date.getDay() === 0 ? 7 : date.getDay()
  if (activity.frequency_type === 'daily') return true
  if (activity.frequency_type === 'weekly') {
    return weekday === new Date(activity.start_date).getDay()
  }
  if (activity.frequency_type === 'selected_weekdays') {
    return Array.isArray(activity.weekdays) && activity.weekdays.includes(weekday)
  }
  return false
}

export async function generateCareTasksForDate(supabase: any, organizationId: string, dateIso: string) {
  const date = new Date(`${dateIso}T00:00:00`)
  const { data: activities, error } = await supabase
    .from('resident_recurring_activities')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .lte('start_date', dateIso)

  if (error) throw error

  const inserts = []
  for (const activity of activities ?? []) {
    if (activity.end_date && activity.end_date < dateIso) continue
    if (!shouldGenerateForDate(activity, date)) continue

    for (let i = 0; i < (activity.times_per_day || 1); i += 1) {
      inserts.push({
        organization_id: organizationId,
        resident_id: activity.resident_id,
        recurring_activity_id: activity.id,
        title: activity.title,
        description: activity.description,
        task_date: dateIso,
        assigned_user_id: activity.assigned_user_id,
      })
    }
  }

  if (!inserts.length) return { inserted: 0 }

  const { error: insertError } = await supabase.from('care_tasks').insert(inserts)
  if (insertError) throw insertError

  return { inserted: inserts.length }
}
