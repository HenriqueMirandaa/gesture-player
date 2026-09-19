import { cookies } from "next/headers";

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
};

export async function getSpotifyAccessToken() {
  const store = await cookies();
  const accessToken = store.get("spotify_access_token")?.value;
  if (accessToken) return accessToken;

  const refreshToken = store.get("spotify_refresh_token")?.value;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!refreshToken || !clientId) return null;

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });
  if (!response.ok) return null;

  const token = (await response.json()) as TokenResponse;
  store.set("spotify_access_token", token.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: token.expires_in,
    path: "/",
  });
  if (token.refresh_token) {
    store.set("spotify_refresh_token", token.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return token.access_token;
}
