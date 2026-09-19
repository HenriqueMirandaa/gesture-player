import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { getSpotifyAccessToken } from "@/lib/spotify";

const commandSchema = z.object({
  command: z.enum(["pause", "play", "next", "previous", "volumeUp", "volumeDown", "mute"]),
});

const spotifyCommand = {
  pause: { method: "PUT", path: "/me/player/pause" },
  play: { method: "PUT", path: "/me/player/play" },
  next: { method: "POST", path: "/me/player/next" },
  previous: { method: "POST", path: "/me/player/previous" },
} as const;

export async function POST(request: Request) {
  const parsed = commandSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid player command" }, { status: 400 });

  const token = (await cookies()).get("spotify_access_token")?.value ?? process.env.SPOTIFY_ACCESS_TOKEN ?? await getSpotifyAccessToken();
  if (process.env.DEMO_MODE !== "false") {
    return NextResponse.json({ message: `${parsed.data.command} simulated (configure Spotify to use live playback)` });
  }
  if (!token) return NextResponse.json({ error: "Sign in with Spotify before sending commands" }, { status: 401 });

  const command = parsed.data.command;
  if (command === "volumeUp" || command === "volumeDown" || command === "mute") {
    const current = await fetch("https://api.spotify.com/v1/me/player", { headers: { Authorization: `Bearer ${token}` } });
    if (!current.ok) return NextResponse.json({ error: "Could not read the active Spotify player" }, { status: current.status });
    const state = (await current.json()) as { device?: { volume_percent?: number } };
    const nextVolume = command === "mute" ? 0 : Math.max(0, Math.min(100, (state.device?.volume_percent ?? 50) + (command === "volumeUp" ? 5 : -5)));
    const changed = await fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${nextVolume}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` } });
    if (!changed.ok) return NextResponse.json({ error: "Spotify volume command failed" }, { status: changed.status });
    return NextResponse.json({ message: `${command} sent to Spotify` });
  }
  const target = spotifyCommand[command];
  const response = await fetch(`https://api.spotify.com/v1${target.path}`, {
    method: target.method,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return NextResponse.json({ error: "Spotify could not execute this command. Check the active device and Premium account." }, { status: response.status });
  }
  return NextResponse.json({ message: `${command} sent to Spotify` });
}
