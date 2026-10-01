# Gesture Player

Gesture Player is a Next.js MVP that controls music with hand gestures. Hand landmarks are processed locally in the browser with MediaPipe; camera frames are never uploaded.

## Current MVP

- Demo mode works without a Spotify account.
- Enable control mode to start gesture recognition in the camera, including in Demo mode.
- Closed fist pauses, open palm resumes, thumb right/left skips tracks.
- A V gesture moving up/down changes volume intent; joining the fingers mutes.
- Demo mode uses fictional tracks and draws a live green hand skeleton over the camera feed.
- Spotify commands are exposed through a validated server route.
- Sign in with Spotify to mirror the currently playing track, progress, status, device and volume.
- Playback continues in the Spotify app/device; this website only reads state and sends commands.

## Run locally

```bash
npm install
npm run dev
```

### Connect a Spotify account locally

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), then open its settings.
2. Add this exact Redirect URI: `http://127.0.0.1:3000/api/auth/spotify/callback`. Spotify requires `127.0.0.1` rather than `localhost`.
3. In the Spotify app's Users Management settings, allowlist the Spotify account you will use for testing.
4. Copy `.env.example` to `.env.local` and set `SPOTIFY_CLIENT_ID` to the app's Client ID. Keep `DEMO_MODE=false` and `SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/auth/spotify/callback`.
5. Generate a 32-byte encryption key in PowerShell:

   ```powershell
   $bytes = New-Object byte[] 32
   $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
   $rng.GetBytes($bytes)
   [Convert]::ToBase64String($bytes)
   $rng.Dispose()
   ```

   Put the printed value in `.env.local` as `SPOTIFY_TOKEN_ENCRYPTION_KEY`. Do not share or commit `.env.local`. Leave `SPOTIFY_CLIENT_SECRET` empty; the login uses PKCE and does not need it.

6. Run `npm install`, then `npm run dev`, and open `http://127.0.0.1:3000`.
7. Turn off the **Demo mode** switch and click **Sign in with Spotify**. Approve access. Start playback on an active Spotify device to see the track update in the app.

Spotify Development Mode permits up to five allowlisted users and requires the app owner to have Spotify Premium. Playback commands also require Premium and an active device. This local setup stores the encrypted tokens in an HTTP-only cookie; it needs no database or hosted service.

The player polls Spotify every three seconds while the tab is visible. Camera inference remains local in the browser; camera frames and hand landmarks are not uploaded.
