import { supabase } from '@/lib/supabase'
import { getCurrentOrganization } from '@/lib/organization'

export type InviteRole = 'owner' | 'admin' | 'employee'
export type InviteStatus = 'pending' | 'accepted' | 'expired'

export type InviteRecord = {
  id: string
  email: string
  role: InviteRole
  status: InviteStatus
  created_at: string | null
  organization_id: string
}

function getReadableError(error: unknown) {
  if (!error) {
    return 'Nežinoma klaida.'
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'object') {
    const maybeError = error as {
      message?: string
      details?: string
      hint?: string
      code?: string
    }

    if (maybeError.message) {
      return maybeError.message
    }

    if (maybeError.details) {
      return maybeError.details
    }

    if (maybeError.hint) {
      return maybeError.hint
    }

    if (maybeError.code) {
      return `Klaidos kodas: ${maybeError.code}`
    }
  }

  return 'Nepavyko įvykdyti veiksmo.'
}

function generateInviteToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `invite_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

export async function createInvite(userId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase()

  if (!normalizedEmail) {
    throw new Error('Nenurodytas el. paštas.')
  }

  const org = await getCurrentOrganization(userId)

  const { data: existingPendingInvite, error: existingInviteError } =
    await supabase
      .from('organization_invites')
      .select('id')
      .eq('organization_id', org.organization_id)
      .eq('email', normalizedEmail)
      .eq('status', 'pending')
      .maybeSingle()

  if (existingInviteError) {
    throw new Error(getReadableError(existingInviteError))
  }

  if (existingPendingInvite) {
    throw new Error('Šiam el. paštui jau yra aktyvus kvietimas.')
  }

  const token = generateInviteToken()

  const { error: insertError } = await supabase
    .from('organization_invites')
    .insert({
      organization_id: org.organization_id,
      email: normalizedEmail,
      role: 'employee',
      status: 'pending',
      token,
    })

  if (insertError) {
    throw new Error(getReadableError(insertError))
  }
}

export async function acceptInvites(userId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase()

  const { data: invites, error } = await supabase
    .from('organization_invites')
    .select('id, organization_id, role, status')
    .eq('email', normalizedEmail)
    .eq('status', 'pending')

  if (error) {
    throw new Error(getReadableError(error))
  }

  for (const invite of invites || []) {
    const { data: existingMembership, error: membershipCheckError } =
      await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', userId)
        .eq('organization_id', invite.organization_id)
        .maybeSingle()

    if (membershipCheckError) {
      throw new Error(getReadableError(membershipCheckError))
    }

    if (!existingMembership) {
      const { error: insertMembershipError } = await supabase
        .from('organization_members')
        .insert({
          user_id: userId,
          organization_id: invite.organization_id,
          role: invite.role,
        })

      if (insertMembershipError) {
        throw new Error(getReadableError(insertMembershipError))
      }
    }

    const { error: updateInviteError } = await supabase
      .from('organization_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id)

    if (updateInviteError) {
      throw new Error(getReadableError(updateInviteError))
    }
  }
}

export async function getOrganizationInvites(userId: string) {
  const org = await getCurrentOrganization(userId)

  const { data, error } = await supabase
    .from('organization_invites')
    .select('id, email, role, status, created_at, organization_id')
    .eq('organization_id', org.organization_id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(getReadableError(error))
  }

  return (data || []) as InviteRecord[]
}