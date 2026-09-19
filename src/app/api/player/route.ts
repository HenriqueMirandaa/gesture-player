import { NextResponse } from "next/server";
import { getSpotifyAccessToken } from "@/lib/spotify";

export async function GET() {
  const token = await getSpotifyAccessToken();
  if (!token) return NextResponse.json({ authenticated: false });

  const response = await fetch("https://api.spotify.com/v1/me/player", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (response.status === 204) return NextResponse.json({ authenticated: true, playing: null });
  if (!response.ok) return NextResponse.json({ error: "Spotify player state unavailable" }, { status: response.status });

  const state = (await response.json()) as {
    is_playing: boolean;
    progress_ms: number;
    item?: { name: string; artists: Array<{ name: string }>; album: { name: string; images: Array<{ url: string }> }; duration_ms: number };
    device?: { name: string; volume_percent: number };
  };
  return NextResponse.json({
    authenticated: true,
    playing: {
      isPlaying: state.is_playing,
      progressMs: state.progress_ms,
      durationMs: state.item?.duration_ms ?? 0,
      title: state.item?.name ?? "Nothing playing",
      artist: state.item?.artists.map((artist) => artist.name).join(", ") ?? "No active track",
      album: state.item?.album.name ?? "",
      image: state.item?.album.images[0]?.url ?? null,
      volume: state.device?.volume_percent ?? 0,
      device: state.device?.name ?? "No active device",
    },
  });
}
