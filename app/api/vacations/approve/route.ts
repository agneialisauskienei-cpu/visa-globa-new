import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Naudokite /api/team/vacation-requests/{id}/approve maršrutą.",
    },
    { status: 410 },
  )
}
