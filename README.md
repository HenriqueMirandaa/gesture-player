# Gesture Player

Gesture Player is a Next.js MVP that controls music with hand gestures. Hand landmarks are processed locally in the browser with MediaPipe; camera frames are never uploaded.

## Current MVP

- Demo mode works without a Spotify account.
- Enable control mode to start gesture recognition.
- Closed fist pauses, open palm resumes, thumb right/left skips tracks.
- A V gesture moving up/down changes volume intent; joining the fingers mutes.
- Spotify commands are exposed through a validated server route.
- Sign in with Spotify to mirror the currently playing track, progress, status, device and volume.
- Playback continues in the Spotify app/device; this website only reads state and sends commands.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in Chrome or Edge. Camera access requires localhost or HTTPS.

Copy `.env.example` to `.env.local`. Demo mode is enabled by default. Add your Spotify app credentials and set `DEMO_MODE=false` to use the integration. Register `http://localhost:3000/api/auth/spotify/callback` as a Redirect URI in the Spotify Developer Dashboard.

## Deploy

Import the repository into Vercel, add the environment variables, and use the production callback URL in the Spotify Developer Dashboard. Camera inference stays client-side so the application fits serverless hosting.
