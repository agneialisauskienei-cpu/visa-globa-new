import { NextResponse } from 'next/server'

export async function PATCH(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  return NextResponse.json({ message: `Čia prijunk care task ${id} būsenos atnaujinimą.` }, { status: 501 })
}
