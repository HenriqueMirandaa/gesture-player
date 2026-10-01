import { NextResponse } from "next/server";
import { clearSpotifySession } from "@/lib/spotify-auth";

export async function POST() {
  await clearSpotifySession();
  return NextResponse.json({ ok: true });
}
