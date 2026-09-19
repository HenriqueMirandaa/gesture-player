import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const store = await cookies();
  for (const name of ["spotify_access_token", "spotify_refresh_token", "spotify_oauth_state", "spotify_pkce_verifier"]) {
    store.delete(name);
  }
  return NextResponse.json({ ok: true });
}
