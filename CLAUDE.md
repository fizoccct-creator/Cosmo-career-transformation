# Project context for Claude Code

"Discover Your Creative Career": a touchscreen kiosk for Cosmopolitan College (Brunei). The visitor takes a photo, answers 5 questions, and gets a portrait of themselves as a Photographer, Videographer, Graphic Designer or Content Creator.

## Run
- `node server.js` → http://localhost:3000 (Node 18+, zero npm dependencies; keep it that way unless there's a strong reason)
- AI on: `.env` with `GEMINI_API_KEY` (see `.env.example`). Never commit `.env`.
- Don't use VS Code Live Server: `/api/*` needs `server.js`.

## Architecture
- `server.js`: static server + `POST /api/portrait` (Gemini generateContent, image edit) + `GET /api/status`. Prompts are read **server-side** from `public/content.json`; the browser only sends a career id.
- `public/content.json`: ALL copy, questions, careers, AI prompts, timings. Text changes go here, not in the HTML.
- `public/styles/tokens.css`: design tokens + artwork slots for Figma. `app.css` uses only tokens.
- `public/js/app.js`: screen state machine (welcome → consent → photo → quiz → loading → result | error), camera, idle reset.
- `public/js/portrait.js`: AI only: calls `/api/portrait`, throws a readable error on failure.

## Decisions already made with the owner (don't revisit unless asked)
- Portrait = AI only (Google Gemini, model set by `GEMINI_MODEL`). The owner removed the offline template fallback on purpose: the kiosk must be online. On failure, show the error screen (TRY AGAIN keeps the photo and answers; START OVER wipes them). Don't reintroduce a fallback unless asked.
- One-tap consent screen before the camera (minors likely). Photos are never written to disk; wiped on result, restart and idle.
- Quiz is AR (like the owner's earlier Cosmo Quiz head-tilt filter): 4 answers placed around the face; look up / look down / tilt left / tilt right, hold ~0.65 s to choose. Owner chose 4 directions to keep the 5 questions × 4 answers as written. Positions shuffle per question. Touch always works; falls back to a touch grid if tracking fails. Code: `public/js/ar-tracker.js` + AR block in `app.js`; settings in `content.json` → `ar`.
- Q1–4 auto-advance after an answer; Q5 shows "DISCOVER MY CAREER" after an answer (answer can still be changed).
- Tie-break: the most recently chosen of the tied careers wins.
- No take-home/sharing yet (no QR, no printing).
- Landscape kiosk first (1920×1080), portrait screens supported.
- Owner will design in Figma later: keep visuals token/slot driven (see DESIGN.md).

## Known unknowns
- Real Gemini calls are untested (built against a mock). Model names change; errors are logged in the terminal.
- Not yet tried on the physical touchscreen.
- AR up/down thresholds were tuned on a simulated face, not real people: expect to adjust `lookUp`/`lookDown` with `?debug`.

## Owner's working style
Stress-test strategic choices and point out weak assumptions; once the owner decides, execute without re-arguing. English only.
