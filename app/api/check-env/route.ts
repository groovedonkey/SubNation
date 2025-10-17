import { NextResponse } from "next/server";

export async function GET() {
  const raw = process.env.OPENAI_API_KEY || "";
  const masked = raw ? raw.slice(0, 7) + "…" : "(missing)";
  return NextResponse.json({ OPENAI_API_KEY: masked });
}

