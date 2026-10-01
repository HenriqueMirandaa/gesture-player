import { ImageResponse } from "next/og";

export const alt = "Gesture Player — Direct the room. Hands become the interface.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "66px 76px",
      background: "linear-gradient(135deg, #17191c 0%, #202729 58%, #123a2a 100%)",
      color: "#f3f1ed",
      fontFamily: "Arial",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#31d27c", fontSize: 22, fontWeight: 700, letterSpacing: 4 }}>
        <span style={{ fontSize: 34 }}>♫</span>
        <span>GESTURE PLAYER</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 900 }}>
        <div style={{ fontSize: 76, lineHeight: 1.05, fontWeight: 700, letterSpacing: -2 }}>Direct the room.</div>
        <div style={{ color: "#c5cbc7", fontSize: 32 }}>Hands become the interface.</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#aab4ae", fontSize: 20 }}>
        <span style={{ width: 12, height: 12, borderRadius: 6, background: "#31d27c" }} />
        <span>Local hand tracking · Spotify playback control</span>
      </div>
    </div>,
    size,
  );
}
