import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/spotify-auth";

export async function GET() {
  const store = await cookies();
  return NextResponse.json({ authenticated: Boolean(store.get(SESSION_COOKIE)?.value) });
}
