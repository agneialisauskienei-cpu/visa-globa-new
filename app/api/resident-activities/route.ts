import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json(
    { error: "Šis senas endpointas nebenaudojamas. Naudokite /api/activity-sessions." },
    { status: 410 },
  )
}

export async function POST() {
  return NextResponse.json(
    { error: "Šis senas endpointas nebenaudojamas. Naudokite /api/activity-sessions." },
    { status: 410 },
  )
}
