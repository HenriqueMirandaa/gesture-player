import crypto from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "spotify_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const ACCESS_TOKEN_SKEW_MS = 60_000;

type SpotifyToken = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
};

type SpotifySession = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
};

function encryptionKey() {
  const key = Buffer.from(process.env.SPOTIFY_TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("SPOTIFY_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return key;
}

function encrypt(session: SpotifySession) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string): SpotifySession {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid Spotify session cookie");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const session = JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8")) as SpotifySession;
  if (typeof session.accessToken !== "string" || typeof session.refreshToken !== "string" || typeof session.accessExpiresAt !== "number") {
    throw new Error("Invalid Spotify session data");
  }
  return session;
}

export async function createSpotifySession(token: SpotifyToken) {
  const store = await cookies();
  const session: SpotifySession = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? "",
    accessExpiresAt: Date.now() + token.expires_in * 1000,
  };
  store.set(SESSION_COOKIE, encrypt(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function getSpotifyAccessToken() {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const session = decrypt(value);
  if (session.accessExpiresAt > Date.now() + ACCESS_TOKEN_SKEW_MS) return session.accessToken;
  if (!session.refreshToken) return null;

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) throw new Error("SPOTIFY_CLIENT_ID is not configured");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
      client_id: clientId,
    }),
  });
  if (response.status === 400 || response.status === 401) {
    store.delete(SESSION_COOKIE);
    return null;
  }
  if (!response.ok) throw new Error("Spotify token refresh failed");
  const token = (await response.json()) as SpotifyToken;
  session.accessToken = token.access_token;
  session.refreshToken = token.refresh_token ?? session.refreshToken;
  session.accessExpiresAt = Date.now() + token.expires_in * 1000;
  store.set(SESSION_COOKIE, encrypt(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return session.accessToken;
}

export async function clearSpotifySession() {
  const store = await cookies();
  store.delete("spotify_oauth_state");
  store.delete("spotify_pkce_verifier");
  store.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };
