import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSpotifySession } from "@/lib/spotify-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  if (url.searchParams.has("error")) {
    store.delete("spotify_oauth_state");
    store.delete("spotify_pkce_verifier");
    return NextResponse.json({ error: "Spotify authorization was denied. Start sign-in again and approve access." }, { status: 400 });
  }
  if (!code || state !== store.get("spotify_oauth_state")?.value) {
    const appUrl = process.env.SPOTIFY_REDIRECT_URI
      ? new URL(process.env.SPOTIFY_REDIRECT_URI).origin
      : "the same local address used to start sign-in";
    return NextResponse.json({ error: `Spotify login state is missing or expired. Restart sign-in from ${appUrl}.` }, { status: 400 });
  }
  const verifier = store.get("spotify_pkce_verifier")?.value;
  if (!verifier || !process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_REDIRECT_URI) return NextResponse.json({ error: "Spotify OAuth is not configured" }, { status: 503 });
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: process.env.SPOTIFY_REDIRECT_URI, client_id: process.env.SPOTIFY_CLIENT_ID, code_verifier: verifier });
  const response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) return NextResponse.json({ error: "Spotify token exchange failed" }, { status: 502 });
  const token = (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  await createSpotifySession(token);
  store.delete("spotify_oauth_state");
  store.delete("spotify_pkce_verifier");
  return NextResponse.redirect(new URL("/?spotify=connected", process.env.SPOTIFY_REDIRECT_URI));
}
