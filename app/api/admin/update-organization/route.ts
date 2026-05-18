import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { ok: false, message: "update-organization API temporarily disabled for production build" },
    { status: 501 }
  );
}
