# Copilot Instructions

## Stack

- Next.js 16 App Router with React 19 and TypeScript.
- Client-side gesture recognition uses MediaPipe Tasks Vision.
- Spotify integration uses server route handlers under `src/app/api/`.
- Zod is used to validate API command input.
- Styling uses CSS Modules and global CSS; preserve the existing visual language.

## Code Style

- Use strict TypeScript types and prefer existing domain types and helpers.
- Keep browser-only camera and MediaPipe work in client components.
- Keep route handlers thin and put reusable Spotify or gesture logic in `src/lib/`.
- Use `async`/`await` for asynchronous work and handle expected failures explicitly.
- Run `npm run lint` after code changes.

## Security Rules

- Never commit `.env.local`, Spotify credentials, access tokens, refresh tokens, or other secrets.
- Read secrets only from environment variables; never hardcode credentials.
- Validate request bodies before sending Spotify commands.
- Keep OAuth token handling on the server and never expose tokens to browser code.
- Do not upload camera frames or hand-landmark data to external services.
- Do not log tokens, credentials, or personally identifiable information.

## Project Structure

- `src/app/` — App Router pages, layouts, styles, and API route handlers.
- `src/lib/gestures.ts` — Gesture classification and labels.
- `src/lib/spotify.ts` — Spotify OAuth and playback helpers.
- `public/` — Static assets.

## Verification

- Use `npm run lint` for linting.
- Use `npm run build` to verify the production build.
- Camera features require a browser on localhost or HTTPS; demo mode should remain usable without Spotify credentials.
