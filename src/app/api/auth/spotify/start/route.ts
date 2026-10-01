import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";

export async function GET(request: Request) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !redirectUri) return NextResponse.json({ error: "Spotify OAuth is not configured" }, { status: 503 });
  const callbackUrl = new URL(redirectUri);
  const requestHost = request.headers.get("host") ?? new URL(request.url).host;
  if (requestHost !== callbackUrl.host) {
    return NextResponse.redirect(new URL("/api/auth/spotify/start", callbackUrl.origin));
  }
  const state = crypto.randomBytes(16).toString("hex");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const store = await cookies();
  store.set("spotify_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  store.set("spotify_pkce_verifier", verifier, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, scope: "user-modify-playback-state user-read-playback-state", redirect_uri: redirectUri, state, code_challenge_method: "S256", code_challenge: challenge });
  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
}
