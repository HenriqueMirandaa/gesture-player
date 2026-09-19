import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const store = await cookies();
  if (!code || state !== store.get("spotify_oauth_state")?.value) return NextResponse.json({ error: "Invalid Spotify OAuth callback" }, { status: 400 });
  const verifier = store.get("spotify_pkce_verifier")?.value;
  if (!verifier || !process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_REDIRECT_URI) return NextResponse.json({ error: "Spotify OAuth is not configured" }, { status: 503 });
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: process.env.SPOTIFY_REDIRECT_URI, client_id: process.env.SPOTIFY_CLIENT_ID, code_verifier: verifier });
  const response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) return NextResponse.json({ error: "Spotify token exchange failed" }, { status: 502 });
  const token = (await response.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  store.set("spotify_access_token", token.access_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: token.expires_in, path: "/" });
  if (token.refresh_token) {
    store.set("spotify_refresh_token", token.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" });
  }
  store.delete("spotify_oauth_state");
  store.delete("spotify_pkce_verifier");
  return NextResponse.redirect(new URL("/", request.url));
}
