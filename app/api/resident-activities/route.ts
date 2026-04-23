import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'Čia prijunk recurring activities sąrašą.' })
}

export async function POST() {
  return NextResponse.json({ message: 'Čia prijunk recurring activity kūrimą.' }, { status: 501 })
}
