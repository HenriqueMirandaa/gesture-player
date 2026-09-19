import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const store = await cookies();
  return NextResponse.json({ authenticated: Boolean(store.get("spotify_access_token")?.value || store.get("spotify_refresh_token")?.value) });
}
