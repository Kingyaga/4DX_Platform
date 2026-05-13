import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", service: "4DX Platform backend" });
}
